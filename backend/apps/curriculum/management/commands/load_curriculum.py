from django.core.management.base import BaseCommand, CommandError

from apps.curriculum.loader import load_curriculum
from apps.learning.achievements import sync_achievements
from apps.curriculum.schema import ContentError


class Command(BaseCommand):
    help = "Validate and load YAML curriculum from backend/content into the database."

    def handle(self, *args, **options):
        try:
            counts = load_curriculum()
            sync_achievements()
        except ContentError as exc:
            raise CommandError(f"Curriculum validation failed: {exc}") from exc
        self.stdout.write(self.style.SUCCESS("Loaded " + ", ".join(f"{v} {k}" for k, v in counts.items())))
