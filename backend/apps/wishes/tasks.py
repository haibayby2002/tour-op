from celery import shared_task

from . import services
from .models import TripWish


@shared_task
def match_wish(wish_id: int) -> int:
    wish = TripWish.objects.filter(pk=wish_id, status=TripWish.Status.OPEN).first()
    return services.match_and_notify(wish) if wish else 0


@shared_task
def expire_stale_wishes() -> int:
    return services.expire_wishes()
