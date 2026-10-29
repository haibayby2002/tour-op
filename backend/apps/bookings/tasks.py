from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from apps.notifications.services import notify

from . import services
from .models import Booking, TourRequest

AUTO_COMPLETE_AFTER = timedelta(hours=24)


@shared_task
def expire_stale_requests() -> int:
    """Close requests the local never answered, so travelers can look elsewhere."""
    stale = TourRequest.objects.filter(status__in=TourRequest.OPEN_STATUSES, expires_at__lt=timezone.now())
    count = 0
    for req in stale:
        req.status = TourRequest.Status.EXPIRED
        req.save(update_fields=["status", "updated_at"])
        notify(req.traveler, "request_expired", {"request_id": req.id})
        count += 1
    return count


@shared_task
def open_reviews_for_finished_tours() -> int:
    """After the agreed end time (+24h) a confirmed tour is marked completed so reviews open."""
    due = Booking.objects.filter(
        status__in=[Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS],
        end_at__lt=timezone.now() - AUTO_COMPLETE_AFTER,
    )
    count = 0
    for booking in due:
        services.complete_booking(None, booking)
        count += 1
    return count
