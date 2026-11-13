import os

import pytest

os.environ.setdefault("CODEVERSE_TESTING", "1")


@pytest.fixture(autouse=True)
def _test_settings(settings):
    # Tests run the real sandbox runner in a separate process. Docker is used in production.
    settings.GRADER_BACKEND = os.environ.get("TEST_GRADER_BACKEND", "subprocess")
    settings.GRADER_ALLOW_UNSAFE_SUBPROCESS = True
    settings.NOVA_PROVIDER = "none"
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": []}


@pytest.fixture
def curriculum(db):
    from apps.curriculum.loader import load_curriculum
    from apps.learning.achievements import sync_achievements

    load_curriculum()
    sync_achievements()


@pytest.fixture
def client_user(db):
    from rest_framework.test import APIClient

    from apps.accounts.models import LearnerProfile, User

    user = User.objects.create_user(email="learner@example.com", password="a-strong-pass-123")
    LearnerProfile.objects.create(user=user, display_name="Aline")
    client = APIClient()
    client.force_authenticate(user)
    return client, user
