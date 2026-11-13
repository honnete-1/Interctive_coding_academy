from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, username=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("role", User.Role.ADMIN)
        return self._create_user(email, password, **extra)


class User(AbstractUser):
    """Email-based login. `username` mirrors email for admin compatibility."""

    class Role(models.TextChoices):
        LEARNER = "learner", "Learner"
        MENTOR = "mentor", "Mentor"
        CONTENT_EDITOR = "content_editor", "Content editor"
        ADMIN = "admin", "Administrator"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.LEARNER)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email


class LearnerProfile(models.Model):
    class Experience(models.TextChoices):
        NONE = "none", "Never programmed"
        A_LITTLE = "a_little", "Tried a little"
        SOME = "some", "Built small programs"
        EXPERIENCED = "experienced", "Comfortable programmer"

    class Guidance(models.TextChoices):
        GUIDED = "guided", "Highly guided"
        BALANCED = "balanced", "Balanced"
        EXPLORATORY = "exploratory", "Exploratory"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    display_name = models.CharField(max_length=60)
    avatar = models.JSONField(default=dict, blank=True)  # {"base", "color", "accessory"}

    onboarding_completed = models.BooleanField(default=False)
    experience = models.CharField(max_length=20, choices=Experience.choices, default=Experience.NONE)
    motivation = models.CharField(max_length=200, blank=True)
    specializations = models.JSONField(default=list, blank=True)  # ["ml", "security", "devops"]
    interests = models.JSONField(default=list, blank=True)  # ["transport", "finance", ...]
    english_comfort = models.PositiveSmallIntegerField(default=3)  # 1..5
    guidance = models.CharField(max_length=20, choices=Guidance.choices, default=Guidance.GUIDED)
    weekly_minutes = models.PositiveIntegerField(default=120)
    diagnostic_score = models.PositiveSmallIntegerField(null=True, blank=True)

    # Display preferences are stored server-side so they follow the learner across devices.
    theme = models.CharField(max_length=10, default="system")  # light | dark | system
    reduced_motion = models.BooleanField(default=False)
    font_scale = models.FloatField(default=1.0)
    interface_mode = models.CharField(max_length=10, default="adventure")  # adventure | focus
    language = models.CharField(max_length=10, default="en")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile<{self.display_name}>"
