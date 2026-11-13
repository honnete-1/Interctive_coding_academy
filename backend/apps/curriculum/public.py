"""
Learner-facing projections of curriculum content.

Answer keys (`answer`, `explanation`), reference solutions and hidden test cases are
removed here. This is the only path by which lesson content reaches the API.
"""

from __future__ import annotations

import copy

from .models import Challenge, Lesson

SECRET_BLOCK_KEYS = {"answer", "explanation", "solution"}


def public_test(test) -> dict:
    data = {"id": test.pk, "name": test.name, "kind": test.kind}
    if test.stdin:
        data["stdin"] = test.stdin
    if test.kind == "stdout":
        data["expected_stdout"] = test.expected["stdout"]
        data["match"] = test.expected.get("match", "lines")
    else:
        data["expected_variables"] = test.expected["variables"]
    return data


def public_challenge(challenge: Challenge) -> dict:
    tests = list(challenge.tests.all())
    return {
        "id": challenge.pk,
        "slug": challenge.slug,
        "title": challenge.title,
        "kind": challenge.kind,
        "tier": challenge.tier,
        "prompt": challenge.prompt,
        "requirements": challenge.requirements,
        "starter_code": challenge.starter_code,
        "spec": challenge.spec,  # robot maps are not secret: the learner must see the map
        "xp": challenge.xp,
        "required": challenge.required,
        "hint_count": len(challenge.hints),
        "visible_tests": [public_test(t) for t in tests if t.visible],
        "hidden_test_count": sum(1 for t in tests if not t.visible),
        "skills": [s.slug for s in challenge.skills.all()],
    }


def public_blocks(lesson: Lesson) -> list[dict]:
    challenges = {c.slug: c for c in lesson.challenges.prefetch_related("tests", "skills")}
    blocks = []
    for block in lesson.blocks:
        b = {k: copy.deepcopy(v) for k, v in block.items() if k not in SECRET_BLOCK_KEYS}
        if block["type"] == "challenge":
            b["challenge"] = public_challenge(challenges[block["challenge"]])
        blocks.append(b)
    return blocks
