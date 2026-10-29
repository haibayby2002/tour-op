from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole, Verification
from apps.experiences.models import LocalService, ServiceCategory
from apps.profiles.models import City, Interest, Language, LocalProfile
from apps.profiles.services import ensure_profiles

PASSWORD = "Str0ng-pass-123"


@pytest.fixture(autouse=True)
def _settings(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": []}
    settings.EXPOSE_VERIFICATION_CODES = True


@pytest.fixture
def reference(db):
    city = City.objects.create(slug="hanoi", name="Hanoi")
    Language.objects.create(code="en", name="English")
    Language.objects.create(code="vi", name="Vietnamese")
    Interest.objects.create(slug="street-food", name="Street food")
    Interest.objects.create(slug="history", name="History")
    category = ServiceCategory.objects.create(slug="food", name="Food")
    return {"city": city, "category": category}


def make_user(email, roles=(UserRole.Role.TRAVELER,), verified=True, phone=None, **extra):
    user = User.objects.create_user(
        email=email,
        password=PASSWORD,
        full_name=extra.pop("full_name", email.split("@")[0].title()),
        birth_year=extra.pop("birth_year", 1992),
        phone=phone or f"+8490{abs(hash(email)) % 10**7:07d}",
        **extra,
    )
    for role in roles:
        UserRole.objects.create(user=user, role=role)
    if verified:
        for kind, target in ((Verification.Kind.EMAIL, user.email), (Verification.Kind.PHONE, user.phone)):
            Verification.objects.create(user=user, kind=kind, target=target, status=Verification.Status.VERIFIED,
                                        verified_at=timezone.now())
    ensure_profiles(user)
    return user


@pytest.fixture
def traveler(reference):
    return make_user("traveler@example.com")


@pytest.fixture
def local(reference):
    user = make_user("local@example.com", roles=(UserRole.Role.LOCAL,))
    LocalProfile.objects.filter(user=user).update(price_min=300000, price_max=600000)
    user.profile.city = reference["city"]
    user.profile.save()
    LocalService.objects.create(
        local=user, category=reference["category"], city=reference["city"], title="Food walk",
        description="Tasty", duration_minutes=120, price=400000,
    )
    return user


@pytest.fixture
def outsider(reference):
    return make_user("outsider@example.com")


def client_for(user=None):
    client = APIClient()
    if user is not None:
        client.force_authenticate(user)
    return client


@pytest.fixture
def api():
    return client_for


def future(days=3, hours=0):
    return (timezone.now() + timedelta(days=days, hours=hours)).replace(microsecond=0)


def request_payload(local, city="hanoi", **overrides):
    start = future()
    payload = {
        "local": local.id,
        "city": city,
        "start_at": start.isoformat(),
        "end_at": (start + timedelta(hours=3)).isoformat(),
        "group_size": 2,
        "wishes": "Street food and some history",
        "avoid_notes": "No shopping",
        "interests": ["street-food"],
    }
    payload.update(overrides)
    return payload


def agreement_payload(**overrides):
    start = future(4)
    payload = {
        "meeting_point": "Hoan Kiem Lake, north side",
        "start_at": start.isoformat(),
        "end_at": (start + timedelta(hours=3)).isoformat(),
        "group_size": 2,
        "scope": "Walking food tour, ordering and explaining dishes",
        "price": 500000,
        "currency": "VND",
        "price_unit": "PER_GROUP",
        "included": "Guide fee, tastings",
        "excluded": "Drinks",
        "cost_tickets": "None",
        "cost_transport": "Walking only",
        "cancellation_policy": "Free cancellation 24h before",
        "stops": [
            {"time": "17:00", "place_name": "Dong Xuan market", "activity": "Snacks", "kind": "FOOD"},
            {"time": "18:00", "place_name": "Silk shop", "activity": "Optional look", "kind": "SHOPPING"},
            {"time": "19:00", "place_name": "Temple of Literature", "activity": "History", "kind": "SIGHTSEEING"},
        ],
    }
    payload.update(overrides)
    return payload
