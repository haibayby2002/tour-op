from django.conf import settings
from django.db import models


class Conversation(models.Model):
    """Every conversation belongs to a booking; there are no free-floating DMs."""

    class Status(models.TextChoices):
        OPEN = "OPEN"
        CLOSED = "CLOSED"  # read-only (e.g. booking cancelled)
        LOCKED = "LOCKED"  # locked by staff during an investigation

    booking = models.OneToOneField("bookings.Booking", on_delete=models.CASCADE, related_name="conversation")
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Conversation #{self.pk} (booking {self.booking_id})"


class ConversationMember(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversation_memberships")
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["conversation", "user"], name="uniq_conversation_member")]


class Message(models.Model):
    class Kind(models.TextChoices):
        TEXT = "TEXT"
        SYSTEM = "SYSTEM"

    class Moderation(models.TextChoices):
        CLEAN = "CLEAN"
        WARNED = "WARNED"  # delivered with a warning banner
        BLOCKED = "BLOCKED"  # kept for evidence, never delivered to the recipient

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.TEXT)
    content = models.TextField(max_length=4000, blank=True)
    system_code = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    moderation_status = models.CharField(max_length=8, choices=Moderation.choices, default=Moderation.CLEAN)
    moderation_reasons = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"Message #{self.pk} in {self.conversation_id}"
