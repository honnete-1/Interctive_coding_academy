from django.contrib import admin

from .models import Challenge, Lesson, Module, Skill, TestCase, World


class TestCaseInline(admin.TabularInline):
    model = TestCase
    extra = 0


@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = ["slug", "title", "lesson", "kind", "tier", "xp"]
    list_filter = ["kind", "tier"]
    inlines = [TestCaseInline]


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ["slug", "title", "module", "kind", "order", "published"]
    list_filter = ["module__world", "kind", "published"]
    filter_horizontal = ["prerequisites", "skills"]


admin.site.register([World, Module, Skill])
