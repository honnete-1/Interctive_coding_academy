from django.contrib import admin

from .models import TutorInteraction


@admin.register(TutorInteraction)
class TutorInteractionAdmin(admin.ModelAdmin):
    list_display = ["user", "mode", "challenge_slug", "provider", "status", "input_tokens", "output_tokens", "created_at"]
    list_filter = ["provider", "status", "mode"]
