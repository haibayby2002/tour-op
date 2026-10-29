import json
import logging
import urllib.request

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail

logger = logging.getLogger("tourop.notifications")
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


@shared_task(autoretry_for=(OSError,), retry_backoff=True, max_retries=3)
def send_push_notification(user_id: int, kind: str, data: dict) -> None:
    from .models import DeviceToken
    from .services import push_text

    if not settings.EXPO_PUSH_ENABLED:
        return
    tokens = list(DeviceToken.objects.filter(user_id=user_id).values_list("token", flat=True))
    if not tokens:
        return
    messages = [
        {"to": t, "title": "Tour-op", "body": push_text(kind, data), "data": {"kind": kind, **data}}
        for t in tokens
    ]
    request = urllib.request.Request(
        EXPO_PUSH_URL,
        data=json.dumps(messages).encode(),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:  # noqa: S310 - fixed https URL
        body = json.loads(response.read() or b"{}")
    _handle_push_tickets(tokens, body)


def _handle_push_tickets(tokens: list[str], body: dict) -> None:
    """Expo answers 200 even when messages fail; the per-message tickets carry the real outcome."""
    from .models import DeviceToken

    if body.get("errors"):
        logger.error("Expo push request rejected: %s", body["errors"])
    stale = []
    for token, ticket in zip(tokens, body.get("data") or []):
        if ticket.get("status") == "ok":
            continue
        error = (ticket.get("details") or {}).get("error")
        logger.error("Expo push failed for %s…: %s (%s)", token[:30], ticket.get("message"), error)
        if error == "DeviceNotRegistered":
            stale.append(token)
    if stale:
        DeviceToken.objects.filter(token__in=stale).delete()


@shared_task
def send_email_notification(user_id: int, kind: str, data: dict | None = None) -> None:
    from .services import push_text

    user = get_user_model().objects.filter(id=user_id).first()
    if not user:
        return
    send_mail(
        subject=f"Tour-op: {push_text(kind, data, 'Update')}",
        message=f"{push_text(kind, data)}\n\n{settings.WEB_APP_URL}",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=True,
    )
