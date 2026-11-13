from django.contrib.auth import password_validation
from rest_framework import serializers

from .models import LearnerProfile, User

INTEREST_CHOICES = [
    "transport", "finance", "sports", "farming", "small_business", "healthcare",
    "education", "logistics", "environment", "everyday_tech",
]
SPECIALIZATION_CHOICES = ["ml", "security", "devops", "undecided"]
AVATAR_FIELDS = {"base", "color", "accessory"}
# Cosmetic unlocks, verified against earned achievements (mirrors frontend Avatar.tsx).
ACCESSORY_UNLOCKS = {"none": None, "cap": "robot-navigator", "glasses": "bug-detective", "crown": "python-builder"}

# Optional diagnostic for learners with prior experience. Answers are scored server-side.
DIAGNOSTIC_KEY = {
    "d1": "6",        # x = 2; x = x * 3; print(x)
    "d2": "b",        # which branch runs
    "d3": "3",        # how many times the loop body runs
    "d4": "TypeError",  # "5" + 5
}


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    display_name = serializers.CharField(max_length=60)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_display_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Please choose a display name.")
        return value

    def validate(self, attrs):
        try:
            password_validation.validate_password(attrs["password"], User(email=attrs["email"]))
        except Exception as exc:  # django ValidationError -> DRF field error
            raise serializers.ValidationError({"password": list(getattr(exc, "messages", [str(exc)]))})
        return attrs


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, max_length=128)


class ProfileSerializer(serializers.ModelSerializer):
    interests = serializers.ListField(
        child=serializers.ChoiceField(choices=INTEREST_CHOICES), required=False, max_length=10
    )
    specializations = serializers.ListField(
        child=serializers.ChoiceField(choices=SPECIALIZATION_CHOICES), required=False, max_length=4
    )
    english_comfort = serializers.IntegerField(min_value=1, max_value=5, required=False)
    weekly_minutes = serializers.IntegerField(min_value=15, max_value=3000, required=False)
    font_scale = serializers.FloatField(min_value=0.85, max_value=1.5, required=False)
    theme = serializers.ChoiceField(choices=["light", "dark", "system"], required=False)
    interface_mode = serializers.ChoiceField(choices=["adventure", "focus"], required=False)
    language = serializers.ChoiceField(choices=["en"], required=False)

    class Meta:
        model = LearnerProfile
        fields = [
            "display_name", "avatar", "onboarding_completed", "experience", "motivation",
            "specializations", "interests", "english_comfort", "guidance", "weekly_minutes",
            "diagnostic_score", "theme", "reduced_motion", "font_scale", "interface_mode", "language",
        ]
        read_only_fields = ["onboarding_completed", "diagnostic_score"]

    def validate_avatar(self, value):
        if not isinstance(value, dict) or set(value) - AVATAR_FIELDS:
            raise serializers.ValidationError("Unsupported avatar fields.")
        value = {k: str(v)[:30] for k, v in value.items()}
        accessory = value.get("accessory", "none")
        if accessory not in ACCESSORY_UNLOCKS:
            raise serializers.ValidationError("Unknown accessory.")
        required = ACCESSORY_UNLOCKS[accessory]
        user = self.instance.user if self.instance else None
        if required and not (user and user.achievements.filter(achievement__slug=required).exists()):
            raise serializers.ValidationError("That accessory unlocks with an achievement you haven't earned yet.")
        return value


class OnboardingSerializer(ProfileSerializer):
    diagnostic_answers = serializers.DictField(
        child=serializers.CharField(max_length=40), required=False, write_only=True
    )

    class Meta(ProfileSerializer.Meta):
        fields = ProfileSerializer.Meta.fields + ["diagnostic_answers"]

    def update(self, instance, validated_data):
        answers = validated_data.pop("diagnostic_answers", None)
        if answers:
            instance.diagnostic_score = sum(
                1 for key, correct in DIAGNOSTIC_KEY.items() if answers.get(key, "").strip() == correct
            )
        instance.onboarding_completed = True
        return super().update(instance, validated_data)


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "role", "profile"]
