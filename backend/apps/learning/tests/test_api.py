import json

import pytest
from rest_framework.test import APIClient

from apps.curriculum.loader import iter_challenges, read_curriculum_files
from apps.learning.models import LessonProgress, Submission, XPTransaction

SOLUTIONS = {c["slug"]: c.get("solution") for _, c in iter_challenges(read_curriculum_files())}
ROBOT = {
    "robot-straight-road": [{"cmd": c} for c in ["forward", "forward", "pick", "forward", "forward", "drop"]],
    "robot-turning-corners": [{"cmd": c} for c in ["forward", "right", "forward", "left", "forward", "pick", "right", "forward", "drop"]],
}

pytestmark = pytest.mark.django_db


def complete_lesson(client, slug):
    """Answers every activity and passes every challenge of a lesson using reference solutions."""
    lesson = client.get(f"/api/lessons/{slug}").json()
    for block in lesson["blocks"]:
        t = block["type"]
        if t == "predict":
            client.post(f"/api/lessons/{slug}/activities/{block['id']}", {"response": block["options"][0]["id"]}, format="json")
        elif t == "sequence":
            client.post(f"/api/lessons/{slug}/activities/{block['id']}", {"response": [i["id"] for i in block["items"]]}, format="json")
        elif t == "reflection":
            client.post(f"/api/lessons/{slug}/activities/{block['id']}", {"response": "I split the problem into steps, tested the edge cases, and explained each idea in my own words."}, format="json")
        elif t == "challenge":
            ch = block["challenge"]
            body = {"program": ROBOT[ch["slug"]]} if ch["kind"] == "robot" else {"code": SOLUTIONS[ch["slug"]]}
            r = client.post(f"/api/challenges/{ch['slug']}/submit", body, format="json")
            assert r.json()["passed"], r.json()
    return client.post(f"/api/lessons/{slug}/complete").json()


def test_register_login_logout_flow(db):
    c = APIClient(enforce_csrf_checks=True)
    csrf = c.get("/api/auth/csrf").json()["csrfToken"]
    r = c.post("/api/auth/register", {"email": "New@Example.com", "password": "kigali-moto-2026", "display_name": "Eric"},
               format="json", HTTP_X_CSRFTOKEN=csrf)
    assert r.status_code == 201, r.json()
    assert r.json()["email"] == "new@example.com"
    assert c.get("/api/auth/me").status_code == 200
    csrf = c.cookies["csrftoken"].value
    assert c.post("/api/auth/logout", HTTP_X_CSRFTOKEN=csrf).status_code == 204
    assert c.get("/api/auth/me").status_code == 403
    csrf = c.get("/api/auth/csrf").json()["csrfToken"]
    bad = c.post("/api/auth/login", {"email": "new@example.com", "password": "wrong-password"}, format="json", HTTP_X_CSRFTOKEN=csrf)
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "invalid_credentials"
    ok = c.post("/api/auth/login", {"email": "new@example.com", "password": "kigali-moto-2026"}, format="json", HTTP_X_CSRFTOKEN=csrf)
    assert ok.status_code == 200


def test_csrf_is_enforced_for_session_auth(db):
    c = APIClient(enforce_csrf_checks=True)
    r = c.post("/api/auth/register", {"email": "x@example.com", "password": "kigali-moto-2026", "display_name": "X"}, format="json")
    assert r.status_code == 403


def test_weak_password_and_duplicate_email_rejected(client_user):
    c = APIClient()
    r = c.post("/api/auth/register", {"email": "learner@example.com", "password": "kigali-moto-2026", "display_name": "A"}, format="json")
    assert r.status_code == 400 and "email" in r.json()["error"]["details"]
    r = c.post("/api/auth/register", {"email": "z@example.com", "password": "12345678", "display_name": "A"}, format="json")
    assert r.status_code == 400 and "password" in r.json()["error"]["details"]


def test_onboarding_saves_preferences_and_scores_diagnostic(client_user):
    client, user = client_user
    r = client.post("/api/onboarding", {
        "experience": "some", "motivation": "Build apps for my shop", "interests": ["transport", "finance"],
        "specializations": ["ml"], "english_comfort": 4, "guidance": "balanced", "weekly_minutes": 180,
        "diagnostic_answers": {"d1": "6", "d2": "b", "d3": "2", "d4": "TypeError"},
    }, format="json")
    assert r.status_code == 200, r.json()
    user.profile.refresh_from_db()
    assert user.profile.onboarding_completed and user.profile.diagnostic_score == 3
    assert client.post("/api/onboarding", {"interests": ["astrology"]}, format="json").status_code == 400


