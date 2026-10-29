from django.conf import settings
from django.db import models

from apps.common.images import UploadTo, private_storage
from apps.common.models import TimeStampedModel


class Report(TimeStampedModel):
    """A private incident report. Never published; the reported user can't see or delete it."""

    class Category(models.TextChoices):
        OVERCHARGING = "OVERCHARGING"  # chặt chém
        ITINERARY_DEVIATION = "ITINERARY_DEVIATION"  # taken somewhere not agreed
        INAPPROPRIATE_BEHAVIOUR = "INAPPROPRIATE_BEHAVIOUR"
        SAFETY = "SAFETY"
        OFF_PLATFORM_CONTACT = "OFF_PLATFORM_CONTACT"
        NO_SHOW = "NO_SHOW"
        FAKE_PROFILE = "FAKE_PROFILE"
        FAKE_REVIEW = "FAKE_REVIEW"
        SUSPICIOUS_REQUEST = "SUSPICIOUS_REQUEST"
        OTHER = "OTHER"

    class Status(models.TextChoices):
        OPEN = "OPEN"
        IN_REVIEW = "IN_REVIEW"
        RESOLVED = "RESOLVED"
        DISMISSED = "DISMISSED"

    class Severity(models.TextChoices):
        LOW = "LOW"
        MEDIUM = "MEDIUM"
        HIGH = "HIGH"
        CRITICAL = "CRITICAL"

    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reports_filed")
    reported_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="reports_received"
    )
    booking = models.ForeignKey("bookings.Booking", null=True, blank=True, on_delete=models.PROTECT, related_name="reports")
    message = models.ForeignKey("messaging.Message", null=True, blank=True, on_delete=models.PROTECT, related_name="reports")
    review = models.ForeignKey("reviews.Review", null=True, blank=True, on_delete=models.PROTECT, related_name="reports")
    tour_request = models.ForeignKey(
        "bookings.TourRequest", null=True, blank=True, on_delete=models.PROTECT, related_name="reports"
    )
    category = models.CharField(max_length=24, choices=Category.choices)
    description = models.TextField(max_length=5000)
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.MEDIUM)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN, db_index=True)
    opened_dispute = models.BooleanField(default=False)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_reports",
        limit_choices_to={"is_staff": True},
    )
    resolution_note = models.TextField(blank=True, max_length=5000)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Report #{self.pk} {self.category} {self.status}"


class ReportEvidence(models.Model):
    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="evidence")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    file = models.FileField(upload_to=UploadTo("evidence"), storage=private_storage)
    description = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Block(models.Model):
    blocker = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="blocks_made")
    blocked = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="blocks_received")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["blocker", "blocked"], name="uniq_block"),
            models.CheckConstraint(condition=~models.Q(blocker=models.F("blocked")), name="block_not_self"),
        ]
