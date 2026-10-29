from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.audit.services import record
from apps.common.contact_filter import scan
from apps.common.exceptions import DomainError
from apps.common.fields import PROFILE_FORBIDDEN
from apps.notifications.services import notify

from .models import REVIEW_WINDOW, Review


def _reviewable(booking) -> bool:
    # A booking disputed *after* completion still counts as a completed experience.
    return booking.completed_at is not None and booking.status in ("COMPLETED", "DISPUTED")


def review_state(booking, user) -> dict:
    mine = Review.objects.filter(booking=booking, reviewer=user).first()
    other_submitted = Review.objects.filter(booking=booking).exclude(reviewer=user).exists()
    closes_at = booking.completed_at + REVIEW_WINDOW if booking.completed_at else None
    can_review = (
        _reviewable(booking)
        and mine is None
        and booking.is_participant(user)
        and closes_at is not None
        and timezone.now() <= closes_at
    )
    return {
        "can_review": can_review,
        "my_review": {"id": mine.id, "rating": mine.rating, "comment": mine.comment} if mine else None,
        "other_party_reviewed": other_submitted,
        "window_closes_at": closes_at,
    }


@transaction.atomic
def create_review(user, booking, *, rating: int, comment: str = "", **trust) -> Review:
    if not booking.is_participant(user):
        raise DomainError("Booking not found.", code="not_found", status_code=404)
    if not _reviewable(booking):
        raise DomainError("You can review once the tour is completed.", code="not_completed")
    if timezone.now() > booking.completed_at + REVIEW_WINDOW:
        raise DomainError("The review window has closed.", code="review_window_closed")
    if PROFILE_FORBIDDEN.intersection(scan(comment).reasons):
        raise DomainError("Remove contact details or links from your review.", code="contact_info_not_allowed")

    reviewee = booking.other_party(user)
    reviewee_role = Review.Role.LOCAL if reviewee.id == booking.local_id else Review.Role.TRAVELER
    if reviewee_role == Review.Role.TRAVELER:
        trust = {}  # the trust questions are about the local's conduct
    try:
        review = Review.objects.create(
            booking=booking, reviewer=user, reviewee=reviewee, reviewee_role=reviewee_role,
            rating=rating, comment=comment, **trust,
        )
    except IntegrityError:
        raise DomainError("You already reviewed this booking.", code="already_reviewed", status_code=409)
    record(user, review, "REVIEW_CREATED", booking_id=booking.id, rating=rating)
    notify(reviewee, "review_received", {"booking_id": booking.id}, actor=user)
    return review
