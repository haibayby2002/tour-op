"""Tour-op Django settings.

Everything environment-specific is read from env vars (see .env.example).
Without DATABASE_URL / REDIS_URL the project falls back to SQLite, an
in-memory channel layer and eager Celery so it runs with no infrastructure.
"""
from datetime import timedelta
from pathlib import Path
import os

import dj_database_url
from corsheaders.defaults import default_headers as default_cors_headers
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-insecure-key-change-me-in-production-0123456789")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "*")

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "channels",
    "drf_spectacular",
    # domain apps
    "apps.common",
    "apps.audit",
    "apps.accounts",
    "apps.profiles",
    "apps.experiences",
    "apps.discovery",
    "apps.bookings",
    "apps.messaging",
    "apps.reviews",
    "apps.safety",
    "apps.notifications",
    "apps.wishes",
    "apps.staff",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
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
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=60,
    )
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en"
LANGUAGES = [("en", "English"), ("vi", "Tiếng Việt")]
TIME_ZONE = "Asia/Ho_Chi_Minh"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# --- Uploaded files ---------------------------------------------------------
# MEDIA_STORAGE=local|s3|r2 picks the backend; see config/storage.py and .env.example.
from config.storage import build_storages  # noqa: E402

STORAGES, MEDIA_STORAGE = build_storages(BASE_DIR)
# Let Django serve local media itself (dev, or a single-server deployment before
# moving to object storage). Behind nginx/Caddy, serve MEDIA_ROOT there instead.
SERVE_MEDIA = MEDIA_STORAGE == "local" and env_bool("SERVE_MEDIA", DEBUG)

# Image uploads are re-encoded server-side (EXIF/GPS stripped, resized, WebP).
IMAGE_MAX_UPLOAD_MB = int(os.getenv("IMAGE_MAX_UPLOAD_MB", "10"))
IMAGE_MAX_PIXELS = 40_000_000  # reject decompression bombs before decoding
IMAGE_SIZES = {"full": 1600, "thumb": 480, "avatar": 512}
IMAGE_QUALITY = int(os.getenv("IMAGE_QUALITY", "82"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- REST framework -------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv("THROTTLE_ANON", "60/min"),
        "user": os.getenv("THROTTLE_USER", "600/min"),
        "auth": os.getenv("THROTTLE_AUTH", "20/min"),
        "verification": os.getenv("THROTTLE_VERIFICATION", "5/min"),
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Tour-op API",
    "DESCRIPTION": "Connecting travelers with trustworthy locals.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "15"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "14"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

# Web clients keep the refresh token in an HTTP-only cookie; mobile clients
# receive it in the response body and keep it in secure storage.
REFRESH_COOKIE_NAME = "tourop_refresh"
REFRESH_COOKIE_SECURE = env_bool("REFRESH_COOKIE_SECURE", not DEBUG)
REFRESH_COOKIE_SAMESITE = os.getenv("REFRESH_COOKIE_SAMESITE", "Lax")
REFRESH_COOKIE_PATH = "/api/v1/auth/"

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
)
CORS_ALLOW_CREDENTIALS = True
# The web client sends X-Client: web to get its refresh token as a cookie (accounts.views).
CORS_ALLOW_HEADERS = (*default_cors_headers, "x-client")
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

# --- HTTPS (production) -----------------------------------------------------
# Railway and Cloudflare terminate TLS and forward X-Forwarded-Proto.
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "3600"))

# --- Redis / Channels / Celery -------------------------------------------
REDIS_URL = os.getenv("REDIS_URL", "")

if REDIS_URL:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            # redis-py 8 defaults to a 5 s socket timeout, the same as channels_redis's
            # 5 s BRPOP wait, so idle WebSockets crashed with TimeoutError. Allow longer reads.
            "CONFIG": {"hosts": [{"address": REDIS_URL, "socket_timeout": 30}]},
        }
    }
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
        }
    }
else:
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

CELERY_BROKER_URL = REDIS_URL or "memory://"
CELERY_RESULT_BACKEND = None
CELERY_TASK_ALWAYS_EAGER = not REDIS_URL
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULE = {
    "expire-stale-requests": {
        "task": "apps.bookings.tasks.expire_stale_requests",
        "schedule": 60 * 30,
    },
    "expire-trip-wishes": {
        "task": "apps.wishes.tasks.expire_stale_wishes",
        "schedule": 60 * 30,
    },
    "remind-reviews": {
        "task": "apps.bookings.tasks.open_reviews_for_finished_tours",
        "schedule": 60 * 60,
    },
}

# --- Email / SMS ---------------------------------------------------------
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
# SMTP (production). Resend: host smtp.resend.com, port 465, SSL, user "resend", password = API key.
EMAIL_HOST = os.getenv("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "25"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", False)
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "Tour-op <no-reply@tour-op.local>")
SMS_PROVIDER = os.getenv("SMS_PROVIDER", "apps.accounts.providers.ConsoleSmsProvider")

# Verification codes
VERIFICATION_CODE_TTL_MINUTES = 10
VERIFICATION_MAX_ATTEMPTS = 5
# Require verified email + phone before sending/receiving tour requests.
REQUIRE_CONTACT_VERIFICATION = env_bool("REQUIRE_CONTACT_VERIFICATION", True)

# Sign in with Google: OAuth client IDs whose ID tokens we accept (comma-separated).
# Use the *Web* client ID; Android sign-in requests tokens for it too.
GOOGLE_CLIENT_IDS = env_list("GOOGLE_CLIENT_IDS")

# Push notifications through the Expo push service (disabled by default)
EXPO_PUSH_ENABLED = env_bool("EXPO_PUSH_ENABLED", False)

# Public URL of the web app, used for share links and emails
WEB_APP_URL = os.getenv("WEB_APP_URL", "http://localhost:5173")

# Tour requests not answered within this many hours are expired.
TOUR_REQUEST_EXPIRY_HOURS = 72
# Tour-op focuses on solo travelers and small groups (PRD: 1-3 people).
MAX_GROUP_SIZE = int(os.getenv("MAX_GROUP_SIZE", "3"))
# Minimum age (by birth year) to register; meeting strangers needs adults.
MIN_USER_AGE = int(os.getenv("MIN_USER_AGE", "18"))
# Return verification codes in API responses (development convenience only).
EXPOSE_VERIFICATION_CODES = env_bool("EXPOSE_VERIFICATION_CODES", DEBUG)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
