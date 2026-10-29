"""Trip wishes: matching qualified locals, offers, and choosing one."""
from django.conf import settings
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.utils import timezone

from apps.accounts.models import User, UserRole, Verification
from apps.accounts.services import require_active, require_verified_contacts
from apps.audit.services import record
from apps.common.contact_filter import scan
from apps.common.exceptions import DomainError
from apps.common.fields import PROFILE_FORBIDDEN
from apps.discovery.matching import MatchContext, score_local
from apps.experiences.models import LocalService
from apps.notifications.services import notify
from apps.profiles.models import LocalProfile
from apps.profiles.selectors import is_blocked_between
from apps.safety.models import Block

from .models import TripWish, WishCandidate, WishOffer

MAX_OPEN_WISHES = 3
MAX_NOTIFIED_LOCALS = 30


def _forbid(code, detail, status_code=400):
    raise DomainError(detail, code=code, status_code=status_code)


def _check_text(**fields):
    for name, value in fields.items():
        if value and PROFILE_FORBIDDEN.intersection(scan(value).reasons):
            _forbid("contact_info_not_allowed", f"Remove contact details or links from '{name}'.")


# --- matching ------------------------------------------------------------------
def qualified_locals(wish: TripWish):
    """Locals in the wish's city who meet every requirement the traveler set."""
    qs = User.objects.filter(
        roles__role=UserRole.Role.LOCAL,
        status=User.Status.ACTIVE,
        is_active=True,
        profile__city=wish.city,
        local_profile__is_accepting_requests=True,
        local_profile__price_min__isnull=False,
    ).exclude(id=wish.traveler_id)

    blocked = set(Block.objects.filter(blocker=wish.traveler).values_list("blocked_id", flat=True)) | set(
        Block.objects.filter(blocked=wish.traveler).values_list("blocker_id", flat=True)
    )
    qs = qs.exclude(id__in=blocked)

    if settings.REQUIRE_CONTACT_VERIFICATION:
        def verified(kind, field):
            return Exists(Verification.objects.filter(
                user=OuterRef("pk"), kind=kind, status=Verification.Status.VERIFIED, target=OuterRef(field)
            ))
        # Phone verification is optional for now (no SMS provider yet).
        qs = qs.filter(verified(Verification.Kind.EMAIL, "email"))
    if wish.language_id:
        qs = qs.filter(languages__language_id=wish.language_id)
    if wish.category_id:
        qs = qs.filter(services__category_id=wish.category_id, services__status=LocalService.Status.ACTIVE)
    if wish.require_manually_checked:
        qs = qs.filter(local_profile__review_status=LocalProfile.ReviewStatus.MANUALLY_CHECKED)
    if wish.budget_max:
        qs = qs.filter(local_profile__price_min__lte=wish.budget_max)
    return qs.distinct()


def rank_candidates(wish: TripWish) -> list[tuple[User, int, list[dict]]]:
    from apps.discovery.views import LocalSearchView

    users = qualified_locals(wish).select_related("profile", "profile__city", "local_profile").prefetch_related(
        "languages__language", "interests__interest", "services__category"
    )
    interests = set(wish.interests.values_list("slug", flat=True))
    ranked = []
    for user in users:
        card = LocalSearchView._card(user, None)
        trust = card["trust"]
        if wish.min_rating is not None and (trust["rating_avg"] is None or trust["rating_avg"] < float(wish.min_rating)):
            continue
        available = user.availability.filter(start_at__lte=wish.end_at, end_at__gte=wish.start_at).exists()
        ctx = MatchContext(
            language=wish.language.code if wish.language_id else None,
            interests=interests,
            category=wish.category.slug if wish.category_id else None,
            date_available=available,
            budget_max=wish.budget_max,
        )
        score, reasons = score_local(card, ctx)
        ranked.append((user, score, reasons))
    ranked.sort(key=lambda r: r[1], reverse=True)
    return ranked[:MAX_NOTIFIED_LOCALS]


