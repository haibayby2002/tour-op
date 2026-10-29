"""Read-side helpers that build the *public* view of a user.

Nothing here may include email, phone, exact address or other private data:
the public profile API is the main place contact details could leak.
"""
from django.utils import timezone

from apps.accounts.models import User, UserRole
from apps.common.exceptions import DomainError
from apps.common.images import file_url

from .models import ExternalReviewSource, Interest, Profile, ProfilePhoto, TravelerProfile
from .serializers import (
    AvailabilitySerializer,
    CitySerializer,
    ExternalReviewSourceSerializer,
    InterestSerializer,
    LocalProfileSerializer,
    ProfilePhotoSerializer,
    UserLanguageSerializer,
)
from .services import trust_signals

PUBLIC_LOCAL_FIELDS = (
    "experience_summary", "years_experience", "areas_description", "support_skills",
    "price_min", "price_max", "currency", "pricing_note", "is_accepting_requests",
)


def is_blocked_between(a: User, b: User) -> bool:
    from apps.safety.models import Block

    if a is None or not a.is_authenticated:
        return False
    return Block.objects.filter(blocker=a, blocked=b).exists() or Block.objects.filter(
        blocker=b, blocked=a
    ).exists()


def can_view_traveler_details(traveler: User, viewer) -> bool:
    if viewer is None or not viewer.is_authenticated:
        return False
    if viewer.id == traveler.id or viewer.is_staff:
        return True
    tp = getattr(traveler, "traveler_profile", None)
    if tp and tp.visibility == TravelerProfile.Visibility.PUBLIC:
        return True
    from apps.bookings.models import TourRequest
    from apps.wishes.models import WishCandidate

    return (
        TourRequest.objects.filter(traveler=traveler, local=viewer).exists()
        or WishCandidate.objects.filter(wish__traveler=traveler, local=viewer).exists()
    )


def avatar_url(profile: Profile, request) -> str | None:
    return file_url(profile.avatar, request)


def public_card(user: User, request=None) -> dict:
    """Minimal public identity used inside other payloads (bookings, reviews, messages)."""
    profile = user.profile
    return {
        "id": user.id,
        "name": profile.public_name,
        "avatar": avatar_url(profile, request),
        "age_by_birth_year": user.age_by_birth_year,
        "city": profile.city.name if profile.city else None,
    }


def public_profile(user: User, viewer, role: str, request=None) -> dict:
    from apps.experiences.models import LocalService
    from apps.experiences.serializers import LocalServiceSerializer
    from apps.reviews.selectors import recent_reviews

    if user.status != User.Status.ACTIVE or not user.is_active:
        raise DomainError("Profile not available.", code="not_found", status_code=404)
    if not user.has_role(role):
        raise DomainError("Profile not available.", code="not_found", status_code=404)
    if is_blocked_between(viewer, user):
        raise DomainError("Profile not available.", code="blocked", status_code=404)

    profile = user.profile
    if profile.visibility == Profile.Visibility.MEMBERS and not (viewer and viewer.is_authenticated):
        raise DomainError("Sign in to view this profile.", code="members_only", status_code=401)

    ctx = {"request": request}
    data = {
        **public_card(user, request),
        "role": role,
        "bio": profile.bio,
        "city": CitySerializer(profile.city).data if profile.city else None,
        "location_name": profile.location_name,
        "languages": UserLanguageSerializer(user.languages.select_related("language"), many=True).data,
        "interests": InterestSerializer(Interest.objects.filter(userinterest__user=user), many=True).data,
        "photos": ProfilePhotoSerializer(
            user.photos.filter(status=ProfilePhoto.Status.VISIBLE), many=True, context=ctx
        ).data,
        "trust": trust_signals(user, role),
        "reviews": recent_reviews(user, role, request=request),
    }

    if role == UserRole.Role.LOCAL:
        local_data = LocalProfileSerializer(user.local_profile).data
        data["local"] = {k: local_data[k] for k in PUBLIC_LOCAL_FIELDS}
        data["services"] = LocalServiceSerializer(
            LocalService.objects.filter(local=user, status=LocalService.Status.ACTIVE).select_related(
                "category", "city"
            ),
            many=True,
            context=ctx,
        ).data
        data["external_reviews"] = ExternalReviewSourceSerializer(
            user.external_reviews.exclude(status=ExternalReviewSource.Status.REJECTED), many=True, context=ctx
        ).data
        data["availability"] = AvailabilitySerializer(
            user.availability.filter(end_at__gte=timezone.now())[:20], many=True
        ).data
    else:
        if can_view_traveler_details(user, viewer):
            tp = user.traveler_profile
            data["traveler"] = {
                "travel_style": tp.travel_style,
                "wishes": tp.wishes,
                "avoid_notes": tp.avoid_notes,
            }
        else:
            data["traveler"] = None
    return data
