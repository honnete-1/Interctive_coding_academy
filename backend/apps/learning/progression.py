"""
Progression rules: unlocking, XP, levels, streaks, evidence-based mastery.
Every rule here is documented for learners in CURRICULUM.md ("How progress works").
"""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.curriculum.models import Challenge, Lesson, Skill

from .models import (
    ActivityResponse,
    LessonProgress,
    SkillEvidence,
    SkillMastery,
    Submission,
    XPTransaction,
)

EVIDENCE_POINTS = {"micro": 1, "debug": 2, "project": 2, "transfer": 3, "capstone": 3}
INDEPENDENCE_BONUS_RATIO = 0.2  # +20% XP for a first-time pass with no hints opened


# --- XP & levels ---------------------------------------------------------------

def award_xp(user, amount: int, reason: str, source_key: str) -> XPTransaction | None:
    """Idempotent: the same source_key never awards twice."""
    if amount <= 0:
        return None
    tx, created = XPTransaction.objects.get_or_create(
        user=user, source_key=source_key, defaults={"amount": amount, "reason": reason}
    )
    return tx if created else None


def total_xp(user) -> int:
    return XPTransaction.objects.filter(user=user).aggregate(s=Sum("amount"))["s"] or 0


def level_info(xp: int) -> dict:
    """Level L starts at 50*L*(L-1) XP: 0, 100, 300, 600, 1000, 1500 ..."""
    level = 1
    while xp >= 50 * (level + 1) * level:
        level += 1
    floor, ceiling = 50 * level * (level - 1), 50 * (level + 1) * level
    return {"level": level, "xp": xp, "level_floor": floor, "next_level_at": ceiling,
            "progress": round((xp - floor) / (ceiling - floor), 3)}


def activity_days(user) -> set:
    tz = timezone.get_current_timezone()
    dates = set()
    for ts in XPTransaction.objects.filter(user=user).values_list("created_at", flat=True):
        dates.add(ts.astimezone(tz).date())
    for ts in Submission.objects.filter(user=user).values_list("created_at", flat=True):
        dates.add(ts.astimezone(tz).date())
    return dates


def streak_info(user) -> dict:
    """Current streak survives until the end of the next day; breaks are never penalised."""
    days = activity_days(user)
    today = timezone.localdate()
    cursor = today if today in days else today - timedelta(days=1)
    current = 0
    while cursor in days:
        current += 1
        cursor -= timedelta(days=1)
    longest, run, prev = 0, 0, None
    for d in sorted(days):
        run = run + 1 if prev and d - prev == timedelta(days=1) else 1
        longest, prev = max(longest, run), d
    last7 = [(today - timedelta(days=i)) for i in range(6, -1, -1)]
    return {
        "current": current, "longest": longest,
        "active_days_last_7": sum(d in days for d in last7),
        "week": [{"date": d.isoformat(), "active": d in days} for d in last7],
    }


# --- Unlocking -----------------------------------------------------------------

def completed_lesson_ids(user) -> set[int]:
    return set(
        LessonProgress.objects.filter(user=user, status=LessonProgress.Status.COMPLETED).values_list("lesson_id", flat=True)
    )


def lesson_lock_reason(user, lesson: Lesson, completed: set[int] | None = None) -> str | None:
    completed = completed_lesson_ids(user) if completed is None else completed
    world = lesson.module.world
    if not world.is_available:
        return f"{world.title} is still being built."
    missing = [p for p in lesson.prerequisites.all() if p.id not in completed]
    if missing:
        return "Complete first: " + ", ".join(p.title for p in missing)
    world_missing = [p for p in world.prerequisite_lessons.all() if p.id not in completed]
    if world_missing:
        return "Unlock this world by completing: " + ", ".join(p.title for p in world_missing)
    return None


# --- Mastery -------------------------------------------------------------------

def mastery_level(points: int, has_transfer: bool, has_independent: bool, started: bool) -> str:
    L = SkillMastery.Level
    if points >= 8 and has_transfer and has_independent:
        return L.MASTERED
    if points >= 5 and has_transfer:
        return L.PROFICIENT
    if points >= 3:
        return L.DEVELOPING
    if points >= 1:
        return L.PRACTISING
    return L.EXPLORING if started else L.NOT_STARTED


def recompute_mastery(user, skill: Skill) -> SkillMastery:
    evidence = SkillEvidence.objects.filter(user=user, skill=skill)
    points = sum(e.points for e in evidence)
    has_transfer = evidence.filter(tier__in=["transfer", "capstone"]).exists()
    has_independent = evidence.filter(independent=True).exists()
    started = LessonProgress.objects.filter(user=user, lesson__skills=skill).exists()
    mastery, _ = SkillMastery.objects.get_or_create(user=user, skill=skill)
    mastery.points = points
    mastery.level = mastery_level(points, has_transfer, has_independent, started)
    mastery.save()
    return mastery


def mark_lesson_started(user, lesson: Lesson) -> LessonProgress:
    progress, created = LessonProgress.objects.get_or_create(user=user, lesson=lesson)
    if created:
        for skill in lesson.skills.all():
            recompute_mastery(user, skill)
    return progress


# --- Events ----------------------------------------------------------------------

