from __future__ import annotations

from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.audit import audit
from apps.curriculum.models import Challenge, Lesson, Skill, World
from apps.curriculum.public import public_blocks, public_challenge
from apps.grader.evaluate import evaluate_code
from apps.grader.robot import ProgramError, simulate
from apps.grader.sandbox import SandboxUnavailable

from . import progression
from .achievements import evaluate_achievements
from .models import (
    Achievement,
    ActivityResponse,
    HintUsage,
    LessonProgress,
    PortfolioEntry,
    SkillMastery,
    Submission,
    TestResult,
    UserAchievement,
    XPTransaction,
)


def _status_for(user, lesson, completed, progress_by_lesson):
    if lesson.id in completed:
        return "completed", None
    reason = progression.lesson_lock_reason(user, lesson, completed)
    if reason:
        return "locked", reason
    if lesson.id in progress_by_lesson:
        return "in_progress", None
    return "available", None


def _world_payload(user, world, completed, progress_by_lesson, include_lessons=True):
    modules = []
    total = done = 0
    for module in world.modules.all():
        lessons = []
        for lesson in module.lessons.all():
            if not lesson.published:
                continue
            st, reason = _status_for(user, lesson, completed, progress_by_lesson)
            total += 1
            done += st == "completed"
            lessons.append({
                "slug": lesson.slug, "title": lesson.title, "summary": lesson.summary, "kind": lesson.kind,
                "xp": lesson.xp, "estimated_minutes": lesson.estimated_minutes, "status": st, "lock_reason": reason,
            })
        modules.append({"slug": module.slug, "title": module.title, "description": module.description,
                        "lessons": lessons if include_lessons else None})
    return {
        "slug": world.slug, "title": world.title, "tagline": world.tagline, "description": world.description,
        "order": world.order, "theme": world.theme, "is_available": world.is_available,
        "prerequisite_note": world.prerequisite_note, "lesson_count": total, "completed_count": done,
        "modules": modules,
    }


def _worlds_queryset():
    return World.objects.prefetch_related(
        "prerequisite_lessons", "modules__lessons__prerequisites", "modules__lessons__module__world__prerequisite_lessons",
    )


class WorldListView(APIView):
    def get(self, request):
        completed = progression.completed_lesson_ids(request.user)
        progress = set(LessonProgress.objects.filter(user=request.user).values_list("lesson_id", flat=True))
        return Response([_world_payload(request.user, w, completed, progress) for w in _worlds_queryset()])


class WorldDetailView(APIView):
    def get(self, request, slug):
        world = get_object_or_404(_worlds_queryset(), slug=slug)
        completed = progression.completed_lesson_ids(request.user)
        progress = set(LessonProgress.objects.filter(user=request.user).values_list("lesson_id", flat=True))
        return Response(_world_payload(request.user, world, completed, progress))


def _get_unlocked_lesson(user, slug) -> Lesson:
    lesson = get_object_or_404(Lesson.objects.select_related("module__world"), slug=slug, published=True)
    reason = progression.lesson_lock_reason(user, lesson)
    if reason:
        raise PermissionDenied(reason)
    return lesson


def _response_payload(r: ActivityResponse, block: dict) -> dict:
    data = {"response": r.response, "correct": r.correct, "attempts": r.attempts}
    if block.get("type") in {"predict", "sequence"}:
        data["explanation"] = block.get("explanation")  # revealed only after answering
        data["answer"] = block.get("answer")
    return data


