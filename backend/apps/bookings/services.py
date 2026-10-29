"""Business rules for tour requests, bookings and agreements.

All state changes go through these functions so that transitions are
validated, audited, announced in the conversation and notified.
"""
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.accounts.models import User, UserRole, Verification
from apps.accounts.services import require_active, require_verified_contacts
from apps.audit.services import record
from apps.common.contact_filter import scan
from apps.common.exceptions import DomainError
from apps.common.fields import PROFILE_FORBIDDEN
from apps.messaging import services as messaging
from apps.notifications.services import notify
from apps.profiles.models import Place
from apps.profiles.selectors import is_blocked_between

from .models import Agreement, Booking, ItineraryStop, TourRequest, TripShare

MAX_REQUEST_HOURS = 72
START_GRACE = timedelta(hours=1)


def _forbid(code: str, detail: str, status_code: int = 400):
    raise DomainError(detail, code=code, status_code=status_code)


def _check_text(**fields):
    for name, value in fields.items():
        if value and PROFILE_FORBIDDEN.intersection(scan(value).reasons):
            raise DomainError(
                f"Remove contact details or links from '{name}'. Keep communication inside Tour-op.",
                code="contact_info_not_allowed",
            )


def _validate_times(start_at, end_at):
    if end_at <= start_at:
        _forbid("invalid_times", "End time must be after start time.")
    if start_at <= timezone.now():
        _forbid("start_in_past", "Start time must be in the future.")
    if end_at - start_at > timedelta(hours=MAX_REQUEST_HOURS):
        _forbid("too_long", f"An experience can last at most {MAX_REQUEST_HOURS} hours.")


def _validate_group(size: int, service=None):
    if size < 1 or size > settings.MAX_GROUP_SIZE:
        _forbid("invalid_group_size", f"Group size must be between 1 and {settings.MAX_GROUP_SIZE}.")
    if service is not None and size > service.max_group_size:
        _forbid("group_too_large_for_service", "This experience doesn't accept a group that large.")


# --- tour requests -----------------------------------------------------------
@transaction.atomic
def create_request(traveler: User, *, local: User, interests=(), **data) -> TourRequest:
    require_active(traveler)
    require_verified_contacts(traveler)
    if not traveler.has_role(UserRole.Role.TRAVELER):
        _forbid("not_traveler", "Add the Traveler role to send requests.", 403)
    if local.id == traveler.id:
        _forbid("self_request", "You can't send a request to yourself.")
    if not local.has_role(UserRole.Role.LOCAL) or local.status != User.Status.ACTIVE:
        _forbid("local_unavailable", "This local isn't available.", 404)
    if is_blocked_between(traveler, local):
        _forbid("local_unavailable", "This local isn't available.", 404)
    local_profile = getattr(local, "local_profile", None)
    if not local_profile or not local_profile.is_accepting_requests:
        _forbid("not_accepting", "This local isn't accepting requests right now.")
    if not local_profile.has_pricing:
        _forbid("local_no_pricing", "This local hasn't published pricing yet.")
    # Phone verification is optional for now (no SMS provider yet); a verified email is enough.
    if settings.REQUIRE_CONTACT_VERIFICATION and not local.is_verified(Verification.Kind.EMAIL):
        _forbid("local_unverified", "This local hasn't finished verifying their contact details.")

    service = data.get("service")
    if service is not None and (service.local_id != local.id or service.status != service.Status.ACTIVE):
        _forbid("invalid_service", "That experience isn't offered by this local.")
    _validate_times(data["start_at"], data["end_at"])
    _validate_group(data["group_size"], service)
    if data.get("budget_min") and data.get("budget_max") and data["budget_max"] < data["budget_min"]:
        _forbid("invalid_budget", "Maximum budget must be at least the minimum.")
    _check_text(area=data.get("area"), wishes=data.get("wishes"), avoid_notes=data.get("avoid_notes"))

    if TourRequest.objects.filter(
        traveler=traveler, local=local, status__in=TourRequest.OPEN_STATUSES
    ).exists():
        _forbid("duplicate_request", "You already have an open request with this local.")

    expires = min(timezone.now() + timedelta(hours=settings.TOUR_REQUEST_EXPIRY_HOURS), data["start_at"])
    req = TourRequest.objects.create(traveler=traveler, local=local, expires_at=expires, **data)
    if interests:
        req.interests.set(interests)
    record(traveler, req, "REQUEST_CREATED", local_id=local.id)
    data = {"request_id": req.id}
    if traveler.unverified_contacts == [Verification.Kind.PHONE]:
        data["context"] = "unverified_phone"  # clients render notification.request_received_unverified_phone
    elif traveler.unverified_contacts == [Verification.Kind.EMAIL]:
        data["context"] = "unverified_email"
    notify(local, "request_received", data, actor=traveler)
    return req


