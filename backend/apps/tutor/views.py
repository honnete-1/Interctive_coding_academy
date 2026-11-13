from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.curriculum.models import Challenge, Lesson
from apps.learning.progression import lesson_lock_reason

from . import service
from .providers import ProviderError, ProviderUnavailable


class AskSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=1500)
    mode = serializers.ChoiceField(choices=sorted(service.MODES), default="guided")
    lesson = serializers.SlugField(required=False, allow_blank=True)
    challenge = serializers.SlugField(required=False, allow_blank=True)
    code = serializers.CharField(max_length=20000, required=False, allow_blank=True, trim_whitespace=False)
    output = serializers.CharField(max_length=5000, required=False, allow_blank=True, trim_whitespace=False)


def _error(code, message, http):
    return Response({"error": {"code": code, "message": message, "details": None}}, status=http)


class TutorStatusView(APIView):
    def get(self, request):
        return Response(service.provider_status())


class TutorAskView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "tutor"

    def post(self, request):
        s = AskSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        lesson = Lesson.objects.filter(slug=d.get("lesson"), published=True).first() if d.get("lesson") else None
        challenge = Challenge.objects.filter(slug=d.get("challenge")).select_related("lesson").first() if d.get("challenge") else None
        if challenge and lesson is None:
            lesson = challenge.lesson
        if lesson and lesson_lock_reason(request.user, lesson):
            return _error("locked", "That lesson is still locked.", status.HTTP_403_FORBIDDEN)
        try:
            result = service.ask(request.user, d["question"], d["mode"], lesson, challenge, d.get("code", ""), d.get("output", ""))
        except service.TutorLimitReached as exc:
            return _error("tutor_limit", str(exc), status.HTTP_429_TOO_MANY_REQUESTS)
        except ProviderUnavailable as exc:
            return _error("tutor_unavailable", f"{exc} Authored hints are still available.", status.HTTP_503_SERVICE_UNAVAILABLE)
        except ProviderError as exc:
            return _error("tutor_error", str(exc), status.HTTP_502_BAD_GATEWAY)
        return Response(result)
