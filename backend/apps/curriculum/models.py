"""
Curriculum structure: World -> Module -> Lesson -> (content blocks + Challenges -> TestCases).

Lesson content is data-driven (validated YAML loaded by `manage.py load_curriculum`).
Answer keys and hidden tests live server-side only; see `apps.curriculum.public`.
"""

from django.db import models


class World(models.Model):
    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=80)
    tagline = models.CharField(max_length=160)
    description = models.TextField()
    order = models.PositiveSmallIntegerField()
    theme = models.CharField(max_length=20, default="teal")  # maps to a frontend palette
    is_available = models.BooleanField(default=True)  # False => "under construction", shown honestly
    prerequisite_note = models.CharField(max_length=200, blank=True)
    prerequisite_lessons = models.ManyToManyField("Lesson", blank=True, related_name="unlocks_worlds")

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return self.title


class Skill(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=80)
    description = models.CharField(max_length=240)
    world = models.ForeignKey(World, null=True, blank=True, on_delete=models.SET_NULL, related_name="skills")
    prerequisites = models.ManyToManyField("self", symmetrical=False, blank=True, related_name="unlocks")

    def __str__(self):
        return self.name


class Module(models.Model):
    world = models.ForeignKey(World, on_delete=models.CASCADE, related_name="modules")
    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=80)
    description = models.TextField()
    order = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["world__order", "order"]

    def __str__(self):
        return self.title


class Lesson(models.Model):
    class Kind(models.TextChoices):
        LESSON = "lesson", "Lesson"
        MISSION = "mission", "Mission"
        BOSS = "boss", "Boss battle"
        CAPSTONE = "capstone", "Capstone"

    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="lessons")
    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=100)
    summary = models.CharField(max_length=280)
    order = models.PositiveSmallIntegerField()
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.LESSON)
    xp = models.PositiveIntegerField(default=50)
    estimated_minutes = models.PositiveSmallIntegerField(default=15)
    objectives = models.JSONField(default=list)
    blocks = models.JSONField(default=list)  # validated content blocks (may contain answer keys)
    prerequisites = models.ManyToManyField("self", symmetrical=False, blank=True, related_name="unlocks")
    skills = models.ManyToManyField(Skill, blank=True, related_name="lessons")
    content_version = models.PositiveIntegerField(default=1)
    published = models.BooleanField(default=True)

    class Meta:
        ordering = ["module__world__order", "module__order", "order"]

    def __str__(self):
        return self.title


class Challenge(models.Model):
    class Kind(models.TextChoices):
        CODE = "code", "Python code"
        ROBOT = "robot", "Robot program"

    class Tier(models.TextChoices):
        MICRO = "micro", "Micro-build"
        PROJECT = "project", "Module project"
        TRANSFER = "transfer", "Transfer challenge"
        DEBUG = "debug", "Debug challenge"
        CAPSTONE = "capstone", "Capstone"

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="challenges")
    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=100)
    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.CODE)
    tier = models.CharField(max_length=10, choices=Tier.choices, default=Tier.MICRO)
    prompt = models.TextField()
    requirements = models.JSONField(default=list)
    starter_code = models.TextField(blank=True)
    spec = models.JSONField(default=dict, blank=True)  # robot map, etc.
    hints = models.JSONField(default=list)  # progressive ladder, authored
    quality_checks = models.JSONField(default=list)  # static (AST) checks
    rubric = models.JSONField(default=dict)  # category -> weight
    xp = models.PositiveIntegerField(default=30)
    required = models.BooleanField(default=True)
    skills = models.ManyToManyField(Skill, blank=True, related_name="challenges")

    def __str__(self):
        return self.slug


class TestCase(models.Model):
    class Kind(models.TextChoices):
        STDOUT = "stdout", "Program output"
        VARIABLES = "variables", "Variable values"

    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name="tests")
    order = models.PositiveSmallIntegerField()
    name = models.CharField(max_length=120)
    visible = models.BooleanField(default=True)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.STDOUT)
    stdin = models.TextField(blank=True)
    expected = models.JSONField()  # {"stdout": "...", "match": "lines"} or {"variables": {...}}
    weight = models.PositiveSmallIntegerField(default=1)
    failure_hint = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ["order"]
        unique_together = [("challenge", "order")]

    def __str__(self):
        return f"{self.challenge.slug}#{self.order}"