def _require_request_party(req: TourRequest, user: User, side: str):
    if getattr(req, f"{side}_id") != user.id:
        _forbid("not_allowed", "You can't perform this action on this request.", 403)


def _require_open(req: TourRequest):
    if req.status not in TourRequest.OPEN_STATUSES:
        _forbid("request_closed", "This request is no longer open.")


@transaction.atomic
def update_request(traveler: User, req: TourRequest, *, interests=None, **data) -> TourRequest:
    _require_request_party(req, traveler, "traveler")
    _require_open(req)
    start = data.get("start_at", req.start_at)
    end = data.get("end_at", req.end_at)
    _validate_times(start, end)
    _validate_group(data.get("group_size", req.group_size), data.get("service", req.service))
    _check_text(area=data.get("area"), wishes=data.get("wishes"), avoid_notes=data.get("avoid_notes"))
    for k, v in data.items():
        setattr(req, k, v)
    req.status = TourRequest.Status.PENDING
    req.save()
    if interests is not None:
        req.interests.set(interests)
    record(traveler, req, "REQUEST_UPDATED")
    notify(req.local, "request_updated", {"request_id": req.id}, actor=traveler)
    return req


@transaction.atomic
def cancel_request(traveler: User, req: TourRequest) -> TourRequest:
    _require_request_party(req, traveler, "traveler")
    _require_open(req)
    req.status = TourRequest.Status.CANCELLED
    req.save(update_fields=["status", "updated_at"])
    record(traveler, req, "REQUEST_CANCELLED")
    notify(req.local, "request_cancelled", {"request_id": req.id}, actor=traveler)
    return req


@transaction.atomic
def accept_request(local: User, req: TourRequest) -> Booking:
    """Accepting opens a discussion; it does not confirm the tour."""
    _require_request_party(req, local, "local")
    _require_open(req)
    require_active(local)
    if is_blocked_between(local, req.traveler):
        _forbid("blocked", "You can't accept this request.", 403)
    if req.start_at <= timezone.now():
        _forbid("start_in_past", "This request's start time has passed.")
    req.status = TourRequest.Status.ACCEPTED
    req.responded_at = timezone.now()
    req.save(update_fields=["status", "responded_at", "updated_at"])
    booking = _open_booking(req)
    messaging.post_system_message(booking, "request_accepted")
    record(local, req, "REQUEST_ACCEPTED", booking_id=booking.id)
    notify(req.traveler, "request_accepted", {"request_id": req.id, "booking_id": booking.id}, actor=local)
    return booking


def _open_booking(req: TourRequest) -> Booking:
    """Create the booking (DISCUSSING) and its conversation for an accepted request."""
    booking = Booking.objects.create(
        tour_request=req,
        traveler=req.traveler,
        local=req.local,
        service=req.service,
        start_at=req.start_at,
        end_at=req.end_at,
        group_size=req.group_size,
        currency=req.currency,
    )
    messaging.open_conversation(booking)
    return booking


@transaction.atomic
def open_booking_from_wish(traveler: User, local: User, wish, offer_message: str = "") -> Booking:
    """The traveler chose a local who answered their trip wish.

    Both sides have already expressed interest, so the request is created as
    ACCEPTED and goes straight to discussion. Like any booking, nothing is
    confirmed until the traveler accepts a written agreement.
    """
    if is_blocked_between(traveler, local):
        _forbid("blocked", "You can't book with this person.", 403)
    if wish.start_at <= timezone.now():
        _forbid("start_in_past", "This trip's start time has passed.")
    req = TourRequest.objects.create(
        traveler=traveler,
        local=local,
        wish=wish,
        city=wish.city,
        area=wish.area,
        start_at=wish.start_at,
        end_at=wish.end_at,
        group_size=wish.group_size,
        budget_min=wish.budget_min,
        budget_max=wish.budget_max,
        currency=wish.currency,
        language=wish.language,
        wishes=wish.description,
        avoid_notes=wish.avoid_notes,
        status=TourRequest.Status.ACCEPTED,
        responded_at=timezone.now(),
        local_note=offer_message,
    )
    req.interests.set(wish.interests.all())
    booking = _open_booking(req)
    messaging.post_system_message(booking, "wish_offer_accepted")
    record(traveler, req, "WISH_OFFER_ACCEPTED", booking_id=booking.id, wish_id=wish.id)
    notify(local, "wish_offer_accepted", {"wish_id": wish.id, "booking_id": booking.id}, actor=traveler)
    return booking