def match_and_notify(wish: TripWish) -> int:
    now = timezone.now()
    created = 0
    for local, score, reasons in rank_candidates(wish):
        _, is_new = WishCandidate.objects.get_or_create(
            wish=wish, local=local, defaults={"score": score, "reasons": reasons, "notified_at": now}
        )
        if is_new:
            created += 1
            notify(local, "wish_match", {"wish_id": wish.id}, actor=wish.traveler)
    record(wish.traveler, wish, "WISH_MATCHED", candidates=created)
    return created


# --- traveler actions ------------------------------------------------------------
@transaction.atomic
def create_wish(traveler: User, *, interests=(), **data) -> TripWish:
    from apps.bookings.services import _validate_group, _validate_times

    require_active(traveler)
    require_verified_contacts(traveler)
    if not traveler.has_role(UserRole.Role.TRAVELER):
        _forbid("not_traveler", "Add the Traveler role to post a trip wish.", 403)
    if TripWish.objects.filter(traveler=traveler, status=TripWish.Status.OPEN).count() >= MAX_OPEN_WISHES:
        _forbid("too_many_wishes", f"You can have at most {MAX_OPEN_WISHES} open trip wishes.")
    _validate_times(data["start_at"], data["end_at"])
    _validate_group(data["group_size"])
    if data.get("budget_min") and data.get("budget_max") and data["budget_max"] < data["budget_min"]:
        _forbid("invalid_budget", "Maximum budget must be at least the minimum.")
    _check_text(title=data.get("title"), description=data.get("description"), area=data.get("area"),
                avoid_notes=data.get("avoid_notes"))

    wish = TripWish.objects.create(traveler=traveler, **data)
    if interests:
        wish.interests.set(interests)
    record(traveler, wish, "WISH_CREATED", city=wish.city.slug)
    transaction.on_commit(lambda: _match_after_commit(wish.id))
    return wish


def _match_after_commit(wish_id: int):
    from .tasks import match_wish

    match_wish.delay(wish_id)


def _require_owner(wish: TripWish, user: User):
    if wish.traveler_id != user.id:
        _forbid("not_found", "Trip wish not found.", 404)


def _require_open(wish: TripWish):
    if wish.status != TripWish.Status.OPEN:
        _forbid("wish_closed", "This trip wish is no longer open.", 409)


@transaction.atomic
def close_wish(traveler: User, wish: TripWish) -> TripWish:
    _require_owner(wish, traveler)
    _require_open(wish)
    wish.status = TripWish.Status.CLOSED
    wish.closed_at = timezone.now()
    wish.save(update_fields=["status", "closed_at", "updated_at"])
    _close_pending_offers(wish, notify_kind="wish_closed")
    record(traveler, wish, "WISH_CLOSED")
    return wish


def _close_pending_offers(wish: TripWish, notify_kind: str, exclude_id: int | None = None):
    pending = wish.offers.filter(status=WishOffer.Status.PENDING)
    if exclude_id:
        pending = pending.exclude(id=exclude_id)
    for offer in pending:
        offer.status = WishOffer.Status.DECLINED
        offer.responded_at = timezone.now()
        offer.save(update_fields=["status", "responded_at"])
        notify(offer.local, notify_kind, {"wish_id": wish.id})


@transaction.atomic
def accept_offer(traveler: User, offer: WishOffer):
    from apps.bookings.services import open_booking_from_wish

    wish = TripWish.objects.select_for_update().get(pk=offer.wish_id)
    _require_owner(wish, traveler)
    _require_open(wish)
    if offer.status != WishOffer.Status.PENDING:
        _forbid("offer_not_open", "This offer is no longer available.", 409)
    if offer.local.status != User.Status.ACTIVE:
        _forbid("local_unavailable", "This local isn't available.", 404)

    booking = open_booking_from_wish(traveler, offer.local, wish, offer.message)
    offer.status = WishOffer.Status.ACCEPTED
    offer.responded_at = timezone.now()
    offer.booking = booking
    offer.save(update_fields=["status", "responded_at", "booking"])
    wish.status = TripWish.Status.MATCHED
    wish.matched_local = offer.local
    wish.closed_at = timezone.now()
    wish.save(update_fields=["status", "matched_local", "closed_at", "updated_at"])
    _close_pending_offers(wish, notify_kind="wish_filled", exclude_id=offer.id)
    return booking


