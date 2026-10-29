from datetime import timedelta

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

# Reviews are double-blind: a review becomes public once the other party has
# also reviewed, or after this delay, so neither side can retaliate.
BLIND_PERIOD = timedelta(days=14)
REVIEW_WINDOW = timedelta(days=30)


class ReviewQuerySet(models.QuerySet):
    def publicly_visible(self):
        counterpart = Review.objects.filter(booking=OuterRef("booking"), reviewer=OuterRef("reviewee"))
        return (
            self.filter(is_hidden=False)
            .annotate(_has_counterpart=Exists(counterpart))
            .filter(Q(_has_counterpart=True) | Q(created_at__lte=timezone.now() - BLIND_PERIOD))
        )


class Review(models.Model):
    class Role(models.TextChoices):
        TRAVELER = "TRAVELER"
        LOCAL = "LOCAL"

    booking = models.ForeignKey("bookings.Booking", on_delete=models.PROTECT, related_name="reviews")
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reviews_written")
    reviewee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reviews_received")
    reviewee_role = models.CharField(max_length=10, choices=Role.choices)
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(max_length=2000, blank=True)
    # Trust-specific questions (traveler -> local); feed the PRD's trust metrics.
    felt_safe = models.BooleanField(null=True, blank=True)
    itinerary_respected = models.BooleanField(null=True, blank=True)
    price_as_agreed = models.BooleanField(null=True, blank=True)
    is_hidden = models.BooleanField(default=False, help_text="Hidden by staff after a valid report")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ReviewQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["booking", "reviewer"], name="uniq_review_per_booking_reviewer"),
            models.CheckConstraint(condition=~Q(reviewer=models.F("reviewee")), name="review_not_self"),
        ]

    def __str__(self):
        return f"Review #{self.pk} {self.rating}/5 for {self.reviewee_id}"
