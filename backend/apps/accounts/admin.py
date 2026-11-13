from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import LearnerProfile, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["email"]
    list_display = ["email", "role", "is_staff", "date_joined"]
    list_filter = ["role", "is_staff"]
    search_fields = ["email"]
    fieldsets = ((None, {"fields": ("email", "password", "role")}),
                 ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups")}))
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "password1", "password2", "role")}),)


@admin.register(LearnerProfile)
class LearnerProfileAdmin(admin.ModelAdmin):
    list_display = ["display_name", "user", "experience", "onboarding_completed"]
    search_fields = ["display_name", "user__email"]
