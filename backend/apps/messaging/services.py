from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.audit.services import record
from apps.common import contact_filter
from apps.common.exceptions import DomainError

from .models import Conversation, ConversationMember, Message


def group_name(conversation_id: int) -> str:
    return f"conversation_{conversation_id}"


def serialize_message(message: Message) -> dict:
    return {
        "id": message.id,
        "conversation": message.conversation_id,
        "sender_id": message.sender_id,
        "kind": message.kind,
        "content": "" if message.deleted_at else message.content,
        "system_code": message.system_code,
        "metadata": message.metadata,
        "moderation_status": message.moderation_status,
        "moderation_reasons": message.moderation_reasons,
        "created_at": message.created_at.isoformat(),
        "deleted": message.deleted_at is not None,
    }


def broadcast(conversation_id: int, event: dict) -> None:
    layer = get_channel_layer()
    if layer is None:
        return
    transaction.on_commit(lambda: async_to_sync(layer.group_send)(group_name(conversation_id), event))


def visible_messages(conversation: Conversation, viewer):
    """Blocked messages are only visible to their sender."""
    return conversation.messages.filter(
        ~Q(moderation_status=Message.Moderation.BLOCKED) | Q(sender=viewer)
    ).filter(deleted_at__isnull=True)


def get_conversation_for(user, conversation_id: int) -> Conversation:
    """Members only. Anyone else gets a 404, so ids can't be probed."""
    try:
        return Conversation.objects.select_related("booking").get(id=conversation_id, members__user=user)
    except Conversation.DoesNotExist:
        raise DomainError("Conversation not found.", code="not_found", status_code=404)


def open_conversation(booking) -> Conversation:
    conversation, created = Conversation.objects.get_or_create(booking=booking)
    if created:
        ConversationMember.objects.bulk_create(
            [ConversationMember(conversation=conversation, user_id=uid)
             for uid in (booking.traveler_id, booking.local_id)]
        )
    return conversation


def close_conversation(booking) -> None:
    Conversation.objects.filter(booking=booking, status=Conversation.Status.OPEN).update(
        status=Conversation.Status.CLOSED, closed_at=timezone.now()
    )


def post_system_message(booking, code: str, params: dict | None = None) -> Message | None:
    conversation = Conversation.objects.filter(booking=booking).first()
    if conversation is None:
        return None
    message = Message.objects.create(
        conversation=conversation,
        kind=Message.Kind.SYSTEM,
        system_code=code,
        metadata=params or {},
    )
    broadcast(conversation.id, {"type": "message.new", "message": serialize_message(message)})
    return message


def send_message(user, conversation: Conversation, content: str) -> Message:
    from apps.notifications.services import notify
    from apps.profiles.selectors import is_blocked_between

    content = (content or "").strip()
    if not content:
        raise DomainError("Message is empty.", code="empty_message")
    if len(content) > 4000:
        raise DomainError("Message is too long.", code="message_too_long")
    if conversation.status != Conversation.Status.OPEN:
        raise DomainError("This conversation is closed.", code="conversation_closed", status_code=409)
    booking = conversation.booking
    other = booking.other_party(user)
    if is_blocked_between(user, other):
        raise DomainError("You can't message this person.", code="blocked", status_code=403)

    result = contact_filter.scan(content)
    moderation = {
        contact_filter.BLOCK: Message.Moderation.BLOCKED,
        contact_filter.WARN: Message.Moderation.WARNED,
    }.get(result.action, Message.Moderation.CLEAN)

    message = Message.objects.create(
        conversation=conversation,
        sender=user,
        content=content,
        moderation_status=moderation,
        moderation_reasons=result.reasons,
    )
    if moderation == Message.Moderation.BLOCKED:
        record(user, message, "MESSAGE_BLOCKED", reasons=result.reasons, conversation_id=conversation.id)
        return message

    if moderation == Message.Moderation.WARNED:
        record(user, message, "MESSAGE_WARNED", reasons=result.reasons, conversation_id=conversation.id)
    ConversationMember.objects.filter(conversation=conversation, user=user).update(last_read_at=timezone.now())
    broadcast(conversation.id, {"type": "message.new", "message": serialize_message(message)})

    # One unread notification per conversation is enough; avoid spamming.
    if not other.notifications.filter(
        kind="message_received", read_at__isnull=True, data__conversation_id=conversation.id
    ).exists():
        notify(other, "message_received", {"conversation_id": conversation.id, "booking_id": booking.id}, actor=user)
    return message


def mark_read(user, conversation: Conversation) -> None:
    ConversationMember.objects.filter(conversation=conversation, user=user).update(last_read_at=timezone.now())
    user.notifications.filter(
        kind="message_received", read_at__isnull=True, data__conversation_id=conversation.id
    ).update(read_at=timezone.now())
    broadcast(conversation.id, {"type": "read.receipt", "user_id": user.id, "at": timezone.now().isoformat()})


def unread_count(user, conversation: Conversation) -> int:
    member = conversation.members.filter(user=user).first()
    qs = visible_messages(conversation, user).exclude(sender=user)
    if member and member.last_read_at:
        qs = qs.filter(created_at__gt=member.last_read_at)
    return qs.count()