@transaction.atomic
def on_challenge_passed(user, challenge: Challenge, submission: Submission) -> dict:
    """Records evidence + XP for the first passing submission. Safe to call repeatedly."""
    first_pass = not Submission.objects.filter(
        user=user, challenge=challenge, mode=Submission.Mode.SUBMIT, passed=True
    ).exclude(pk=submission.pk).exists()
    independent = submission.hint_level == 0
    awarded = []
    if first_pass:
        tx = award_xp(user, challenge.xp, f"Passed: {challenge.title}", f"challenge:{challenge.slug}")
        if tx:
            awarded.append({"amount": tx.amount, "reason": tx.reason})
        if independent:
            bonus = round(challenge.xp * INDEPENDENCE_BONUS_RATIO)
            tx = award_xp(user, bonus, f"Solved without hints: {challenge.title}", f"independent:{challenge.slug}")
            if tx:
                awarded.append({"amount": tx.amount, "reason": tx.reason})
        for skill in challenge.skills.all():
            SkillEvidence.objects.get_or_create(
                user=user, skill=skill, challenge=challenge,
                defaults={"submission": submission, "tier": challenge.tier,
                          "points": EVIDENCE_POINTS.get(challenge.tier, 1), "independent": independent},
            )
    mastery = [
        {"skill": m.skill.slug, "name": m.skill.name, "level": m.level}
        for m in (recompute_mastery(user, s) for s in challenge.skills.all())
    ]
    return {"first_pass": first_pass, "xp_awarded": awarded, "mastery": mastery}


def lesson_completion_status(user, lesson: Lesson) -> dict:
    """What is still needed to complete a lesson. Decided entirely from server-side records."""
    responses = {r.block_id: r for r in ActivityResponse.objects.filter(user=user, lesson=lesson)}
    passed = set(
        Submission.objects.filter(user=user, challenge__lesson=lesson, mode=Submission.Mode.SUBMIT, passed=True)
        .values_list("challenge__slug", flat=True)
    )
    required_challenges = {c.slug: c for c in lesson.challenges.all() if c.required}
    missing = []
    for block in lesson.blocks:
        btype = block["type"]
        if btype in {"predict", "sequence", "reflection"} and block.get("required", True):
            if block["id"] not in responses:
                missing.append({"block_id": block["id"], "type": btype, "reason": "Not answered yet"})
        elif btype == "challenge":
            slug = block["challenge"]
            if slug in required_challenges and slug not in passed:
                missing.append({"block_id": block["id"], "type": "challenge", "reason": f"Pass “{required_challenges[slug].title}”"})
    return {"complete": not missing, "missing": missing, "passed_challenges": sorted(passed)}


def lesson_assessment(user, lesson: Lesson) -> dict:
    """Multi-dimensional report (spec Part 12). Deterministic signals only, clearly labelled."""
    responses = list(ActivityResponse.objects.filter(user=user, lesson=lesson))
    checkable = [r for r in responses if r.block_type in {"predict", "sequence"}]
    understanding = (sum(bool(r.first_attempt_correct) for r in checkable) / len(checkable)) if checkable else None
    reflections = [r for r in responses if r.block_type == "reflection"]
    best = {}
    for s in Submission.objects.filter(user=user, challenge__lesson=lesson, mode=Submission.Mode.SUBMIT, passed=True):
        if s.challenge_id not in best or s.score > best[s.challenge_id].score:
            best[s.challenge_id] = s
    subs = list(best.values())

    def avg(key):
        vals = [s.breakdown.get(key, {}).get("value") for s in subs if s.breakdown.get(key)]
        return round(sum(vals) / len(vals), 3) if vals else None

    return {
        "functional_correctness": avg("correctness"),
        "understanding": round(understanding, 3) if understanding is not None else None,
        "independence": avg("independence"),
        "quality": avg("quality"),
        "reflection": 1.0 if reflections else (None if not any(b["type"] == "reflection" for b in lesson.blocks) else 0.0),
        "note": "Scores come from automated tests, static checks, first-try predictions and hint usage. No AI grading.",
    }


@transaction.atomic
def complete_lesson(user, lesson: Lesson) -> dict:
    status = lesson_completion_status(user, lesson)
    if not status["complete"]:
        return {"completed": False, **status}
    progress = mark_lesson_started(user, lesson)
    newly = progress.status != LessonProgress.Status.COMPLETED
    if newly:
        progress.status = LessonProgress.Status.COMPLETED
        progress.completed_at = timezone.now()
        progress.save()
    awarded = []
    tx = award_xp(user, lesson.xp, f"Completed lesson: {lesson.title}", f"lesson:{lesson.slug}")
    if tx:
        awarded.append({"amount": tx.amount, "reason": tx.reason})
    completed = completed_lesson_ids(user)
    unlocked = [
        {"slug": l.slug, "title": l.title}
        for l in lesson.unlocks.select_related("module__world").prefetch_related("prerequisites")
        if l.id not in completed and lesson_lock_reason(user, l, completed) is None
    ]
    return {"completed": True, "newly_completed": newly, "xp_awarded": awarded, "unlocked": unlocked, **status}


def next_lesson(user) -> Lesson | None:
    """First unlocked, uncompleted lesson in curriculum order (in-progress lessons first)."""
    completed = completed_lesson_ids(user)
    in_progress = (
        LessonProgress.objects.filter(user=user, status=LessonProgress.Status.IN_PROGRESS)
        .select_related("lesson").order_by("-updated_at").first()
    )
    if in_progress and in_progress.lesson.published:
        return in_progress.lesson
    # Continue along the path the learner is on: what their latest completion unlocked.
    latest = (
        LessonProgress.objects.filter(user=user, status=LessonProgress.Status.COMPLETED)
        .select_related("lesson").order_by("-completed_at").first()
    )
    if latest:
        for lesson in latest.lesson.unlocks.filter(published=True).order_by("module__world__order", "module__order", "order"):
            if lesson.id not in completed and lesson_lock_reason(user, lesson, completed) is None:
                return lesson
    lessons = Lesson.objects.filter(published=True, module__world__is_available=True).select_related("module__world").prefetch_related("prerequisites", "module__world__prerequisite_lessons")
    for lesson in lessons:
        if lesson.id not in completed and lesson_lock_reason(user, lesson, completed) is None:
            return lesson
    return None
