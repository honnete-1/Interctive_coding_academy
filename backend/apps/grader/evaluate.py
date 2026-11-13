"""
Deterministic evaluation: compares sandbox results with expected values (which never
leave the trusted server), runs static quality checks, and computes a rubric score.
"""

from __future__ import annotations

import ast
import math
from dataclasses import asdict, dataclass, field

from .sandbox import CaseResult, run_code

DEFAULT_RUBRIC = {"correctness": 0.6, "quality": 0.2, "independence": 0.2}
# Independence credit by the highest hint level a learner opened (transparent, see CURRICULUM.md).
INDEPENDENCE_BY_HINT_LEVEL = {0: 1.0, 1: 0.9, 2: 0.8, 3: 0.65, 4: 0.5, 5: 0.3}


@dataclass
class TestOutcome:
    test_id: int
    name: str
    visible: bool
    passed: bool
    message: str
    stdin: str | None = None
    expected: str | dict | None = None
    actual: str | dict | None = None
    error: dict | None = None


@dataclass
class QualityOutcome:
    rule: str
    passed: bool
    message: str


@dataclass
class Evaluation:
    passed: bool
    score: float
    breakdown: dict
    tests: list[TestOutcome] = field(default_factory=list)
    quality: list[QualityOutcome] = field(default_factory=list)
    timed_out: bool = False

    def to_dict(self):
        return asdict(self)


# --- Output comparison -------------------------------------------------------

def _normalize_token(tok: str):
    try:
        num = float(tok.replace(",", ""))
        if math.isfinite(num):
            return ("num", round(num, 6))
    except ValueError:
        pass
    return ("str", tok.lower())


def _normalize_line(line: str):
    return tuple(_normalize_token(t) for t in line.strip().rstrip(".!").split())


def stdout_matches(actual: str, expected: str, mode: str) -> bool:
    if mode == "exact":
        # Every output line must match, nothing extra (normalised as below).
        want = [_normalize_line(l) for l in expected.strip().splitlines() if l.strip()]
        have = [_normalize_line(l) for l in actual.splitlines() if l.strip()]
        return want == have
    if mode == "contains":
        return expected.strip().lower() in actual.lower()
    # "lines": expected lines must appear, in order, among output lines (prompts allowed between).
    # Numbers compare numerically (1400 == 1400.0); case and trailing punctuation are ignored.
    want = [_normalize_line(l) for l in expected.strip().splitlines() if l.strip()]
    have = [_normalize_line(l) for l in actual.splitlines() if l.strip()]
    i = 0
    for line in have:
        if i < len(want) and line == want[i]:
            i += 1
    return i == len(want)


def _decode(v):
    if isinstance(v, dict) and "items" in v and v.get("__type__") in {"list", "tuple"}:
        return [_decode(x) for x in v["items"]]
    if isinstance(v, dict) and v.get("__type__") == "dict":
        return {str(_decode(k)): _decode(x) for k, x in v["items"]}
    return v


def values_equal(actual, expected) -> bool:
    actual = _decode(actual)
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        return isinstance(actual, (int, float)) and not isinstance(actual, bool) and math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-9)
    return actual == expected


def check_case(test, result: CaseResult) -> TestOutcome:
    visible = test.visible
    base = dict(test_id=test.pk, name=test.name, visible=visible, error=result.error)
    if visible:
        base["stdin"] = test.stdin
    if result.error and result.error.get("type") in {"TimeoutError", "StepLimitExceeded", "SyntaxError", "RunnerError", "CodeTooLong"}:
        return TestOutcome(passed=False, message=result.error["message"], actual=result.printed if visible else None, **base)

    if test.kind == "stdout":
        exp = test.expected["stdout"]
        # Compare what the program printed; input prompts and echoed input are excluded.
        ok = stdout_matches(result.printed, exp, test.expected.get("match", "lines"))
        if result.error and ok is False:
            msg = f"Your program stopped with {result.error['type']}: {result.error['message']}"
        elif ok:
            msg = "Output matches."
        else:
            msg = test.failure_hint or "The output is different from what was expected."
        out = TestOutcome(passed=ok and not result.error, message=msg, **base)
        if visible:
            out.expected, out.actual = exp, result.printed
        return out

    expected_vars = test.expected["variables"]
    wrong = []
    for name, value in expected_vars.items():
        if name not in result.variables:
            wrong.append(f"variable '{name}' was not created")
        elif not values_equal(result.variables[name], value):
            wrong.append(f"'{name}' has a different value than expected")
    ok = not wrong and not result.error
    if result.error:
        msg = f"Your program stopped with {result.error['type']}: {result.error['message']}"
    elif ok:
        msg = "Variables hold the expected values."
    else:
        msg = "; ".join(wrong) + (f". {test.failure_hint}" if test.failure_hint else "")
    out = TestOutcome(passed=ok, message=msg, **base)
    if visible:
        out.expected = expected_vars
        out.actual = {k: _decode(result.variables.get(k)) for k in expected_vars}
    return out


