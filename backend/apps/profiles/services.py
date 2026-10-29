"""Profile completion and trust signals.

Completion = valid completed items / counted items x 100. Items are per role,
and completion is deliberately *not* a trust or safety score: verification and
reviews are reported as separate signals.
"""
from dataclasses import dataclass

from django.db.models import Avg, Count, Q

from apps.accounts.models import User, UserRole, Verification

from .models import LocalProfile, Profile, ProfilePhoto, TravelerProfile

MIN_BIO_LENGTH = 30


@dataclass
class CompletionItem:
    key: str
    done: bool


def ensure_profiles(user: User) -> Profile:
    profile, _ = Profile.objects.get_or_create(user=user)
    roles = set(user.roles.values_list("role", flat=True))
    if UserRole.Role.LOCAL in roles:
        LocalProfile.objects.get_or_create(user=user)
    if UserRole.Role.TRAVELER in roles:
        TravelerProfile.objects.get_or_create(user=user)
    return profile


def _common_items(user: User, profile: Profile) -> list[CompletionItem]:
    return [
        CompletionItem("avatar", bool(profile.avatar)),
        CompletionItem("bio", len(profile.bio.strip()) >= MIN_BIO_LENGTH),
        CompletionItem("languages", user.languages.exists()),
        CompletionItem("interests", user.interests.exists()),
    ]


def traveler_items(user: User) -> list[CompletionItem]:
    profile = user.profile
    traveler = TravelerProfile.objects.filter(user=user).first()
    return _common_items(user, profile) + [
        CompletionItem("travel_style", bool(traveler and traveler.travel_style)),
        CompletionItem("wishes", bool(traveler and traveler.wishes.strip())),
    ]


def local_items(user: User) -> list[CompletionItem]:
    from apps.experiences.models import LocalService

    profile = user.profile
    local = LocalProfile.objects.filter(user=user).first()
    return _common_items(user, profile) + [
        CompletionItem("city", profile.city_id is not None),
        CompletionItem("areas", bool(local and local.areas_description.strip())),
        CompletionItem("experience", bool(local and len(local.experience_summary.strip()) >= MIN_BIO_LENGTH)),
        CompletionItem("pricing", bool(local and local.has_pricing)),
        CompletionItem(
            "services",
            LocalService.objects.filter(local=user, status=LocalService.Status.ACTIVE).exists(),
        ),
        CompletionItem(
            "photos", ProfilePhoto.objects.filter(user=user, status=ProfilePhoto.Status.VISIBLE).exists()
        ),
    ]


def _percent(items: list[CompletionItem]) -> int:
    if not items:
        return 0
    return round(100 * sum(1 for i in items if i.done) / len(items))


def completion_report(user: User) -> dict:
    roles = set(user.roles.values_list("role", flat=True))
    report = {}
    if UserRole.Role.TRAVELER in roles:
        items = traveler_items(user)
        report["traveler"] = {
            "percent": _percent(items),
            "items": [{"key": i.key, "done": i.done} for i in items],
        }
    if UserRole.Role.LOCAL in roles:
        items = local_items(user)
        report["local"] = {
            "percent": _percent(items),
            "items": [{"key": i.key, "done": i.done} for i in items],
        }
    return report


def refresh_completion(user: User) -> None:
    if not Profile.objects.filter(user=user).exists():
        return
    roles = set(user.roles.values_list("role", flat=True))
    Profile.objects.filter(user=user).update(
        traveler_completion=_percent(traveler_items(user)) if UserRole.Role.TRAVELER in roles else 0,
        local_completion=_percent(local_items(user)) if UserRole.Role.LOCAL in roles else 0,
    )


def review_stats(user: User, role: str) -> dict:
    from apps.reviews.models import Review

    stats = Review.objects.publicly_visible().filter(reviewee=user, reviewee_role=role).aggregate(
        avg=Avg("rating"), count=Count("id")
    )
    return {"rating_avg": round(stats["avg"], 2) if stats["avg"] else None, "review_count": stats["count"]}


def booking_stats(user: User, role: str) -> dict:
    from apps.bookings.models import Booking

    field = "local" if role == UserRole.Role.LOCAL else "traveler"
    qs = Booking.objects.filter(**{field: user})
    return qs.aggregate(
        completed_tours=Count("id", filter=Q(status=Booking.Status.COMPLETED)),
        cancelled_by_user=Count("id", filter=Q(status=Booking.Status.CANCELLED, cancelled_by=user)),
    )


def trust_signals(user: User, role: str) -> dict:
    """Separate trust signals; intentionally never merged into one 'safety score'."""
    profile = user.profile
    completion = profile.local_completion if role == UserRole.Role.LOCAL else profile.traveler_completion
    signals = {
        "profile_completion": completion,
        "profile_complete": completion == 100,
        "email_verified": user.is_verified(Verification.Kind.EMAIL),
        "phone_verified": user.is_verified(Verification.Kind.PHONE),
        "identity_verified": user.is_verified(Verification.Kind.IDENTITY),
        "member_since": user.date_joined.date().isoformat(),
        **review_stats(user, role),
        **booking_stats(user, role),
    }
    signals["is_new_member"] = signals["review_count"] == 0
    if role == UserRole.Role.LOCAL:
        local = getattr(user, "local_profile", None)
        signals["manually_checked"] = bool(
            local and local.review_status == LocalProfile.ReviewStatus.MANUALLY_CHECKED
        )
    return signals
