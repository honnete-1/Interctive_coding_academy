"""Loads validated YAML curriculum files into the database (idempotent upsert by slug)."""

from __future__ import annotations

from pathlib import Path

import yaml
from django.conf import settings
from django.db import transaction

from .models import Challenge, Lesson, Module, Skill, TestCase, World
from .schema import ContentError, validate_curriculum

CONTENT_DIR = settings.BASE_DIR / "content"

LESSON_KEYS_STORED_ELSEWHERE = {"challenges", "prerequisites", "skills"}


def read_curriculum_files(directory: Path = CONTENT_DIR) -> list[dict]:
    docs = []
    for path in sorted(directory.glob("*.yaml")):
        with path.open(encoding="utf-8") as fh:
            doc = yaml.safe_load(fh)
        try:
            validate_curriculum(doc)
        except ContentError as exc:
            raise ContentError(f"{path.name}: {exc}") from exc
        docs.append(doc)
    all_lessons = {l["slug"] for d in docs for m in d.get("modules", []) for l in m.get("lessons", [])}
    for d in docs:
        for m in d.get("modules", []):
            for l in m.get("lessons", []):
                missing = set(l.get("prerequisites", [])) - all_lessons
                if missing:
                    raise ContentError(f"lesson {l['slug']}: unknown prerequisites {sorted(missing)}")
        missing = set(d["world"].get("prerequisite_lessons", [])) - all_lessons
        if missing:
            raise ContentError(f"world {d['world']['slug']}: unknown prerequisite lessons {sorted(missing)}")
    return docs


def iter_challenges(docs: list[dict]):
    for d in docs:
        for m in d.get("modules", []):
            for l in m.get("lessons", []):
                for ch in l.get("challenges", []):
                    yield l, ch


@transaction.atomic
def load_curriculum(directory: Path = CONTENT_DIR) -> dict[str, int]:
    docs = read_curriculum_files(directory)
    counts = {"worlds": 0, "modules": 0, "lessons": 0, "challenges": 0, "tests": 0, "skills": 0}

    for d in docs:
        for s in d.get("skills", []):
            Skill.objects.update_or_create(
                slug=s["slug"], defaults={"name": s["name"], "description": s.get("description", "")}
            )
            counts["skills"] += 1

    lesson_prereqs: dict[str, list[str]] = {}
    world_prereqs: dict[str, list[str]] = {}
    for d in docs:
        w = d["world"]
        world, _ = World.objects.update_or_create(
            slug=w["slug"],
            defaults={
                "title": w["title"], "tagline": w["tagline"], "description": w["description"].strip(),
                "order": w["order"], "theme": w.get("theme", "teal"),
                "is_available": w.get("is_available", True),
                "prerequisite_note": w.get("prerequisite_note", ""),
            },
        )
        world_prereqs[world.slug] = w.get("prerequisite_lessons", [])
        counts["worlds"] += 1
        for s in d.get("skills", []):
            Skill.objects.filter(slug=s["slug"]).update(world=world)
        for s in d.get("skills", []):
            skill = Skill.objects.get(slug=s["slug"])
            skill.prerequisites.set(Skill.objects.filter(slug__in=s.get("prerequisites", [])))

        for mi, m in enumerate(d.get("modules", [])):
            module, _ = Module.objects.update_or_create(
                slug=m["slug"],
                defaults={"world": world, "title": m["title"], "description": m.get("description", "").strip(), "order": mi + 1},
            )
            counts["modules"] += 1
            for li, l in enumerate(m.get("lessons", [])):
                lesson, _ = Lesson.objects.update_or_create(
                    slug=l["slug"],
                    defaults={
                        "module": module, "title": l["title"], "summary": l["summary"], "order": li + 1,
                        "kind": l.get("kind", "lesson"), "xp": l.get("xp", 50),
                        "estimated_minutes": l.get("estimated_minutes", 15),
                        "objectives": l.get("objectives", []), "blocks": l["blocks"],
                        "content_version": l.get("version", 1), "published": l.get("published", True),
                    },
                )
                lesson.skills.set(Skill.objects.filter(slug__in=l.get("skills", [])))
                lesson_prereqs[lesson.slug] = l.get("prerequisites", [])
                counts["lessons"] += 1
                for ch in l.get("challenges", []):
                    challenge, _ = Challenge.objects.update_or_create(
                        slug=ch["slug"],
                        defaults={
                            "lesson": lesson, "title": ch["title"], "kind": ch.get("kind", "code"),
                            "tier": ch.get("tier", "micro"), "prompt": ch["prompt"].strip(),
                            "requirements": ch.get("requirements", []),
                            "starter_code": ch.get("starter_code", ""), "spec": ch.get("spec", {}),
                            "hints": ch.get("hints", []), "quality_checks": ch.get("quality_checks", []),
                            "rubric": ch.get("rubric", {}), "xp": ch.get("xp", 30),
                            "required": ch.get("required", True),
                        },
                    )
                    challenge.skills.set(Skill.objects.filter(slug__in=ch.get("skills", [])))
                    counts["challenges"] += 1
                    keep = []
                    for ti, t in enumerate(ch.get("tests", [])):
                        kind = t.get("kind", "stdout")
                        expected = (
                            {"stdout": t["stdout"], "match": t.get("match", "lines")}
                            if kind == "stdout" else {"variables": t["variables"]}
                        )
                        tc, _ = TestCase.objects.update_or_create(
                            challenge=challenge, order=ti + 1,
                            defaults={
                                "name": t["name"], "visible": t.get("visible", True), "kind": kind,
                                "stdin": t.get("stdin", ""), "expected": expected,
                                "weight": t.get("weight", 1), "failure_hint": t.get("hint", ""),
                            },
                        )
                        keep.append(tc.pk)
                        counts["tests"] += 1
                    challenge.tests.exclude(pk__in=keep).delete()

    for slug, prereqs in lesson_prereqs.items():
        Lesson.objects.get(slug=slug).prerequisites.set(Lesson.objects.filter(slug__in=prereqs))
    for slug, prereqs in world_prereqs.items():
        World.objects.get(slug=slug).prerequisite_lessons.set(Lesson.objects.filter(slug__in=prereqs))
    return counts
