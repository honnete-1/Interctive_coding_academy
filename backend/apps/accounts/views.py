from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.authentication import CSRFCheck
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .audit import audit
from .models import LearnerProfile, User
from .serializers import (
    LoginSerializer,
    OnboardingSerializer,
    ProfileSerializer,
    RegisterSerializer,
    UserSerializer,
)


class AuthThrottle(ScopedRateThrottle):
    pass


class EnforceCsrfMixin:
    """DRF only checks CSRF for already-authenticated sessions; login/register must check it too
    (prevents login-CSRF, where an attacker signs a victim into the attacker's account)."""

    def initial(self, request, *args, **kwargs):
        check = CSRFCheck(lambda req: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise PermissionDenied(f"CSRF failed: {reason}")
        super().initial(request, *args, **kwargs)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Sets the csrftoken cookie; the SPA echoes it in X-CSRFToken on unsafe requests."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class RegisterView(EnforceCsrfMixin, APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        with transaction.atomic():
            user = User.objects.create_user(email=data["email"], password=data["password"])
            LearnerProfile.objects.create(user=user, display_name=data["display_name"])
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        audit("auth.register", request, user=user)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(EnforceCsrfMixin, APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()
        user = authenticate(request, username=email, password=serializer.validated_data["password"])
        if user is None or not user.is_active:
            audit("auth.login_failed", request, email=email)
            return Response(
                {"error": {"code": "invalid_credentials", "message": "Email or password is incorrect.", "details": None}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        login(request, user)
        LearnerProfile.objects.get_or_create(user=user, defaults={"display_name": email.split("@")[0]})
        audit("auth.login", request, user=user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    def post(self, request):
        audit("auth.logout", request)
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        LearnerProfile.objects.get_or_create(
            user=request.user, defaults={"display_name": request.user.email.split("@")[0]}
        )
        return Response(UserSerializer(request.user).data)


class ProfileView(APIView):
    def get(self, request):
        return Response(ProfileSerializer(request.user.profile).data)

    def patch(self, request):
        serializer = ProfileSerializer(request.user.profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class OnboardingView(APIView):
    def post(self, request):
        serializer = OnboardingSerializer(request.user.profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response(ProfileSerializer(profile).data)
