"""Learner state: progress, submissions, evidence-based mastery, XP ledger, achievements, portfolio."""

from django.conf import settings
from django.db import models

from apps.curriculum.models import Challenge, Lesson, Skill, TestCase

User = settings.AUTH_USER_MODEL


class LessonProgress(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="lesson_progress")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="progress")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.IN_PROGRESS)
    current_block = models.PositiveSmallIntegerField(default=0)
    drafts = models.JSONField(default=dict, blank=True)  # challenge slug -> latest code (autosave)
    started_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("user", "lesson")]


class ActivityResponse(models.Model):
    """Answers to predict/sequence/reflection blocks. Correctness is decided server-side."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="activity_responses")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    block_id = models.CharField(max_length=60)
    block_type = models.CharField(max_length=20)
    response = models.JSONField()
    correct = models.BooleanField(null=True)  # None for reflections
    attempts = models.PositiveSmallIntegerField(default=1)
    first_attempt_correct = models.BooleanField(null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("user", "lesson", "block_id")]


class HintUsage(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="hint_usage")
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE)
    max_level = models.PositiveSmallIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("user", "challenge")]


class Submission(models.Model):
    class Mode(models.TextChoices):
        CHECK = "check", "Visible tests only"
        SUBMIT = "submit", "Full assessment"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="submissions")
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name="submissions")
    mode = models.CharField(max_length=8, choices=Mode.choices, default=Mode.SUBMIT)
    code = models.TextField(blank=True)
    program = models.JSONField(null=True, blank=True)  # robot programs
    passed = models.BooleanField(default=False)
    score = models.FloatField(default=0)
    breakdown = models.JSONField(default=dict)
    quality = models.JSONField(default=list)
    feedback = models.JSONField(default=dict)
    hint_level = models.PositiveSmallIntegerField(default=0)
    attempt_number = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "challenge", "-created_at"])]


class TestResult(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="test_results")
    test_case = models.ForeignKey(TestCase, null=True, on_delete=models.SET_NULL)
    name = models.CharField(max_length=120)
    visible = models.BooleanField()
    passed = models.BooleanField()
    message = models.CharField(max_length=500)


class SkillEvidence(models.Model):
    """One piece of evidence that a learner can apply a skill (drives mastery)."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="skill_evidence")
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE)
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE)
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE)
    tier = models.CharField(max_length=10)
    points = models.PositiveSmallIntegerField()
    independent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("user", "skill", "challenge")]


class SkillMastery(models.Model):
    class Level(models.TextChoices):
        NOT_STARTED = "not_started", "Not started"
        EXPLORING = "exploring", "Exploring"
        PRACTISING = "practising", "Practising"
        DEVELOPING = "developing", "Developing"
        PROFICIENT = "proficient", "Proficient"
        MASTERED = "mastered", "Mastered"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="mastery")
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE)
    level = models.CharField(max_length=12, choices=Level.choices, default=Level.NOT_STARTED)
    points = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("user", "skill")]


class XPTransaction(models.Model):
    """Append-only XP ledger. `source_key` is unique per user, so nothing is ever awarded twice."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="xp_transactions")
    amount = models.IntegerField()
    reason = models.CharField(max_length=160)
    source_key = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("user", "source_key")]
        ordering = ["-created_at"]


class Achievement(models.Model):
    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=80)
    description = models.CharField(max_length=240)
    criteria = models.CharField(max_length=240)  # human-readable, shown to learners
    icon = models.CharField(max_length=30, default="star")
    xp = models.PositiveIntegerField(default=25)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order"]


class UserAchievement(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="achievements")
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE)
    evidence = models.JSONField(default=dict)
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("user", "achievement")]
        ordering = ["-earned_at"]


class PortfolioEntry(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="portfolio")
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE)
    submission = models.ForeignKey(Submission, null=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=120)
    problem = models.TextField()
    technologies = models.JSONField(default=list)
    features = models.JSONField(default=list)
    code = models.TextField()
    tests_passed = models.PositiveSmallIntegerField(default=0)
    tests_total = models.PositiveSmallIntegerField(default=0)
    reflection = models.TextField(blank=True)
    repository_url = models.URLField(blank=True)
    deployment_url = models.URLField(blank=True)  # learner-provided; we never claim to have deployed it
    is_public = models.BooleanField(default=False)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.COMPLETED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("user", "challenge")]