@transaction.atomic
def decline_request(local: User, req: TourRequest, note: str = "") -> TourRequest:
    _require_request_party(req, local, "local")
    _require_open(req)
    _check_text(note=note)
    req.status = TourRequest.Status.DECLINED
    req.local_note = note
    req.responded_at = timezone.now()
    req.save(update_fields=["status", "local_note", "responded_at", "updated_at"])
    record(local, req, "REQUEST_DECLINED")
    notify(req.traveler, "request_declined", {"request_id": req.id}, actor=local)
    return req


@transaction.atomic
def ask_for_info(local: User, req: TourRequest, note: str) -> TourRequest:
    _require_request_party(req, local, "local")
    _require_open(req)
    if not note.strip():
        _forbid("note_required", "Tell the traveler what information you need.")
    _check_text(note=note)
    req.status = TourRequest.Status.NEEDS_INFO
    req.local_note = note
    req.responded_at = timezone.now()
    req.save(update_fields=["status", "local_note", "responded_at", "updated_at"])
    record(local, req, "REQUEST_INFO_REQUESTED")
    notify(req.traveler, "request_needs_info", {"request_id": req.id}, actor=local)
    return req


# --- booking state machine ---------------------------------------------------
S = Booking.Status
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    S.DISCUSSING: {S.CONFIRMED, S.CANCELLED},
    S.CONFIRMED: {S.IN_PROGRESS, S.COMPLETED, S.CANCELLED, S.DISPUTED},
    S.IN_PROGRESS: {S.COMPLETED, S.DISPUTED},
    S.COMPLETED: {S.DISPUTED},
    S.DISPUTED: {S.COMPLETED, S.CANCELLED},
}


def _transition(booking: Booking, to: str, actor: User | None, **meta) -> Booking:
    if to not in ALLOWED_TRANSITIONS.get(booking.status, set()):
        raise DomainError(
            f"Can't change booking from {booking.status} to {to}.", code="invalid_transition", status_code=409
        )
    previous = booking.status
    booking.status = to
    now = timezone.now()
    stamp = {S.CONFIRMED: "confirmed_at", S.IN_PROGRESS: "started_at", S.COMPLETED: "completed_at",
             S.CANCELLED: "cancelled_at"}.get(to)
    if stamp:
        setattr(booking, stamp, now)
    booking.save()
    record(actor, booking, f"STATUS_{to}", previous=previous, **meta)
    messaging.post_system_message(booking, f"booking_{to.lower()}", meta)
    for party in (booking.traveler, booking.local):
        if actor is None or party.id != actor.id:
            notify(party, f"booking_{to.lower()}", {"booking_id": booking.id}, actor=actor)
    return booking


def _require_participant(booking: Booking, user: User):
    if not booking.is_participant(user):
        _forbid("not_found", "Booking not found.", 404)


@transaction.atomic
def cancel_booking(user: User, booking: Booking, reason: str) -> Booking:
    _require_participant(booking, user)
    if not reason.strip():
        _forbid("reason_required", "Please give a reason for cancelling.")
    _check_text(reason=reason)
    late = booking.status == S.CONFIRMED and booking.start_at - timezone.now() < timedelta(hours=24)
    booking.cancelled_by = user
    booking.cancel_reason = reason
    _transition(booking, S.CANCELLED, user, late_cancellation=late, by_role=booking.role_of(user))
    messaging.close_conversation(booking)
    return booking


@transaction.atomic
def start_booking(user: User, booking: Booking) -> Booking:
    _require_participant(booking, user)
    if timezone.now() < booking.start_at - START_GRACE:
        _forbid("too_early", "You can start the tour at most 1 hour before the agreed time.")
    return _transition(booking, S.IN_PROGRESS, user)