class LessonDetailView(APIView):
    def get(self, request, slug):
        lesson = get_object_or_404(
            Lesson.objects.select_related("module__world").prefetch_related("skills"), slug=slug, published=True
        )
        reason = progression.lesson_lock_reason(request.user, lesson)
        base = {
            "slug": lesson.slug, "title": lesson.title, "summary": lesson.summary, "kind": lesson.kind,
            "xp": lesson.xp, "estimated_minutes": lesson.estimated_minutes, "objectives": lesson.objectives,
            "skills": [{"slug": s.slug, "name": s.name} for s in lesson.skills.all()],
            "world": {"slug": lesson.module.world.slug, "title": lesson.module.world.title, "theme": lesson.module.world.theme},
            "module": {"slug": lesson.module.slug, "title": lesson.module.title},
            "locked": bool(reason), "lock_reason": reason,
        }
        if reason:
            return Response(base)
        progress = progression.mark_lesson_started(request.user, lesson)
        blocks_by_id = {b["id"]: b for b in lesson.blocks}
        responses = {
            r.block_id: _response_payload(r, blocks_by_id.get(r.block_id, {}))
            for r in ActivityResponse.objects.filter(user=request.user, lesson=lesson)
        }
        hint_levels = dict(
            HintUsage.objects.filter(user=request.user, challenge__lesson=lesson).values_list("challenge__slug", "max_level")
        )
        hints = {}
        for ch in lesson.challenges.all():
            level = hint_levels.get(ch.slug, 0)
            hints[ch.slug] = [h for h in ch.hints if h["level"] <= level]
        nxt = lesson.unlocks.filter(published=True).order_by("module__world__order", "module__order", "order").first()
        return Response({
            **base,
            "blocks": public_blocks(lesson),
            "progress": {
                "status": progress.status, "current_block": progress.current_block, "drafts": progress.drafts,
                "responses": responses, "hints": hints,
                "completion": progression.lesson_completion_status(request.user, lesson),
            },
            "next_lesson": {"slug": nxt.slug, "title": nxt.title} if nxt else None,
        })


class ProgressSerializer(serializers.Serializer):
    current_block = serializers.IntegerField(min_value=0, max_value=200, required=False)
    drafts = serializers.DictField(child=serializers.CharField(max_length=20000, allow_blank=True), required=False)


class LessonProgressView(APIView):
    """Autosave: current position + code drafts."""

    def post(self, request, slug):
        lesson = _get_unlocked_lesson(request.user, slug)
        s = ProgressSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        progress = progression.mark_lesson_started(request.user, lesson)
        if "current_block" in s.validated_data:
            progress.current_block = min(s.validated_data["current_block"], max(len(lesson.blocks) - 1, 0))
        valid_slugs = set(lesson.challenges.values_list("slug", flat=True))
        for key, code in s.validated_data.get("drafts", {}).items():
            if key in valid_slugs:
                progress.drafts[key] = code
        progress.save()
        return Response({"saved": True, "current_block": progress.current_block})


class ActivityResponseView(APIView):
    def post(self, request, slug, block_id):
        lesson = _get_unlocked_lesson(request.user, slug)
        block = next((b for b in lesson.blocks if b["id"] == block_id), None)
        if block is None or block["type"] not in {"predict", "sequence", "reflection"}:
            raise ValidationError({"block_id": "This block does not accept answers."})
        answer = request.data.get("response")
        if block["type"] == "predict":
            if answer not in {o["id"] for o in block["options"]}:
                raise ValidationError({"response": "Choose one of the options."})
            correct = answer == block["answer"]
        elif block["type"] == "sequence":
            if not isinstance(answer, list) or sorted(answer) != sorted(i["id"] for i in block["items"]):
                raise ValidationError({"response": "Order every item exactly once."})
            correct = answer == block["answer"]
        else:
            if not isinstance(answer, str):
                raise ValidationError({"response": "Write your reflection as text."})
            answer = answer.strip()[:4000]
            if len(answer) < block.get("min_chars", 20):
                raise ValidationError({"response": f"Write at least {block.get('min_chars', 20)} characters so your future self understands it."})
            correct = None
        r, created = ActivityResponse.objects.get_or_create(
            user=request.user, lesson=lesson, block_id=block_id,
            defaults={"block_type": block["type"], "response": answer, "correct": correct, "first_attempt_correct": correct},
        )
        if not created:
            r.response, r.correct, r.attempts = answer, correct, r.attempts + 1
            r.save()
        return Response(_response_payload(r, block))


class LessonCompleteView(APIView):
    def post(self, request, slug):
        lesson = _get_unlocked_lesson(request.user, slug)
        result = progression.complete_lesson(request.user, lesson)
        if result["completed"]:
            result["achievements"] = evaluate_achievements(request.user)
            result["assessment"] = progression.lesson_assessment(request.user, lesson)
            result["level"] = progression.level_info(progression.total_xp(request.user))
            audit("lesson.complete", request, lesson=lesson.slug)
        return Response(result)


def _get_challenge(user, slug) -> Challenge:
    challenge = get_object_or_404(Challenge.objects.select_related("lesson__module__world"), slug=slug)
    reason = progression.lesson_lock_reason(user, challenge.lesson)
    if reason or not challenge.lesson.published:
        raise PermissionDenied(reason or "Not available.")
    return challenge