# --- Static quality checks (AST only: learner code is parsed, never executed here) ---

OPERATORS = {"+": ast.Add, "-": ast.Sub, "*": ast.Mult, "/": ast.Div, "//": ast.FloorDiv, "%": ast.Mod}


def run_quality_checks(code: str, checks: list[dict]) -> list[QualityOutcome]:
    if not checks:
        return []
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return [QualityOutcome(c["rule"], False, "Fix the syntax error first.") for c in checks]
    nodes = list(ast.walk(tree))
    outcomes = []
    for c in checks:
        rule = c["rule"]
        if rule == "defines_variable":
            ok = any(isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store) and n.id == c["name"] for n in nodes)
        elif rule == "uses_input":
            ok = any(isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "input" for n in nodes)
        elif rule == "uses_operator":
            op = OPERATORS[c["op"]]
            ok = any(isinstance(n, (ast.BinOp, ast.AugAssign)) and isinstance(n.op, op) for n in nodes)
        elif rule == "uses_loop":
            ok = any(isinstance(n, (ast.For, ast.While)) for n in nodes)
        elif rule == "uses_if":
            ok = any(isinstance(n, (ast.If, ast.IfExp)) for n in nodes)
        elif rule == "uses_fstring":
            ok = any(isinstance(n, ast.JoinedStr) for n in nodes)
        elif rule == "no_hardcoded_output":
            banned = {str(v) for v in c.get("values", [])}
            ok = True
            for n in nodes:
                if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "print":
                    for arg in n.args:
                        if isinstance(arg, ast.Constant) and any(b in str(arg.value) for b in banned):
                            ok = False
        else:
            ok = False
        outcomes.append(QualityOutcome(rule, ok, "Looks good." if ok else c["message"]))
    return outcomes


def compute_score(rubric: dict, correctness: float, quality: float, independence: float) -> tuple[float, dict]:
    weights = rubric or DEFAULT_RUBRIC
    parts = {"correctness": correctness, "quality": quality, "independence": independence}
    score = sum(weights.get(k, 0) * v for k, v in parts.items())
    breakdown = {k: {"weight": weights.get(k, 0), "value": round(v, 3)} for k, v in parts.items()}
    return round(score * 100, 1), breakdown


def evaluate_code(challenge, code: str, max_hint_level: int = 0, include_hidden: bool = True) -> Evaluation:
    tests = list(challenge.tests.all())
    if not include_hidden:
        tests = [t for t in tests if t.visible]
    run = run_code(code, [t.stdin for t in tests])
    outcomes = [check_case(t, r) for t, r in zip(tests, run.cases)]
    total_w = sum(t.weight for t in tests) or 1
    correctness = sum(t.weight for t, o in zip(tests, outcomes) if o.passed) / total_w
    quality = run_quality_checks(code, challenge.quality_checks)
    blocking_failed = any(
        not q.passed and c.get("blocking") for q, c in zip(quality, challenge.quality_checks)
    )
    quality_score = (sum(q.passed for q in quality) / len(quality)) if quality else 1.0
    independence = INDEPENDENCE_BY_HINT_LEVEL.get(min(max_hint_level, 5), 0.3)
    score, breakdown = compute_score(challenge.rubric, correctness, quality_score, independence)
    passed = all(o.passed for o in outcomes) and not blocking_failed
    return Evaluation(passed=passed, score=score, breakdown=breakdown, tests=outcomes, quality=quality, timed_out=run.timed_out)
