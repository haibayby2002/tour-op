import hmac
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac

from apps.audit.services import record
from apps.common.exceptions import DomainError

from .models import User, UserRole, Verification
from .tasks import deliver_verification_code

_PHONE_CLEAN_RE = re.compile(r"[\s.\-()]")


def min_age() -> int:
    return getattr(settings, "MIN_USER_AGE", 18)


def normalize_phone(raw: str) -> str:
    """Normalize to an E.164-like form. Vietnamese local numbers (0xxx) become +84xxx."""
    phone = _PHONE_CLEAN_RE.sub("", raw or "")
    if phone.startswith("00"):
        phone = "+" + phone[2:]
    if phone.startswith("0"):
        phone = "+84" + phone[1:]
    if not phone.startswith("+"):
        phone = "+" + phone
    if not re.fullmatch(r"\+\d{8,15}", phone):
        raise DomainError("Enter a valid phone number.", code="invalid_phone")
    return phone


def validate_birth_year(year: int) -> int:
    current = timezone.now().year
    if year < current - 110 or year > current:
        raise DomainError("Enter a valid birth year.", code="invalid_birth_year")
    if current - year < min_age():
        raise DomainError(
            f"You must be at least {min_age()} (by birth year) to use Tour-op.", code="too_young"
        )
    return year


@transaction.atomic
def register_user(*, full_name, birth_year, email, phone, password, roles, request=None) -> User:
    from apps.profiles.services import ensure_profiles

    user = User.objects.create_user(
        email=email,
        password=password,
        full_name=full_name.strip(),
        birth_year=birth_year,
        phone=phone,
    )
    roles = set(roles or [UserRole.Role.TRAVELER])
    for role in roles:
        UserRole.objects.create(user=user, role=role)
    ensure_profiles(user)
    record(user, user, "REGISTERED", request=request, roles=sorted(roles))
    return user


def add_role(user: User, role: str) -> None:
    from apps.profiles.services import ensure_profiles

    UserRole.objects.get_or_create(user=user, role=role)
    ensure_profiles(user)
    record(user, user, "ROLE_ADDED", role=role)


def remove_role(user: User, role: str) -> None:
    if user.roles.count() <= 1:
        raise DomainError("An account needs at least one role.", code="last_role")
    user.roles.filter(role=role).delete()
    record(user, user, "ROLE_REMOVED", role=role)


def _hash_code(verification_id: int, code: str) -> str:
    return salted_hmac("tourop.verification", f"{verification_id}:{code}").hexdigest()


def start_verification(user: User, kind: str) -> tuple[Verification, str]:
    """Create a fresh pending verification and deliver the code. Returns (verification, code)."""
    if kind not in (Verification.Kind.EMAIL, Verification.Kind.PHONE):
        raise DomainError("Unsupported verification type.", code="unsupported_verification")
    target = user.email if kind == Verification.Kind.EMAIL else user.phone
    if not target:
        raise DomainError("Add this contact detail first.", code="missing_contact")
    if user.is_verified(kind):
        raise DomainError("Already verified.", code="already_verified")

    user.verifications.filter(kind=kind, status=Verification.Status.PENDING).update(
        status=Verification.Status.EXPIRED
    )
    code = f"{secrets.randbelow(10**6):06d}"
    verification = Verification.objects.create(
        user=user,
        kind=kind,
        target=target,
        expires_at=timezone.now() + timedelta(minutes=settings.VERIFICATION_CODE_TTL_MINUTES),
    )
    verification.code_hash = _hash_code(verification.id, code)
    verification.save(update_fields=["code_hash"])
    transaction.on_commit(lambda: deliver_verification_code.delay(kind, target, code))
    return verification, code


def confirm_verification(user: User, kind: str, code: str) -> Verification:
    verification = (
        user.verifications.filter(kind=kind, status=Verification.Status.PENDING)
        .order_by("-created_at")
        .first()
    )
    if verification is None:
        raise DomainError("No pending verification. Request a new code.", code="no_pending_verification")
    current_target = user.email if kind == Verification.Kind.EMAIL else user.phone
    if verification.target != current_target:
        verification.status = Verification.Status.EXPIRED
        verification.save(update_fields=["status"])
        raise DomainError("Contact detail changed. Request a new code.", code="target_changed")
    if verification.expires_at and verification.expires_at < timezone.now():
        verification.status = Verification.Status.EXPIRED
        verification.save(update_fields=["status"])
        raise DomainError("Code expired. Request a new code.", code="code_expired")

    verification.attempts += 1
    if not hmac.compare_digest(verification.code_hash, _hash_code(verification.id, code.strip())):
        if verification.attempts >= settings.VERIFICATION_MAX_ATTEMPTS:
            verification.status = Verification.Status.FAILED
        verification.save(update_fields=["attempts", "status"])
        raise DomainError("Incorrect code.", code="invalid_code")

    verification.status = Verification.Status.VERIFIED
    verification.verified_at = timezone.now()
    verification.save(update_fields=["attempts", "status", "verified_at"])
    record(user, verification, "VERIFIED", kind=kind)
    return verification


