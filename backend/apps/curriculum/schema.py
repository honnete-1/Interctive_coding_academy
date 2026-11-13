"""
Lesson definition schema + validator.

Content is authored as YAML in backend/content/. `validate_curriculum` raises
ContentError with a precise path for every problem, so broken lessons never reach learners.
"""

from __future__ import annotations

import ast
from typing import Any

BLOCK_TYPES = {"story", "explain", "visual", "predict", "sequence", "xray", "challenge", "reflection"}
VISUAL_COMPONENTS = {"fare-explorer", "variable-lab", "logic-playground", "loop-simulator", "robot-preview"}
SCENES = {"moto", "robot", "momo", "rider", "computer", "bulb", "none"}
CHECKABLE_BLOCKS = {"predict", "sequence"}
TEST_MATCH_MODES = {"lines", "contains", "exact"}
QUALITY_RULES = {"defines_variable", "uses_input", "uses_operator", "uses_loop", "uses_if", "no_hardcoded_output", "uses_fstring"}
ROBOT_COMMANDS = {"forward", "left", "right", "pick", "drop"}
RUBRIC_KEYS = {"correctness", "quality", "independence"}
TIERS = {"micro", "project", "transfer", "debug", "capstone"}
LESSON_KINDS = {"lesson", "mission", "boss", "capstone"}


class ContentError(ValueError):
    pass


def _req(obj: dict, key: str, typ, path: str):
    if key not in obj:
        raise ContentError(f"{path}: missing required field '{key}'")
    if not isinstance(obj[key], typ):
        raise ContentError(f"{path}.{key}: expected {getattr(typ, '__name__', typ)}")
    return obj[key]


def _validate_robot_spec(spec: dict, path: str):
    grid = _req(spec, "grid", list, path)
    if not grid or not all(isinstance(r, str) for r in grid):
        raise ContentError(f"{path}.grid: must be a list of strings")
    width = len(grid[0])
    if any(len(r) != width for r in grid):
        raise ContentError(f"{path}.grid: rows must have equal width")
    cells = "".join(grid)
    for symbol in "SPD":
        if cells.count(symbol) != 1:
            raise ContentError(f"{path}.grid: needs exactly one '{symbol}' (start, package, destination)")
    if set(cells) - set("SPD.#"):
        raise ContentError(f"{path}.grid: allowed symbols are S P D . #")
    if spec.get("facing", "E") not in {"N", "E", "S", "W"}:
        raise ContentError(f"{path}.facing: must be N/E/S/W")
    allowed = spec.get("allowed", sorted(ROBOT_COMMANDS | {"repeat"}))
    if set(allowed) - (ROBOT_COMMANDS | {"repeat"}):
        raise ContentError(f"{path}.allowed: unknown command")
    if "max_blocks" in spec and not isinstance(spec["max_blocks"], int):
        raise ContentError(f"{path}.max_blocks: must be int")


def validate_challenge(ch: dict, path: str) -> None:
    _req(ch, "slug", str, path)
    _req(ch, "title", str, path)
    _req(ch, "prompt", str, path)
    kind = ch.get("kind", "code")
    if kind not in {"code", "robot"}:
        raise ContentError(f"{path}.kind: must be code or robot")
    if ch.get("tier", "micro") not in TIERS:
        raise ContentError(f"{path}.tier: must be one of {sorted(TIERS)}")
    hints = ch.get("hints", [])
    if not isinstance(hints, list) or not all(isinstance(h, dict) and {"level", "text"} <= set(h) for h in hints):
        raise ContentError(f"{path}.hints: list of {{level, text}}")
    rubric = ch.get("rubric", {})
    if set(rubric) - RUBRIC_KEYS:
        raise ContentError(f"{path}.rubric: keys must be within {sorted(RUBRIC_KEYS)}")
    if rubric and abs(sum(rubric.values()) - 1.0) > 1e-6:
        raise ContentError(f"{path}.rubric: weights must sum to 1")

    if kind == "robot":
        _validate_robot_spec(_req(ch, "spec", dict, path), f"{path}.spec")
        return

    starter = ch.get("starter_code", "")
    try:
        ast.parse(starter)
    except SyntaxError as exc:
        # Debug challenges may deliberately ship broken code, but must say so.
        if ch.get("tier") != "debug":
            raise ContentError(f"{path}.starter_code: syntax error {exc}") from exc
    if "solution" in ch:
        try:
            ast.parse(ch["solution"])
        except SyntaxError as exc:
            raise ContentError(f"{path}.solution: syntax error {exc}") from exc

    for i, rule in enumerate(ch.get("quality_checks", [])):
        if not isinstance(rule, dict) or rule.get("rule") not in QUALITY_RULES:
            raise ContentError(f"{path}.quality_checks[{i}]: unknown rule")
        _req(rule, "message", str, f"{path}.quality_checks[{i}]")

    tests = _req(ch, "tests", list, path)
    if not tests:
        raise ContentError(f"{path}.tests: at least one test is required")
    if not any(t.get("visible", True) for t in tests):
        raise ContentError(f"{path}.tests: at least one visible test is required")
    for i, t in enumerate(tests):
        tp = f"{path}.tests[{i}]"
        _req(t, "name", str, tp)
        tkind = t.get("kind", "stdout")
        if tkind == "stdout":
            _req(t, "stdout", str, tp)
            if t.get("match", "lines") not in TEST_MATCH_MODES:
                raise ContentError(f"{tp}.match: one of {sorted(TEST_MATCH_MODES)}")
        elif tkind == "variables":
            _req(t, "variables", dict, tp)
        else:
            raise ContentError(f"{tp}.kind: stdout or variables")
        if "stdin" in t and not isinstance(t["stdin"], str):
            raise ContentError(f"{tp}.stdin: must be a string")


