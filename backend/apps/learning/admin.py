from django.contrib import admin

from . import models


@admin.register(models.Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ["user", "challenge", "mode", "passed", "score", "created_at"]
    list_filter = ["mode", "passed", "challenge__tier"]
    readonly_fields = [f.name for f in models.Submission._meta.fields]


admin.site.register([models.LessonProgress, models.SkillMastery, models.XPTransaction, models.Achievement,
                     models.UserAchievement, models.PortfolioEntry, models.ActivityResponse])