def require_verified_contacts(user: User) -> None:
    """Travelers need at least one verified contact (email or phone) to book.
    Whatever is still unverified is shown to the local as a trust signal."""
    if settings.REQUIRE_CONTACT_VERIFICATION and not user.has_verified_contact:
        raise DomainError(
            "Verify your email or phone number first.",
            code="contacts_not_verified",
            status_code=403,
        )


def require_active(user: User) -> None:
    if user.status != User.Status.ACTIVE:
        raise DomainError("Your account is restricted.", code="account_restricted", status_code=403)


# --- account deletion (Google Play requirement) ------------------------------
DELETED_NAME = "Deleted user"


@transaction.atomic
def delete_account(user: User, *, password: str = "", request=None) -> None:
    """Anonymise the account instead of removing the row.

    Personal data (contacts, name, photos, bio, devices) is erased and the person can't sign in
    again. Bookings, agreements, messages, reviews and safety reports stay, shown as
    "Deleted user", so the other person's history and staff safety records remain intact.
    """
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

    from apps.bookings.models import Booking, TourRequest
    from apps.experiences.models import LocalService, ServicePhoto
    from apps.notifications.models import DeviceToken
    from apps.profiles.models import (
        ExternalReviewSource,
        LocalAvailability,
        LocalProfile,
        ProfilePhoto,
        TravelerProfile,
        UserInterest,
        UserLanguage,
    )
    from apps.wishes.models import TripWish, WishOffer

    user = User.objects.select_for_update().get(pk=user.pk)
    if user.status == User.Status.DELETED:
        return
    if user.has_usable_password() and not user.check_password(password or ""):
        raise DomainError("Incorrect password.", code="invalid_password", status_code=400)
    open_bookings = Booking.objects.filter(
        _either_side(user),
        status__in=(Booking.Status.DISCUSSING, Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS,
                    Booking.Status.DISPUTED),
    )
    if open_bookings.exists():
        raise DomainError(
            "Finish or cancel your open bookings before deleting your account.",
            code="open_bookings",
            status_code=409,
        )

    now = timezone.now()
    TourRequest.objects.filter(_either_side(user), status__in=TourRequest.OPEN_STATUSES).update(
        status=TourRequest.Status.CANCELLED, updated_at=now
    )
    TripWish.objects.filter(traveler=user, status=TripWish.Status.OPEN).update(status=TripWish.Status.CLOSED)
    WishOffer.objects.filter(local=user, status=WishOffer.Status.PENDING).update(status=WishOffer.Status.WITHDRAWN)

    # Profile content and every uploaded image (files are removed by the delete/replace signals).
    for model in (ProfilePhoto, ExternalReviewSource, UserLanguage, UserInterest, LocalAvailability, DeviceToken):
        for row in model.objects.filter(**{_owner_field(model): user}):
            row.delete()
    for photo in ServicePhoto.objects.filter(service__local=user):
        photo.delete()
    LocalService.objects.filter(local=user).update(status=LocalService.Status.ARCHIVED)
    profile = user.profile
    profile.display_name = ""
    profile.bio = ""
    profile.avatar = ""
    profile.location_name = ""
    profile.save()
    LocalProfile.objects.filter(user=user).update(
        experience_summary="", areas_description="", support_skills="", pricing_note=""
    )
    TravelerProfile.objects.filter(user=user).update(wishes="", avoid_notes="")
    user.verifications.all().delete()

    user.email = f"deleted-{user.pk}@deleted.tour-op.invalid"
    user.phone = None
    user.full_name = DELETED_NAME
    user.status = User.Status.DELETED
    user.is_active = False
    user.is_staff = False
    user.is_superuser = False
    user.set_unusable_password()
    user.save()

    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)
    record(user, user, "ACCOUNT_DELETED", request=request)


def _either_side(user: User):
    from django.db.models import Q

    return Q(traveler=user) | Q(local=user)


def _owner_field(model) -> str:
    return "local" if model.__name__ == "LocalAvailability" else "user"
