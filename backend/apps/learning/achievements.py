"""
Achievement registry. Each achievement is granted only when its check finds real evidence
in the database (passed submissions, completed lessons) — never from client claims.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from django.db import transaction

from .models import Achievement, LessonProgress, Submission, UserAchievement
from .progression import award_xp


def _lesson_done(user, slug):
    return LessonProgress.objects.filter(user=user, lesson__slug=slug, status=LessonProgress.Status.COMPLETED).exists()


def _passed(user, **filters):
    return Submission.objects.filter(user=user, mode=Submission.Mode.SUBMIT, passed=True, **filters)


def _world_done(user, world_slug):
    from apps.curriculum.models import Lesson

    lessons = Lesson.objects.filter(module__world__slug=world_slug, published=True)
    done = LessonProgress.objects.filter(user=user, lesson__in=lessons, status=LessonProgress.Status.COMPLETED).count()
    return lessons.exists() and done == lessons.count()


@dataclass(frozen=True)
class AchievementDef:
    slug: str
    title: str
    description: str
    criteria: str
    icon: str
    xp: int
    check: Callable


REGISTRY = [
    AchievementDef("robot-navigator", "Robot Navigator", "You gave a machine precise instructions and it delivered.",
                   "Complete the Delivery Robot lesson.", "robot", 25, lambda u: _lesson_done(u, "delivery-robot")),
    AchievementDef("bug-detective", "Bug Detective", "You found what was wrong and fixed it.",
                   "Pass any debugging challenge.", "magnifier", 30, lambda u: _passed(u, challenge__tier="debug").exists()),
    AchievementDef("computational-thinker", "Computational Thinker", "You can break problems into precise steps.",
                   "Complete every lesson in Discover Programming.", "compass", 50, lambda u: _world_done(u, "discover")),
    AchievementDef("first-programmer", "First Programmer", "Your first Python program passed real tests.",
                   "Pass your first Python challenge.", "spark", 25, lambda u: _passed(u, challenge__kind="code").exists()),
    AchievementDef("fare-engineer", "Fare Engineer", "You built a working fare calculator from variables and expressions.",
                   "Complete the Moto Fare Calculator mission.", "moto", 40, lambda u: _lesson_done(u, "moto-fare-calculator")),
    AchievementDef("independent-solver", "Independent Problem Solver", "You transferred a concept to a brand-new problem on your own.",
                   "Pass a transfer challenge without opening any hints.", "summit", 40,
                   lambda u: _passed(u, challenge__tier="transfer", hint_level=0).exists()),
    AchievementDef("logic-explorer", "Logic Explorer", "Your programs can make decisions.",
                   "Complete the Mobile Money Validator lesson.", "branch", 30, lambda u: _lesson_done(u, "mobile-money-validator")),
    AchievementDef("loop-master", "Loop Master", "You automated repetitive work with loops.",
                   "Complete the Delivery Route lesson.", "loop", 30, lambda u: _lesson_done(u, "delivery-route-loops")),
    AchievementDef("python-builder", "Python Builder", "You built a complete program combining everything so far.",
                   "Pass the Rider Day Summary capstone.", "trophy", 75, lambda u: _passed(u, challenge__tier="capstone").exists()),
]
BY_SLUG = {a.slug: a for a in REGISTRY}


def sync_achievements():
    for order, a in enumerate(REGISTRY):
        Achievement.objects.update_or_create(
            slug=a.slug,
            defaults={"title": a.title, "description": a.description, "criteria": a.criteria,
                      "icon": a.icon, "xp": a.xp, "order": order},
        )


@transaction.atomic
def evaluate_achievements(user) -> list[dict]:
    earned = set(UserAchievement.objects.filter(user=user).values_list("achievement__slug", flat=True))
    new = []
    for a in REGISTRY:
        if a.slug in earned or not a.check(user):
            continue
        achievement = Achievement.objects.filter(slug=a.slug).first()
        if not achievement:
            continue
        UserAchievement.objects.get_or_create(user=user, achievement=achievement, defaults={"evidence": {"criteria": a.criteria}})
        award_xp(user, a.xp, f"Achievement: {a.title}", f"achievement:{a.slug}")
        new.append({"slug": a.slug, "title": a.title, "description": a.description, "icon": a.icon, "xp": a.xp})
    return new
