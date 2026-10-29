from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

from .models import Notification

# Short English fallbacks for push/email; clients render localized text from `kind`.
PUSH_TEXT = {
    "request_received": "You have a new tour request.",
    "request_received_unverified_phone": "You have a new tour request. The traveler hasn't verified their phone number.",
    "request_received_unverified_email": "You have a new tour request. The traveler hasn't verified their email.",
    "request_updated": "A traveler updated their request.",
    "request_cancelled": "A traveler cancelled their request.",
    "request_accepted": "Your request was accepted. You can now chat.",
    "request_declined": "Your request was declined.",
    "request_expired": "Your request expired without a reply. Try another local.",
    "request_needs_info": "The local needs more information about your request.",
    "agreement_proposed": "A new itinerary and price proposal is ready to review.",
    "agreement_accepted": "The traveler accepted the updated itinerary.",
    "agreement_changes_requested": "The traveler requested changes to the itinerary.",
    "booking_confirmed": "Your tour is confirmed.",
    "booking_in_progress": "Your tour has started.",
    "booking_completed": "Tour completed. Leave a review!",
    "booking_cancelled": "A booking was cancelled.",
    "booking_disputed": "A booking has been marked as disputed.",
    "wish_match": "A traveler is looking for a local like you. See their trip wish.",
    "wish_offer_received": "A local responded to your trip wish.",
    "wish_offer_accepted": "The traveler chose you for their trip. You can chat now.",
    "wish_offer_declined": "The traveler chose another option for their trip.",
    "wish_filled": "A trip wish you answered has been filled.",
    "wish_closed": "A trip wish you answered was closed.",
    "wish_expired": "Your trip wish expired.",
    "message_received": "You have a new message.",
    "review_received": "You received a new review.",
    "report_updated": "There's an update on your report.",
}

EMAIL_KINDS = {"wish_match", "wish_offer_accepted", "request_received", "request_accepted", "booking_confirmed", "booking_cancelled"}


def push_text(kind: str, data: dict | None = None, default: str = "You have an update.") -> str:
    """English push/email text; `data["context"]` selects a variant like request_received_unverified_phone."""
    context = (data or {}).get("context")
    return PUSH_TEXT.get(f"{kind}_{context}") or PUSH_TEXT.get(kind, default)


def user_group(user_id: int) -> str:
    return f"user_{user_id}"


def serialize(notification: Notification) -> dict:
    return {
        "id": notification.id,
        "kind": notification.kind,
        "data": notification.data,
        "actor_id": notification.actor_id,
        "read": notification.read_at is not None,
        "created_at": notification.created_at.isoformat(),
    }


def notify(user, kind: str, data: dict | None = None, actor=None) -> Notification:
    from .tasks import send_email_notification, send_push_notification

    notification = Notification.objects.create(user=user, kind=kind, data=data or {}, actor=actor)
    payload = serialize(notification)

    def _deliver():
        layer = get_channel_layer()
        if layer is not None:
            async_to_sync(layer.group_send)(user_group(user.id), {"type": "notification.new", "notification": payload})
        send_push_notification.delay(user.id, kind, data or {})
        if kind in EMAIL_KINDS:
            send_email_notification.delay(user.id, kind, data or {})

    transaction.on_commit(_deliver)
    return notification
