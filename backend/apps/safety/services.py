from django.db import transaction

from apps.audit.services import record
from apps.common.exceptions import DomainError
from apps.messaging.models import Message

from .models import Block, Report

AUTO_SEVERITY = {
    Report.Category.SAFETY: Report.Severity.CRITICAL,
    Report.Category.INAPPROPRIATE_BEHAVIOUR: Report.Severity.HIGH,
    Report.Category.OVERCHARGING: Report.Severity.MEDIUM,
    Report.Category.ITINERARY_DEVIATION: Report.Severity.MEDIUM,
}
DISPUTABLE_STATUSES = ("CONFIRMED", "IN_PROGRESS", "COMPLETED")


@transaction.atomic
def create_report(reporter, *, category, description, reported_user=None, booking=None, message=None,
                  review=None, tour_request=None, open_dispute=False, request=None) -> Report:
    if not description.strip():
        raise DomainError("Describe what happened.", code="description_required")

    # Context objects must be ones the reporter legitimately has access to.
    if booking is not None:
        if not booking.is_participant(reporter):
            raise DomainError("Booking not found.", code="not_found", status_code=404)
        reported_user = reported_user or booking.other_party(reporter)
    if message is not None:
        if not message.conversation.members.filter(user=reporter).exists() or message.sender_id == reporter.id:
            raise DomainError("Message not found.", code="not_found", status_code=404)
        if message.kind != Message.Kind.TEXT:
            raise DomainError("System messages can't be reported.", code="invalid_target")
        reported_user = message.sender
        booking = booking or message.conversation.booking
    if review is not None:
        if review.reviewer_id == reporter.id:
            raise DomainError("You can't report your own review.", code="invalid_target")
        reported_user = review.reviewer
    if tour_request is not None:
        if reporter.id not in (tour_request.traveler_id, tour_request.local_id):
            raise DomainError("Request not found.", code="not_found", status_code=404)
        reported_user = reported_user or (
            tour_request.local if reporter.id == tour_request.traveler_id else tour_request.traveler
        )
    if reported_user is not None and reported_user.id == reporter.id:
        raise DomainError("You can't report yourself.", code="invalid_target")
    if reported_user is None:
        raise DomainError("Choose who or what you're reporting.", code="target_required")

    report = Report.objects.create(
        reporter=reporter,
        reported_user=reported_user,
        booking=booking,
        message=message,
        review=review,
        tour_request=tour_request,
        category=category,
        description=description,
        severity=AUTO_SEVERITY.get(category, Report.Severity.LOW),
    )
    record(reporter, report, "REPORT_FILED", request=request, category=category,
           reported_user_id=reported_user.id)

    if open_dispute:
        if booking is None or booking.status not in DISPUTABLE_STATUSES:
            raise DomainError("A dispute can only be opened on a confirmed or completed booking.",
                              code="not_disputable")
        from apps.bookings.services import open_dispute as open_booking_dispute

        open_booking_dispute(reporter, booking, report.id)
        report.opened_dispute = True
        report.save(update_fields=["opened_dispute"])
    return report


def block_user(blocker, blocked) -> Block:
    if blocker.id == blocked.id:
        raise DomainError("You can't block yourself.", code="invalid_target")
    block, created = Block.objects.get_or_create(blocker=blocker, blocked=blocked)
    if created:
        record(blocker, block, "USER_BLOCKED", blocked_user_id=blocked.id)
    return block


def unblock_user(blocker, blocked) -> None:
    deleted, _ = Block.objects.filter(blocker=blocker, blocked=blocked).delete()
    if deleted:
        record(blocker, ("safety.block", f"{blocker.id}:{blocked.id}"), "USER_UNBLOCKED")