@transaction.atomic
def decline_offer(traveler: User, offer: WishOffer) -> WishOffer:
    _require_owner(offer.wish, traveler)
    if offer.status != WishOffer.Status.PENDING:
        _forbid("offer_not_open", "This offer is no longer available.", 409)
    offer.status = WishOffer.Status.DECLINED
    offer.responded_at = timezone.now()
    offer.save(update_fields=["status", "responded_at"])
    record(traveler, offer, "WISH_OFFER_DECLINED", wish_id=offer.wish_id)
    notify(offer.local, "wish_offer_declined", {"wish_id": offer.wish_id}, actor=traveler)
    return offer


# --- local actions -------------------------------------------------------------------
def get_candidate(local: User, wish: TripWish) -> WishCandidate:
    candidate = WishCandidate.objects.filter(wish=wish, local=local).first()
    if candidate is None:
        _forbid("not_found", "Trip wish not found.", 404)
    return candidate


@transaction.atomic
def make_offer(local: User, wish: TripWish, *, message: str, proposed_price: int | None = None) -> WishOffer:
    get_candidate(local, wish)
    _require_open(wish)
    require_active(local)
    if wish.start_at <= timezone.now():
        _forbid("start_in_past", "This trip's start time has passed.")
    if is_blocked_between(local, wish.traveler):
        _forbid("not_found", "Trip wish not found.", 404)
    if not message.strip():
        _forbid("message_required", "Introduce yourself and explain what you'd offer.")
    _check_text(message=message)

    offer, created = WishOffer.objects.get_or_create(
        wish=wish, local=local, defaults={"message": message, "proposed_price": proposed_price}
    )
    if not created:
        if offer.status != WishOffer.Status.WITHDRAWN:
            _forbid("already_offered", "You already responded to this trip wish.", 409)
        offer.message, offer.proposed_price = message, proposed_price
        offer.status, offer.responded_at = WishOffer.Status.PENDING, None
        offer.save()
    record(local, offer, "WISH_OFFER_SENT", wish_id=wish.id)
    notify(wish.traveler, "wish_offer_received", {"wish_id": wish.id}, actor=local)
    return offer


@transaction.atomic
def withdraw_offer(local: User, offer: WishOffer) -> WishOffer:
    if offer.local_id != local.id:
        _forbid("not_found", "Offer not found.", 404)
    if offer.status != WishOffer.Status.PENDING:
        _forbid("offer_not_open", "This offer can no longer be withdrawn.", 409)
    offer.status = WishOffer.Status.WITHDRAWN
    offer.responded_at = timezone.now()
    offer.save(update_fields=["status", "responded_at"])
    record(local, offer, "WISH_OFFER_WITHDRAWN", wish_id=offer.wish_id)
    return offer


def dismiss(local: User, wish: TripWish) -> None:
    candidate = get_candidate(local, wish)
    candidate.dismissed = True
    candidate.save(update_fields=["dismissed"])


def expire_wishes() -> int:
    count = 0
    for wish in TripWish.objects.filter(status=TripWish.Status.OPEN, start_at__lte=timezone.now()):
        wish.status = TripWish.Status.EXPIRED
        wish.closed_at = timezone.now()
        wish.save(update_fields=["status", "closed_at", "updated_at"])
        _close_pending_offers(wish, notify_kind="wish_closed")
        notify(wish.traveler, "wish_expired", {"wish_id": wish.id})
        count += 1
    return count