def test_lesson_payload_never_leaks_answers_or_hidden_tests(client_user, curriculum):
    client, _ = client_user
    data = client.get("/api/lessons/what-is-programming").json()
    raw = json.dumps(data)
    assert '"answer"' not in raw and '"explanation"' not in raw
    complete_lesson(client, "what-is-programming")
    client.post("/api/lessons/hello-python/complete")
    complete_lesson(client, "hello-python")
    moto = client.get("/api/lessons/moto-fare-calculator").json()
    raw = json.dumps(moto)
    assert "Total fare: 2700 RWF" not in raw  # hidden expected output
    assert "10\\n250" not in raw  # hidden input
    assert "solution" not in raw
    project = next(b for b in moto["blocks"] if b["type"] == "challenge" and b["challenge"]["slug"] == "fare-calculator-input")
    assert project["challenge"]["hidden_test_count"] == 3
    assert len(project["challenge"]["visible_tests"]) == 1


def test_locked_lessons_cannot_be_opened_or_submitted(client_user, curriculum):
    client, _ = client_user
    data = client.get("/api/lessons/moto-fare-calculator").json()
    assert data["locked"] and "blocks" not in data
    r = client.post("/api/challenges/fare-change-values/submit", {"code": "print(1)"}, format="json")
    assert r.status_code == 403
    assert client.get("/api/lessons/ml-anything").status_code == 404


def test_activity_answers_are_checked_server_side(client_user, curriculum):
    client, user = client_user
    r = client.post("/api/lessons/what-is-programming/activities/literal", {"response": "a"}, format="json").json()
    assert r["correct"] is False and r["explanation"]
    r = client.post("/api/lessons/what-is-programming/activities/literal", {"response": "b"}, format="json").json()
    assert r["correct"] is True and r["attempts"] == 2
    assert client.post("/api/lessons/what-is-programming/activities/literal", {"response": "zzz"}, format="json").status_code == 400
    assert client.post("/api/lessons/what-is-programming/activities/reflect", {"response": "short"}, format="json").status_code == 400


def test_full_moto_fare_vertical_slice(client_user, curriculum):
    """Spec Part 18: run → fail → fix → assessment → XP → achievement → dashboard → unlock."""
    client, user = client_user
    complete_lesson(client, "what-is-programming")
    complete_lesson(client, "hello-python")

    # Visible-test check gives feedback without awarding anything.
    check = client.post("/api/challenges/fare-calculator-input/check", {"code": "print('Total fare: 1400 RWF')"}, format="json").json()
    assert check["passed"] is True and check["summary"]["hidden_total"] == 0
    assert not XPTransaction.objects.filter(user=user, source_key="challenge:fare-calculator-input").exists()

    # Hardcoding the visible answer fails the hidden tests, which reveal names but not inputs.
    sub = client.post("/api/challenges/fare-calculator-input/submit", {"code": "print('Total fare: 1400 RWF')"}, format="json").json()
    assert sub["passed"] is False
    hidden = [t for t in sub["tests"] if not t["visible"]]
    assert hidden and all(t["stdin"] is None and t["expected"] is None and t["actual"] is None for t in hidden)
    assert any(not q["passed"] for q in sub["quality"])

    # Runtime errors come back with type and line.
    err = client.post("/api/challenges/fare-calculator-input/submit", {"code": "distance = int(input())\nprint(distanse)"}, format="json").json()
    assert err["tests"][0]["error"]["type"] == "NameError" and err["tests"][0]["error"]["line"] == 2

    # Completing early is refused with the list of what is missing.
    early = client.post("/api/lessons/moto-fare-calculator/complete").json()
    assert early["completed"] is False and early["missing"]

    result = complete_lesson(client, "moto-fare-calculator")
    assert result["completed"] and result["newly_completed"]
    assert {u["slug"] for u in result["unlocked"]} == {"mobile-money-validator"}
    assert "fare-engineer" in {a["slug"] for a in result["achievements"]}
    assert result["assessment"]["functional_correctness"] == 1.0

    # Rewards are idempotent: re-submitting and re-completing award nothing more.
    xp_before = sum(XPTransaction.objects.filter(user=user).values_list("amount", flat=True))
    client.post("/api/challenges/fare-calculator-input/submit", {"code": SOLUTIONS["fare-calculator-input"]}, format="json")
    client.post("/api/lessons/moto-fare-calculator/complete")
    assert sum(XPTransaction.objects.filter(user=user).values_list("amount", flat=True)) == xp_before

    dash = client.get("/api/dashboard").json()
    assert dash["level"]["xp"] == xp_before
    assert dash["continue"]["slug"] == "mobile-money-validator"
    skills = {s["slug"]: s["level"] for s in dash["skills"]}
    assert skills["input-output"] in {"developing", "proficient", "mastered"}
    assert dash["projects"]  # project + transfer entries were added to the portfolio
    assert any(a["slug"] == "fare-engineer" for a in dash["recent_achievements"])


