"""
CodeVerse backend settings.

All secrets and environment-specific values come from environment variables
(see ../.env.example). Nothing sensitive is hardcoded here.
"""

import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent

load_dotenv(REPO_ROOT / ".env")
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


DEBUG = env_bool("DJANGO_DEBUG", False)

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if DEBUG or os.environ.get("PYTEST_CURRENT_TEST") is not None or env_bool("CODEVERSE_TESTING"):
        SECRET_KEY = "dev-only-insecure-key-do-not-use-in-production"
    else:
        raise RuntimeError("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is false.")

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "apps.accounts",
    "apps.curriculum",
    "apps.learning",
    "apps.grader",
    "apps.tutor",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# PostgreSQL in production / docker-compose; SQLite is a zero-setup local fallback.
DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=int(os.environ.get("DB_CONN_MAX_AGE", "60")),
    )
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en"
TIME_ZONE = os.environ.get("TIME_ZONE", "Africa/Kigali")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Sessions & cookies -----------------------------------------------------
# The Next.js frontend proxies /api/* to Django, so the browser sees a single
# origin and we can use HttpOnly session cookies + CSRF instead of JS-readable tokens.
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 60 * 60 * 24 * 14
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)

# --- REST framework ---------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "EXCEPTION_HANDLER": "apps.accounts.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.environ.get("THROTTLE_ANON", "60/min"),
        "user": os.environ.get("THROTTLE_USER", "600/min"),
        "auth": os.environ.get("THROTTLE_AUTH", "10/min"),
        "submissions": os.environ.get("THROTTLE_SUBMISSIONS", "30/min"),
        "tutor": os.environ.get("THROTTLE_TUTOR", "20/min"),
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "CodeVerse API",
    "DESCRIPTION": "Learning platform API: auth, curriculum, progress, grading, achievements, Nova tutor.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# --- Grader (learner code execution) ----------------------------------------
# Learner code is NEVER executed inside the Django process. The grader spawns a
# separate sandbox. See SECURITY.md.
#   docker      -> network-less, memory/CPU/pid-limited, read-only container (recommended)
#   subprocess  -> separate isolated-mode Python process with timeouts (LOCAL DEV ONLY)
GRADER_BACKEND = os.environ.get("GRADER_BACKEND", "docker")
GRADER_DOCKER_IMAGE = os.environ.get("GRADER_DOCKER_IMAGE", "python:3.12-alpine")
GRADER_TIMEOUT_SECONDS = float(os.environ.get("GRADER_TIMEOUT_SECONDS", "6"))
GRADER_MAX_STEPS = int(os.environ.get("GRADER_MAX_STEPS", "200000"))
GRADER_MAX_OUTPUT_CHARS = int(os.environ.get("GRADER_MAX_OUTPUT_CHARS", "20000"))
GRADER_MAX_CODE_CHARS = int(os.environ.get("GRADER_MAX_CODE_CHARS", "20000"))
GRADER_ALLOW_UNSAFE_SUBPROCESS = env_bool("GRADER_ALLOW_UNSAFE_SUBPROCESS", DEBUG)

# --- Nova AI tutor ------------------------------------------------------------
# Provider is optional. With no provider, Nova serves authored hints only and says so.
NOVA_PROVIDER = os.environ.get("NOVA_PROVIDER", "none")  # none | anthropic
NOVA_MODEL = os.environ.get("NOVA_MODEL", "claude-opus-5-5")
NOVA_EFFORT = os.environ.get("NOVA_EFFORT", "low")  # tutoring chat: low effort keeps replies fast and cheap
NOVA_REFUSAL_FALLBACK = env_bool("NOVA_REFUSAL_FALLBACK", True)
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
NOVA_MAX_OUTPUT_TOKENS = int(os.environ.get("NOVA_MAX_OUTPUT_TOKENS", "4000"))
NOVA_DAILY_REQUEST_LIMIT = int(os.environ.get("NOVA_DAILY_REQUEST_LIMIT", "60"))

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "loggers": {
        "codeverse": {"handlers": ["console"], "level": os.environ.get("LOG_LEVEL", "INFO")},
        "codeverse.audit": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