def validate_block(block: dict, path: str, challenge_slugs: set[str]) -> None:
    btype = _req(block, "type", str, path)
    _req(block, "id", str, path)
    if btype not in BLOCK_TYPES:
        raise ContentError(f"{path}.type: unknown block type '{btype}'")
    if btype == "story":
        _req(block, "body", str, path)
        if block.get("scene", "none") not in SCENES:
            raise ContentError(f"{path}.scene: unknown scene")
    elif btype == "explain":
        _req(block, "body", str, path)
    elif btype == "visual":
        if _req(block, "component", str, path) not in VISUAL_COMPONENTS:
            raise ContentError(f"{path}.component: unknown visual component")
        _req(block, "config", dict, path)
    elif btype == "predict":
        _req(block, "question", str, path)
        options = _req(block, "options", list, path)
        ids = {o.get("id") for o in options}
        if _req(block, "answer", str, path) not in ids:
            raise ContentError(f"{path}.answer: must match an option id")
        _req(block, "explanation", str, path)
    elif btype == "sequence":
        items = _req(block, "items", list, path)
        answer = _req(block, "answer", list, path)
        if sorted(answer) != sorted(i["id"] for i in items):
            raise ContentError(f"{path}.answer: must be a permutation of item ids")
        _req(block, "explanation", str, path)
    elif btype == "xray":
        code = _req(block, "code", str, path)
        try:
            ast.parse(code)
        except SyntaxError as exc:
            raise ContentError(f"{path}.code: syntax error {exc}") from exc
    elif btype == "challenge":
        if _req(block, "challenge", str, path) not in challenge_slugs:
            raise ContentError(f"{path}.challenge: no challenge '{block['challenge']}' in this lesson")
    elif btype == "reflection":
        _req(block, "prompt", str, path)


def validate_lesson(lesson: dict, path: str) -> None:
    for key, typ in [("slug", str), ("title", str), ("summary", str), ("blocks", list)]:
        _req(lesson, key, typ, path)
    if lesson.get("kind", "lesson") not in LESSON_KINDS:
        raise ContentError(f"{path}.kind: must be one of {sorted(LESSON_KINDS)}")
    challenges = lesson.get("challenges", [])
    slugs = set()
    for i, ch in enumerate(challenges):
        validate_challenge(ch, f"{path}.challenges[{i}]")
        slugs.add(ch["slug"])
    ids = set()
    for i, block in enumerate(lesson["blocks"]):
        validate_block(block, f"{path}.blocks[{i}]", slugs)
        if block["id"] in ids:
            raise ContentError(f"{path}.blocks[{i}].id: duplicate id '{block['id']}'")
        ids.add(block["id"])
    referenced = {b["challenge"] for b in lesson["blocks"] if b["type"] == "challenge"}
    if slugs - referenced:
        raise ContentError(f"{path}: challenges not placed in any block: {sorted(slugs - referenced)}")


def validate_curriculum(doc: dict[str, Any]) -> None:
    """Validates a whole world file, plus cross-references (prerequisites, skills)."""
    world = _req(doc, "world", dict, "world")
    for key in ("slug", "title", "tagline", "description", "order"):
        if key not in world:
            raise ContentError(f"world: missing '{key}'")
    skill_slugs = {s["slug"] for s in doc.get("skills", [])}
    lesson_slugs: list[str] = []
    for mi, module in enumerate(doc.get("modules", [])):
        mp = f"modules[{mi}]"
        _req(module, "slug", str, mp)
        _req(module, "title", str, mp)
        for li, lesson in enumerate(module.get("lessons", [])):
            lp = f"{mp}.lessons[{li}]"
            validate_lesson(lesson, lp)
            for s in lesson.get("skills", []):
                if s not in skill_slugs:
                    raise ContentError(f"{lp}.skills: unknown skill '{s}'")
            for ch in lesson.get("challenges", []):
                for s in ch.get("skills", []):
                    if s not in skill_slugs:
                        raise ContentError(f"{lp}.challenges.{ch['slug']}.skills: unknown skill '{s}'")
            lesson_slugs.append(lesson["slug"])
    if len(lesson_slugs) != len(set(lesson_slugs)):
        raise ContentError("duplicate lesson slugs in world")