@transaction.atomic
def complete_booking(user: User | None, booking: Booking) -> Booking:
    if user is not None:
        _require_participant(booking, user)
    if timezone.now() < booking.start_at:
        _forbid("too_early", "The tour hasn't started yet.")
    return _transition(booking, S.COMPLETED, user)


@transaction.atomic
def open_dispute(user: User, booking: Booking, report_id: int) -> Booking:
    _require_participant(booking, user)
    booking.status_before_dispute = booking.status
    return _transition(booking, S.DISPUTED, user, report_id=report_id)


@transaction.atomic
def resolve_dispute(staff: User, booking: Booking, outcome: str, note: str = "") -> Booking:
    if outcome not in (S.COMPLETED, S.CANCELLED):
        _forbid("invalid_outcome", "Outcome must be COMPLETED or CANCELLED.")
    if outcome == S.COMPLETED and not booking.completed_at:
        booking.completed_at = timezone.now()
    return _transition(booking, outcome, staff, resolution=note)


# --- agreements --------------------------------------------------------------
AGREEMENT_TEXT_FIELDS = (
    "meeting_point", "scope", "included", "excluded", "cost_tickets", "cost_transport", "cost_food",
    "cost_overtime", "cost_other", "cancellation_policy", "notes",
)


@transaction.atomic
def propose_agreement(local: User, booking: Booking, *, stops: list[dict], **data) -> Agreement:
    if booking.local_id != local.id:
        _forbid("not_allowed", "Only the local proposes the itinerary and price.", 403)
    if booking.status not in (S.DISCUSSING, S.CONFIRMED):
        _forbid("booking_locked", "The itinerary can't be changed at this stage.", 409)
    _validate_times(data["start_at"], data["end_at"])
    _validate_group(data["group_size"])
    if not stops:
        _forbid("stops_required", "Add at least one stop to the itinerary.")
    _check_text(**{f: data.get(f) for f in AGREEMENT_TEXT_FIELDS})
    for stop in stops:
        _check_text(place=stop.get("place_name"), activity=stop.get("activity"))

    Booking.objects.select_for_update().get(pk=booking.pk)
    booking.agreements.filter(status=Agreement.Status.PROPOSED).update(
        status=Agreement.Status.WITHDRAWN, responded_at=timezone.now()
    )
    version = (booking.agreements.aggregate(v=Max("version"))["v"] or 0) + 1
    agreement = Agreement.objects.create(
        booking=booking, version=version, proposed_by=local, local_accepted_at=timezone.now(), **data
    )
    places = _places_by_name(booking.tour_request.city_id)
    ItineraryStop.objects.bulk_create(
        [ItineraryStop(agreement=agreement, order=i, place=places.get(stop["place_name"].strip().casefold()),
                       **{k: v for k, v in stop.items() if k not in ("id", "place")})
         for i, stop in enumerate(stops)]
    )
    record(local, agreement, "AGREEMENT_PROPOSED", booking_id=booking.id, version=version)
    messaging.post_system_message(booking, "agreement_proposed", {"version": version})
    notify(booking.traveler, "agreement_proposed", {"booking_id": booking.id, "version": version}, actor=local)
    return agreement


def _places_by_name(city_id) -> dict[str, Place]:
    """Recommended places in the city, keyed by their English and Vietnamese names."""
    places = {}
    for place in Place.objects.filter(city_id=city_id, is_active=True):
        for name in (place.name, place.name_vi):
            if name:
                places.setdefault(name.strip().casefold(), place)
    return places


def _require_latest_proposal(agreement: Agreement):
    if agreement.status != Agreement.Status.PROPOSED:
        _forbid("agreement_not_open", "This proposal is no longer open.", 409)