class SubmissionThrottle(ScopedRateThrottle):
    pass


class CodeSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=20000, allow_blank=True, trim_whitespace=False, required=False)
    program = serializers.ListField(child=serializers.DictField(), max_length=80, required=False)


def _hint_level(user, challenge) -> int:
    hu = HintUsage.objects.filter(user=user, challenge=challenge).first()
    return hu.max_level if hu else 0


def _sandbox_unavailable(exc):
    return Response(
        {"error": {"code": "grader_unavailable",
                   "message": f"Automated grading is unavailable right now: {exc} Your code was not graded and nothing was recorded.",
                   "details": None}},
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


class ChallengeEvaluateView(APIView):
    """mode='check' runs visible tests only (no XP); mode='submit' runs all tests incl. hidden."""

    throttle_classes = [SubmissionThrottle]
    throttle_scope = "submissions"
    mode = Submission.Mode.SUBMIT

    def post(self, request, slug):
        challenge = _get_challenge(request.user, slug)
        s = CodeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        hint_level = _hint_level(request.user, challenge)
        attempt = Submission.objects.filter(user=request.user, challenge=challenge, mode=self.mode).count() + 1

        if challenge.kind == Challenge.Kind.ROBOT:
            return self._robot(request, challenge, s.validated_data.get("program"), hint_level, attempt)

        code = s.validated_data.get("code", "")
        try:
            evaluation = evaluate_code(challenge, code, hint_level, include_hidden=self.mode == Submission.Mode.SUBMIT)
        except SandboxUnavailable as exc:
            audit("grader.unavailable", request, challenge=challenge.slug, error=str(exc))
            return _sandbox_unavailable(exc)

        with transaction.atomic():
            submission = Submission.objects.create(
                user=request.user, challenge=challenge, mode=self.mode, code=code, passed=evaluation.passed,
                score=evaluation.score, breakdown=evaluation.breakdown,
                quality=[q.__dict__ for q in evaluation.quality], hint_level=hint_level, attempt_number=attempt,
            )
            TestResult.objects.bulk_create([
                TestResult(submission=submission, test_case_id=t.test_id, name=t.name, visible=t.visible,
                           passed=t.passed, message=t.message[:500])
                for t in evaluation.tests
            ])
            progress = progression.mark_lesson_started(request.user, challenge.lesson)
            progress.drafts[challenge.slug] = code
            progress.save(update_fields=["drafts", "updated_at"])
        payload = self._payload(submission, evaluation.to_dict())
        if self.mode == Submission.Mode.SUBMIT and evaluation.passed:
            payload["reward"] = progression.on_challenge_passed(request.user, challenge, submission)
            payload["reward"]["achievements"] = evaluate_achievements(request.user)
            if challenge.tier in {"project", "capstone", "transfer"}:
                self._portfolio(request.user, challenge, submission, evaluation)
        audit("grader.evaluate", request, challenge=challenge.slug, mode=self.mode, passed=evaluation.passed)
        return Response(payload)

    def _payload(self, submission, evaluation: dict) -> dict:
        tests = evaluation["tests"]
        return {
            "submission_id": submission.pk, "mode": submission.mode, "attempt": submission.attempt_number,
            "passed": evaluation["passed"], "score": evaluation["score"], "breakdown": evaluation["breakdown"],
            "tests": tests, "quality": evaluation["quality"], "timed_out": evaluation["timed_out"],
            "summary": {"passed": sum(t["passed"] for t in tests), "total": len(tests),
                        "hidden_total": sum(not t["visible"] for t in tests)},
            "grading": "deterministic",
        }

    def _robot(self, request, challenge, program, hint_level, attempt):
        if program is None:
            raise ValidationError({"program": "Send the robot program."})
        try:
            result = simulate(challenge.spec, program)
        except ProgramError as exc:
            raise ValidationError({"program": str(exc)})
        passed = result.success
        with transaction.atomic():
            submission = Submission.objects.create(
                user=request.user, challenge=challenge, mode=self.mode, program=program, passed=passed,
                score=100.0 if passed else 0.0, feedback={"outcome": result.outcome, "message": result.message},
                hint_level=hint_level, attempt_number=attempt,
            )
        payload = {"submission_id": submission.pk, "mode": self.mode, "passed": passed, "attempt": attempt,
                   "robot": result.to_dict(), "grading": "deterministic"}
        if self.mode == Submission.Mode.SUBMIT and passed:
            payload["reward"] = progression.on_challenge_passed(request.user, challenge, submission)
            payload["reward"]["achievements"] = evaluate_achievements(request.user)
        return Response(payload)

    def _portfolio(self, user, challenge, submission, evaluation):
        tests = evaluation.tests
        PortfolioEntry.objects.update_or_create(
            user=user, challenge=challenge,
            defaults={
                "submission": submission, "title": challenge.title, "problem": challenge.prompt,
                "technologies": ["Python"], "features": challenge.requirements, "code": submission.code,
                "tests_passed": sum(t.passed for t in tests), "tests_total": len(tests),
                "status": PortfolioEntry.Status.COMPLETED,
            },
        )


class ChallengeCheckView(ChallengeEvaluateView):
    mode = Submission.Mode.CHECK


class HintView(APIView):
    """Progressive authored hints. Opening a level records it (it affects the independence score)."""

    def post(self, request, slug):
        challenge = _get_challenge(request.user, slug)
        try:
            level = int(request.data.get("level", 1))
        except (TypeError, ValueError):
            raise ValidationError({"level": "Must be a number."})
        max_level = max((h["level"] for h in challenge.hints), default=0)
        if not 1 <= level <= max_level:
            raise ValidationError({"level": f"Hints for this challenge go from 1 to {max_level}."})
        hu, _ = HintUsage.objects.get_or_create(user=request.user, challenge=challenge)
        if level > hu.max_level + 1:
            raise ValidationError({"level": "Open hints one at a time."})
        hu.max_level = max(hu.max_level, level)
        hu.save()
        return Response({
            "hints": [h for h in challenge.hints if h["level"] <= hu.max_level],
            "max_level": max_level, "source": "authored",
        })


class SubmissionHistoryView(APIView):
    def get(self, request, slug):
        challenge = _get_challenge(request.user, slug)
        subs = Submission.objects.filter(user=request.user, challenge=challenge).prefetch_related("test_results")[:20]
        return Response([{
            "id": s.pk, "mode": s.mode, "passed": s.passed, "score": s.score, "attempt": s.attempt_number,
            "created_at": s.created_at, "hint_level": s.hint_level,
            "tests": [{"name": t.name, "visible": t.visible, "passed": t.passed} for t in s.test_results.all()],
        } for s in subs])


class ChallengeDetailView(APIView):
    def get(self, request, slug):
        return Response(public_challenge(_get_challenge(request.user, slug)))


# --- Dashboard, skills, achievements, portfolio, analytics ------------------------

def _skills_payload(user):
    mastery = {m.skill_id: m for m in SkillMastery.objects.filter(user=user)}
    return [{
        "slug": s.slug, "name": s.name, "description": s.description,
        "world": s.world.slug if s.world else None,
        "level": mastery[s.id].level if s.id in mastery else "not_started",
        "points": mastery[s.id].points if s.id in mastery else 0,
    } for s in Skill.objects.select_related("world").order_by("world__order", "id")]


class DashboardView(APIView):
    def get(self, request):
        user = request.user
        xp = progression.total_xp(user)
        nxt = progression.next_lesson(user)
        completed = progression.completed_lesson_ids(user)
        progress = set(LessonProgress.objects.filter(user=user).values_list("lesson_id", flat=True))
        worlds = [_world_payload(user, w, completed, progress) for w in _worlds_queryset()]
        skills = _skills_payload(user)
        recent_ach = UserAchievement.objects.filter(user=user).select_related("achievement")[:4]
        projects = PortfolioEntry.objects.filter(user=user).select_related("challenge")[:6]
        current_world = next((w for w in worlds if nxt and any(
            l["slug"] == nxt.slug for m in w["modules"] for l in m["lessons"])), worlds[0] if worlds else None)
        recommendations = []
        if nxt:
            recommendations.append({"kind": "lesson", "title": f"Continue: {nxt.title}", "href": f"/learn/{nxt.slug}",
                                    "reason": "Next step on your path."})
        practising = [s for s in skills if s["level"] in {"practising", "developing"}]
        for s in practising[:2]:
            recommendations.append({"kind": "skill", "title": f"Strengthen {s['name']}", "href": "/skills",
                                    "reason": "A transfer challenge would move this skill to Proficient."})
        recommendations.append({"kind": "lab", "title": "Experiment in the Visual Lab", "href": "/lab",
                                "reason": "Run any Python and watch every variable change."})
        return Response({
            "profile": {"display_name": user.profile.display_name, "avatar": user.profile.avatar,
                        "interests": user.profile.interests, "specializations": user.profile.specializations,
                        "guidance": user.profile.guidance, "interface_mode": user.profile.interface_mode},
            "level": progression.level_info(xp),
            "streak": progression.streak_info(user),
            "continue": {"slug": nxt.slug, "title": nxt.title, "summary": nxt.summary,
                         "world": nxt.module.world.title, "module": nxt.module.title} if nxt else None,
            "current_world": current_world["slug"] if current_world else None,
            "worlds": worlds,
            "skills": skills,
            "recent_achievements": [{"slug": ua.achievement.slug, "title": ua.achievement.title, "icon": ua.achievement.icon,
                                     "earned_at": ua.earned_at} for ua in recent_ach],
            "projects": [{"id": p.pk, "title": p.title, "tests_passed": p.tests_passed, "tests_total": p.tests_total,
                          "updated_at": p.updated_at} for p in projects],
            "recent_xp": [{"amount": t.amount, "reason": t.reason, "created_at": t.created_at}
                          for t in XPTransaction.objects.filter(user=user)[:6]],
            "recommendations": recommendations,
        })


class SkillsView(APIView):
    def get(self, request):
        return Response(_skills_payload(request.user))


class AchievementsView(APIView):
    def get(self, request):
        earned = {ua.achievement_id: ua for ua in UserAchievement.objects.filter(user=request.user)}
        return Response([{
            "slug": a.slug, "title": a.title, "description": a.description, "criteria": a.criteria,
            "icon": a.icon, "xp": a.xp, "earned": a.id in earned,
            "earned_at": earned[a.id].earned_at if a.id in earned else None,
        } for a in Achievement.objects.all()])


class XPLedgerView(APIView):
    def get(self, request):
        txs = XPTransaction.objects.filter(user=request.user)[:100]
        return Response({
            "total": progression.total_xp(request.user),
            "transactions": [{"amount": t.amount, "reason": t.reason, "created_at": t.created_at} for t in txs],
        })


class PortfolioEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = PortfolioEntry
        fields = ["id", "title", "problem", "technologies", "features", "code", "tests_passed", "tests_total",
                  "reflection", "repository_url", "deployment_url", "is_public", "status", "created_at", "updated_at"]
        read_only_fields = ["id", "title", "problem", "technologies", "features", "code", "tests_passed",
                            "tests_total", "status", "created_at", "updated_at"]


class PortfolioListView(APIView):
    def get(self, request):
        entries = PortfolioEntry.objects.filter(user=request.user).order_by("-updated_at")
        return Response(PortfolioEntrySerializer(entries, many=True).data)


class PortfolioDetailView(APIView):
    def patch(self, request, pk):
        entry = get_object_or_404(PortfolioEntry, pk=pk, user=request.user)  # ownership check
        s = PortfolioEntrySerializer(entry, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class AnalyticsView(APIView):
    def get(self, request):
        user = request.user
        subs = Submission.objects.filter(user=user, mode=Submission.Mode.SUBMIT)
        per_challenge = (
            subs.values("challenge__slug", "challenge__title", "challenge__tier")
            .annotate(attempts=Count("id"), passes=Count("id", filter=Q(passed=True)))
            .order_by("challenge__lesson__module__world__order", "challenge__lesson__order")
        )
        history = [{"challenge": s.challenge.title, "passed": s.passed, "score": s.score, "created_at": s.created_at,
                    "hint_level": s.hint_level}
                   for s in subs.select_related("challenge")[:30]]
        lessons_done = LessonProgress.objects.filter(user=user, status=LessonProgress.Status.COMPLETED).select_related("lesson")
        return Response({
            "streak": progression.streak_info(user),
            "level": progression.level_info(progression.total_xp(user)),
            "skills": _skills_payload(user),
            "challenges": list(per_challenge),
            "history": history,
            "lessons_completed": [{"slug": p.lesson.slug, "title": p.lesson.title, "completed_at": p.completed_at,
                                   "assessment": progression.lesson_assessment(user, p.lesson)}
                                  for p in lessons_done],
        })
