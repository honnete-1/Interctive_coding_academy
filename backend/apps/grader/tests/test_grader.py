import json

import pytest
import yaml
from django.conf import settings

from apps.curriculum.loader import CONTENT_DIR, iter_challenges, read_curriculum_files
from apps.curriculum.models import Challenge
from apps.grader.evaluate import evaluate_code, run_quality_checks, stdout_matches
from apps.grader.robot import ProgramError, simulate
from apps.grader.sandbox import run_code

DOCS = read_curriculum_files()
CODE_CHALLENGES = [(l["slug"], c) for l, c in iter_challenges(DOCS) if c.get("kind", "code") == "code"]

ROBOT_SOLUTIONS = {
    "robot-straight-road": [{"cmd": c} for c in ["forward", "forward", "pick", "forward", "forward", "drop"]],
    "robot-turning-corners": [{"cmd": c} for c in ["forward", "right", "forward", "left", "forward", "pick", "right", "forward", "drop"]],
    "robot-fix-the-route": [{"cmd": c} for c in ["right", "forward", "left", "forward", "pick", "right", "forward", "drop"]],
    "robot-long-road": [{"cmd": "repeat", "times": 6, "body": [{"cmd": "forward"}]}] + [{"cmd": c} for c in ["pick", "right", "forward", "drop"]],
}


# --- Sandbox -------------------------------------------------------------------

def test_runs_code_and_captures_output_and_variables():
    [case] = run_code("x = 2\ny = x * 3\nprint(y)", [""]).cases
    assert case.printed == "6\n"
    assert case.variables == {"x": 2, "y": 6}
    assert case.error is None


def test_input_prompts_are_in_transcript_but_not_printed_output():
    [case] = run_code("n = int(input('N: '))\nprint(n + 1)", ["41"]).cases
    assert case.stdout == "N: 41\n42\n"
    assert case.printed == "42\n"


def test_running_out_of_input_is_a_clear_error():
    [case] = run_code("a = input()\nb = input()", ["only one"]).cases
    assert case.error["type"] == "EOFError"
    assert case.error["line"] == 2


def test_infinite_loop_is_stopped_by_step_limit():
    [case] = run_code("i = 0\nwhile True:\n    i += 1", [""]).cases
    assert case.error["type"] in {"StepLimitExceeded", "TimeoutError"}


def test_except_exception_cannot_swallow_step_limit():
    code = "while True:\n    try:\n        pass\n    except Exception:\n        pass"
    [case] = run_code(code, [""]).cases
    assert case.error["type"] in {"StepLimitExceeded", "TimeoutError"}


@pytest.mark.parametrize("code", ["import os", "import subprocess", "from socket import socket", "open('x.txt', 'w')"])
def test_dangerous_capabilities_are_unavailable(code):
    [case] = run_code(code, [""]).cases
    assert case.error is not None


def test_syntax_error_reports_line():
    [case] = run_code("print('ok')\nif True\n    pass", [""]).cases
    assert case.error["type"] == "SyntaxError"
    assert case.error["line"] == 2


def test_runtime_error_reports_line():
    [case] = run_code("a = 1\nb = a + 'x'", [""]).cases
    assert case.error["type"] == "TypeError"
    assert case.error["line"] == 2


def test_output_is_truncated(settings):
    settings.GRADER_MAX_OUTPUT_CHARS = 100
    [case] = run_code("for i in range(1000):\n    print('spam')", [""]).cases
    assert case.truncated and len(case.stdout) <= 100


def test_cases_do_not_share_state():
    code = "import random\ntry:\n    seen\nexcept NameError:\n    seen = 0\nseen += 1\nprint(seen)"
    cases = run_code(code, ["", ""]).cases
    assert [c.printed for c in cases] == ["1\n", "1\n"]


def test_rejects_overlong_code(settings):
    settings.GRADER_MAX_CODE_CHARS = 10
    [case] = run_code("print('this is long')", [""]).cases
    assert case.error["type"] == "CodeTooLong"


