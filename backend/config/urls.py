from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.accounts import views as accounts
from apps.learning import views as learning
from apps.tutor import views as tutor


def health(_request):
    return JsonResponse({"status": "ok"})


api = [
    path("health", health),
    path("auth/csrf", accounts.CsrfView.as_view()),
    path("auth/register", accounts.RegisterView.as_view()),
    path("auth/login", accounts.LoginView.as_view()),
    path("auth/logout", accounts.LogoutView.as_view()),
    path("auth/me", accounts.MeView.as_view()),
    path("profile", accounts.ProfileView.as_view()),
    path("onboarding", accounts.OnboardingView.as_view()),
    path("dashboard", learning.DashboardView.as_view()),
    path("worlds", learning.WorldListView.as_view()),
    path("worlds/<slug:slug>", learning.WorldDetailView.as_view()),
    path("lessons/<slug:slug>", learning.LessonDetailView.as_view()),
    path("lessons/<slug:slug>/progress", learning.LessonProgressView.as_view()),
    path("lessons/<slug:slug>/activities/<slug:block_id>", learning.ActivityResponseView.as_view()),
    path("lessons/<slug:slug>/complete", learning.LessonCompleteView.as_view()),
    path("challenges/<slug:slug>", learning.ChallengeDetailView.as_view()),
    path("challenges/<slug:slug>/check", learning.ChallengeCheckView.as_view()),
    path("challenges/<slug:slug>/submit", learning.ChallengeEvaluateView.as_view()),
    path("challenges/<slug:slug>/hints", learning.HintView.as_view()),
    path("challenges/<slug:slug>/submissions", learning.SubmissionHistoryView.as_view()),
    path("skills", learning.SkillsView.as_view()),
    path("achievements", learning.AchievementsView.as_view()),
    path("xp", learning.XPLedgerView.as_view()),
    path("portfolio", learning.PortfolioListView.as_view()),
    path("portfolio/<int:pk>", learning.PortfolioDetailView.as_view()),
    path("analytics", learning.AnalyticsView.as_view()),
    path("tutor/status", tutor.TutorStatusView.as_view()),
    path("tutor/ask", tutor.TutorAskView.as_view()),
    path("schema", SpectacularAPIView.as_view(), name="schema"),
    path("docs", SpectacularSwaggerView.as_view(url_name="schema")),
]

urlpatterns = [path("admin/", admin.site.urls), path("api/", include(api))]