@transaction.atomic
def accept_agreement(traveler: User, agreement: Agreement, declined_stop_ids=(), acknowledge_costs=False) -> Agreement:
    booking = agreement.booking
    if booking.traveler_id != traveler.id:
        _forbid("not_allowed", "Only the traveler accepts the proposal.", 403)
    _require_latest_proposal(agreement)
    if booking.status not in (S.DISCUSSING, S.CONFIRMED):
        _forbid("booking_locked", "This booking can no longer be changed.", 409)
    if not acknowledge_costs:
        _forbid("acknowledge_required", "Please review and acknowledge the price and extra costs.")
    if agreement.start_at <= timezone.now():
        _forbid("start_in_past", "This proposal's start time has passed. Ask for a new one.")

    declined_stop_ids = set(declined_stop_ids or [])
    if declined_stop_ids:
        stops = {s.id: s for s in agreement.stops.all()}
        for sid in declined_stop_ids:
            stop = stops.get(sid)
            if stop is None:
                _forbid("invalid_stop", "Unknown itinerary stop.")
            if stop.kind not in ItineraryStop.DECLINABLE_KINDS:
                _forbid("stop_not_declinable", "Only shopping, food and partner stops can be declined.")
        agreement.stops.filter(id__in=declined_stop_ids).update(declined_by_traveler=True)

    now = timezone.now()
    booking.agreements.filter(status=Agreement.Status.ACCEPTED).update(status=Agreement.Status.SUPERSEDED)
    agreement.status = Agreement.Status.ACCEPTED
    agreement.traveler_accepted_at = now
    agreement.responded_at = now
    agreement.save(update_fields=["status", "traveler_accepted_at", "responded_at"])

    booking.current_agreement = agreement
    booking.agreed_price = agreement.total_price
    booking.currency = agreement.currency
    booking.start_at = agreement.start_at
    booking.end_at = agreement.end_at
    booking.group_size = agreement.group_size
    booking.save()
    record(traveler, agreement, "AGREEMENT_ACCEPTED", booking_id=booking.id, version=agreement.version,
           declined_stops=sorted(declined_stop_ids))
    if booking.status == S.DISCUSSING:
        _transition(booking, S.CONFIRMED, traveler, version=agreement.version)
    else:
        messaging.post_system_message(booking, "agreement_accepted", {"version": agreement.version})
        notify(booking.local, "agreement_accepted", {"booking_id": booking.id, "version": agreement.version},
               actor=traveler)
    return agreement


@transaction.atomic
def request_changes(traveler: User, agreement: Agreement, note: str) -> Agreement:
    booking = agreement.booking
    if booking.traveler_id != traveler.id:
        _forbid("not_allowed", "Only the traveler can request changes.", 403)
    _require_latest_proposal(agreement)
    if not note.strip():
        _forbid("note_required", "Describe the changes you'd like.")
    _check_text(note=note)
    agreement.status = Agreement.Status.CHANGES_REQUESTED
    agreement.response_note = note
    agreement.responded_at = timezone.now()
    agreement.save(update_fields=["status", "response_note", "responded_at"])
    record(traveler, agreement, "AGREEMENT_CHANGES_REQUESTED", booking_id=booking.id)
    messaging.post_system_message(booking, "agreement_changes_requested", {"version": agreement.version})
    notify(booking.local, "agreement_changes_requested", {"booking_id": booking.id}, actor=traveler)
    return agreement


@transaction.atomic
def withdraw_agreement(local: User, agreement: Agreement) -> Agreement:
    if agreement.booking.local_id != local.id:
        _forbid("not_allowed", "Only the proposer can withdraw.", 403)
    _require_latest_proposal(agreement)
    agreement.status = Agreement.Status.WITHDRAWN
    agreement.responded_at = timezone.now()
    agreement.save(update_fields=["status", "responded_at"])
    record(local, agreement, "AGREEMENT_WITHDRAWN")
    return agreement


# --- trip sharing ----------------------------------------------------------
SHAREABLE = (S.CONFIRMED, S.IN_PROGRESS)


def create_share(traveler: User, booking: Booking, include_itinerary: bool = True) -> TripShare:
    if booking.traveler_id != traveler.id:
        _forbid("not_allowed", "Only the traveler can share trip details.", 403)
    if booking.status not in SHAREABLE:
        _forbid("not_shareable", "You can share a trip once it's confirmed.")
    share = TripShare.objects.create(
        booking=booking,
        created_by=traveler,
        include_itinerary=include_itinerary,
        expires_at=booking.end_at + timedelta(days=1),
    )
    record(traveler, share, "TRIP_SHARED", booking_id=booking.id, include_itinerary=include_itinerary)
    return share


def revoke_share(traveler: User, share: TripShare) -> None:
    if share.created_by_id != traveler.id:
        _forbid("not_allowed", "Not your share link.", 403)
    share.revoked_at = timezone.now()
    share.save(update_fields=["revoked_at"])
    record(traveler, share, "TRIP_SHARE_REVOKED")


def share_url(share: TripShare) -> str:
    return f"{settings.WEB_APP_URL.rstrip('/')}/share/{share.token}"