# --- Comparison & quality --------------------------------------------------------

@pytest.mark.parametrize("actual,expected,mode,ok", [
    ("Total fare: 1400 RWF\n", "Total fare: 1400 RWF", "lines", True),
    ("Total fare: 1400.0 RWF\n", "Total fare: 1400 RWF", "lines", True),
    ("total fare: 1400 rwf\n", "Total fare: 1400 RWF", "lines", True),
    ("Total fare: 1401 RWF\n", "Total fare: 1400 RWF", "lines", False),
    ("Not Approved\n", "Approved", "lines", False),
    ("debug\nApproved\n", "Approved", "lines", True),
    ("Insufficient balance\nApproved\n", "Insufficient balance", "exact", False),
    ("Insufficient balance\n", "Insufficient balance", "exact", True),
    ("a\nb\nc\n", "a\nc", "lines", True),
    ("c\na\n", "a\nc", "lines", False),
])
def test_stdout_matching(actual, expected, mode, ok):
    assert stdout_matches(actual, expected, mode) is ok


def test_quality_checks_use_ast_only():
    code = "d = int(input())\nprint(d * 3)"
    checks = [
        {"rule": "uses_input", "message": "m"},
        {"rule": "uses_operator", "op": "*", "message": "m"},
        {"rule": "uses_loop", "message": "m"},
        {"rule": "no_hardcoded_output", "values": ["99"], "message": "m"},
    ]
    assert [q.passed for q in run_quality_checks(code, checks)] == [True, True, False, True]
    assert not run_quality_checks("print('99')", checks[3:])[0].passed


# --- Curriculum integrity: reference solutions pass, starters don't ---------------

@pytest.mark.django_db
@pytest.mark.parametrize("lesson_slug,challenge", CODE_CHALLENGES, ids=[c["slug"] for _, c in CODE_CHALLENGES])
def test_reference_solution_passes_all_tests_and_starter_fails(curriculum, lesson_slug, challenge):
    ch = Challenge.objects.get(slug=challenge["slug"])
    assert "solution" in challenge, "every code challenge needs a reference solution"
    good = evaluate_code(ch, challenge["solution"])
    failures = [(t.name, t.message) for t in good.tests if not t.passed]
    assert good.passed, failures
    assert all(q.passed for q in good.quality), [q.message for q in good.quality if not q.passed]
    bad = evaluate_code(ch, challenge.get("starter_code", ""))
    assert not bad.passed, "starter code must not already pass"


@pytest.mark.django_db
def test_hidden_tests_exist_for_projects_and_transfers(curriculum):
    for ch in Challenge.objects.filter(kind="code", tier__in=["project", "transfer", "capstone"]):
        assert ch.tests.filter(visible=False).exists(), ch.slug


# --- Robot -----------------------------------------------------------------------

def test_robot_fixtures_shared_with_frontend():
    data = json.loads((CONTENT_DIR / "robot_fixtures.json").read_text(encoding="utf-8"))
    for case in data["cases"]:
        result = simulate(case["spec"], case["program"])
        assert result.outcome == case["outcome"], case["name"]
        assert result.actions == case["actions"], case["name"]


@pytest.mark.parametrize("lesson_slug,challenge", [(l["slug"], c) for l, c in iter_challenges(DOCS) if c.get("kind") == "robot"])
def test_robot_missions_are_solvable_and_debug_starter_is_broken(lesson_slug, challenge):
    result = simulate(challenge["spec"], ROBOT_SOLUTIONS[challenge["slug"]])
    assert result.success, result.message
    if "starter_program" in challenge["spec"]:
        assert not simulate(challenge["spec"], challenge["spec"]["starter_program"]).success


def test_robot_rejects_bad_programs():
    spec = {"grid": ["S.P.D"], "allowed": ["forward"]}
    with pytest.raises(ProgramError):
        simulate(spec, [{"cmd": "teleport"}])
    with pytest.raises(ProgramError):
        simulate({"grid": ["S.P.D"]}, [{"cmd": "repeat", "times": 999, "body": []}])