def test_independence_bonus_only_without_hints(client_user, curriculum):
    client, user = client_user
    complete_lesson(client, "what-is-programming")
    assert client.post("/api/challenges/hello-two-lines/hints", {"level": 2}, format="json").status_code == 400  # one at a time
    hints = client.post("/api/challenges/hello-two-lines/hints", {"level": 1}, format="json").json()
    assert len(hints["hints"]) == 1 and hints["source"] == "authored"
    r = client.post("/api/challenges/hello-two-lines/submit", {"code": SOLUTIONS["hello-two-lines"]}, format="json").json()
    assert r["passed"] and r["breakdown"]["independence"]["value"] == 0.9
    assert not XPTransaction.objects.filter(user=user, source_key="independent:hello-two-lines").exists()
    assert XPTransaction.objects.filter(user=user, source_key="challenge:hello-two-lines").exists()


def test_robot_submission_is_simulated_server_side(client_user, curriculum):
    client, user = client_user
    complete_lesson(client, "what-is-programming")
    crash = client.post("/api/challenges/robot-straight-road/submit", {"program": [{"cmd": "forward"}] * 5}, format="json").json()
    assert crash["passed"] is False and crash["robot"]["outcome"] == "crashed"
    bad = client.post("/api/challenges/robot-straight-road/submit", {"program": [{"cmd": "right"}]}, format="json")
    assert bad.status_code == 400  # "right" is not allowed in this mission
    result = complete_lesson(client, "delivery-robot")
    assert "robot-navigator" in {a["slug"] for a in result["achievements"]}


def test_progress_autosave_and_ownership(client_user, curriculum):
    client, user = client_user
    r = client.post("/api/lessons/what-is-programming/progress", {"current_block": 3, "drafts": {"nope": "x"}}, format="json")
    assert r.json()["current_block"] == 3
    assert LessonProgress.objects.get(user=user, lesson__slug="what-is-programming").drafts == {}

    from apps.accounts.models import User
    other = User.objects.create_user(email="other@example.com", password="kigali-moto-2026")
    from apps.learning.models import PortfolioEntry
    from apps.curriculum.models import Challenge
    entry = PortfolioEntry.objects.create(user=other, challenge=Challenge.objects.first(), title="t", problem="p", code="c")
    assert client.patch(f"/api/portfolio/{entry.pk}", {"reflection": "hijack"}, format="json").status_code == 404


def test_tutor_reports_offline_honestly(client_user, curriculum):
    client, _ = client_user
    status = client.get("/api/tutor/status").json()
    assert status["available"] is False and status["message"]
    r = client.post("/api/tutor/ask", {"question": "Why is my loop infinite?"}, format="json")
    assert r.status_code == 503 and r.json()["error"]["code"] == "tutor_unavailable"


def test_unauthenticated_requests_are_rejected(db):
    c = APIClient()
    for url in ["/api/dashboard", "/api/worlds", "/api/lessons/hello-python", "/api/achievements"]:
        assert c.get(url).status_code == 403


def test_capstone_unlocks_python_builder_and_portfolio(client_user, curriculum):
    client, user = client_user
    for slug in ["what-is-programming", "hello-python", "moto-fare-calculator", "mobile-money-validator", "delivery-route-loops"]:
        assert complete_lesson(client, slug)["completed"], slug
    assert complete_lesson(client, "rider-day-summary")["completed"]
    earned = {a["slug"] for a in client.get("/api/achievements").json() if a["earned"]}
    assert {"python-builder", "logic-explorer", "loop-master", "bug-detective", "first-programmer"} <= earned
    portfolio = client.get("/api/portfolio").json()
    assert any(p["title"] == "Rider Day Summary" and p["tests_passed"] == p["tests_total"] for p in portfolio)
    worlds = {w["slug"]: w for w in client.get("/api/worlds").json()}
    ml_lessons = [l for m in worlds["ml-lab"]["modules"] for l in m["lessons"]]
    assert worlds["ml-lab"]["is_available"] is False and ml_lessons == []
    assert Submission.objects.filter(user=user, passed=True, challenge__tier="capstone").exists()
