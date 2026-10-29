from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.common.models import TimeStampedModel


class TripWish(TimeStampedModel):
    """A traveler describes the trip they want without picking a local.

    Qualified locals in that city are matched and notified; they answer with an
    offer, and the traveler chooses one, which opens a normal booking discussion.
    """

    class Status(models.TextChoices):
        OPEN = "OPEN"
        MATCHED = "MATCHED"  # traveler chose a local
        CLOSED = "CLOSED"  # traveler closed it
        EXPIRED = "EXPIRED"  # start time passed

    traveler = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="trip_wishes")
    title = models.CharField(max_length=120)
    description = models.TextField(max_length=2000)
    city = models.ForeignKey("profiles.City", on_delete=models.PROTECT, related_name="+")
    area = models.CharField(max_length=200, blank=True)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    group_size = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    budget_min = models.PositiveIntegerField(null=True, blank=True)
    budget_max = models.PositiveIntegerField(null=True, blank=True)
    currency = models.CharField(max_length=3, default="VND")
    interests = models.ManyToManyField("profiles.Interest", blank=True, related_name="+")
    avoid_notes = models.TextField(blank=True, max_length=1000)

    # Optional qualifications a local must meet to be matched.
    language = models.ForeignKey("profiles.Language", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    category = models.ForeignKey(
        "experiences.ServiceCategory", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    require_manually_checked = models.BooleanField(default=False)
    min_rating = models.DecimalField(
        max_digits=2, decimal_places=1, null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)]
    )

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN, db_index=True)
    matched_local = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(condition=models.Q(end_at__gt=models.F("start_at")), name="wish_end_after_start"),
        ]

    def __str__(self):
        return f"Wish #{self.pk} {self.title} ({self.status})"


class WishCandidate(models.Model):
    """A local matched to a wish (the ERD's match_candidates). Score is a derived
    recommendation result, not a permanent judgement about the person."""

    wish = models.ForeignKey(TripWish, on_delete=models.CASCADE, related_name="candidates")
    local = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wish_matches")
    score = models.IntegerField(default=0)
    reasons = models.JSONField(default=list, blank=True)
    notified_at = models.DateTimeField(null=True, blank=True)
    dismissed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-score"]
        constraints = [models.UniqueConstraint(fields=["wish", "local"], name="uniq_wish_candidate")]


class WishOffer(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING"
        ACCEPTED = "ACCEPTED"
        DECLINED = "DECLINED"
        WITHDRAWN = "WITHDRAWN"

    wish = models.ForeignKey(TripWish, on_delete=models.CASCADE, related_name="offers")
    local = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wish_offers")
    message = models.TextField(max_length=1500)
    proposed_price = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    booking = models.ForeignKey("bookings.Booking", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at"]
        constraints = [models.UniqueConstraint(fields=["wish", "local"], name="uniq_wish_offer")]
