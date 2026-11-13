from django.conf import settings
from django.db import models


class TutorInteraction(models.Model):
    """One learner question + Nova reply. Stored for usage limits, cost monitoring and review."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tutor_interactions")
    mode = models.CharField(max_length=20)
    lesson_slug = models.CharField(max_length=80, blank=True)
    challenge_slug = models.CharField(max_length=80, blank=True)
    question = models.TextField()
    answer = models.TextField(blank=True)
    provider = models.CharField(max_length=20)
    model = models.CharField(max_length=60, blank=True)
    prompt_version = models.CharField(max_length=20)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, default="ok")  # ok | redacted | error | refused
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "-created_at"])]
