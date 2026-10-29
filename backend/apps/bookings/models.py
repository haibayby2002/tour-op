import secrets

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.common.models import TimeStampedModel


class TourRequest(TimeStampedModel):
    """A traveler asks a specific local for an experience.

    Accepting a request opens a discussion (booking in DISCUSSING + conversation);
    it is *not* a commitment to guide. Confirmation happens through an Agreement.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING"
        NEEDS_INFO = "NEEDS_INFO"
        ACCEPTED = "ACCEPTED"
        DECLINED = "DECLINED"
        CANCELLED = "CANCELLED"
        EXPIRED = "EXPIRED"

    OPEN_STATUSES = (Status.PENDING, Status.NEEDS_INFO)

    traveler = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="sent_requests")
    local = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="received_requests")
    service = models.ForeignKey(
        "experiences.LocalService", null=True, blank=True, on_delete=models.SET_NULL, related_name="requests"
    )
    wish = models.ForeignKey(
        "wishes.TripWish", null=True, blank=True, on_delete=models.SET_NULL, related_name="requests",
        help_text="Set when the booking came from a local answering a trip wish",
    )
    city = models.ForeignKey("profiles.City", on_delete=models.PROTECT, related_name="+")
    area = models.CharField(max_length=200, blank=True, help_text="Area the traveler wants to explore")
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    group_size = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    budget_min = models.PositiveIntegerField(null=True, blank=True)
    budget_max = models.PositiveIntegerField(null=True, blank=True)
    currency = models.CharField(max_length=3, default="VND")
    interests = models.ManyToManyField("profiles.Interest", blank=True, related_name="+")
    language = models.ForeignKey("profiles.Language", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    wishes = models.TextField(blank=True, max_length=2000)
    avoid_notes = models.TextField(blank=True, max_length=1000, help_text="e.g. no shopping stops, no bars")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    local_note = models.TextField(blank=True, max_length=1000, help_text="Local's question or decline reason")
    responded_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(condition=models.Q(end_at__gt=models.F("start_at")), name="request_end_after_start"),
            models.CheckConstraint(condition=~models.Q(traveler=models.F("local")), name="request_not_self"),
        ]

    def __str__(self):
        return f"Request #{self.pk} {self.traveler_id}->{self.local_id} {self.status}"


class Booking(TimeStampedModel):
    """The transactional centre: a controlled relationship between two people."""

    class Status(models.TextChoices):
        DISCUSSING = "DISCUSSING"
        CONFIRMED = "CONFIRMED"
        IN_PROGRESS = "IN_PROGRESS"
        COMPLETED = "COMPLETED"
        CANCELLED = "CANCELLED"
        DISPUTED = "DISPUTED"

    tour_request = models.OneToOneField(TourRequest, on_delete=models.PROTECT, related_name="booking")
    traveler = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="bookings_as_traveler")
    local = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="bookings_as_local")
    service = models.ForeignKey(
        "experiences.LocalService", null=True, blank=True, on_delete=models.SET_NULL, related_name="bookings"
    )
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DISCUSSING, db_index=True)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    group_size = models.PositiveSmallIntegerField()
    current_agreement = models.ForeignKey(
        "Agreement", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    agreed_price = models.PositiveIntegerField(null=True, blank=True)
    currency = models.CharField(max_length=3, default="VND")
    confirmed_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    cancel_reason = models.TextField(blank=True, max_length=1000)
    status_before_dispute = models.CharField(max_length=12, blank=True)

    class Meta:
        ordering = ["-start_at"]

    def __str__(self):
        return f"Booking #{self.pk} {self.status}"

    def is_participant(self, user) -> bool:
        return user.id in (self.traveler_id, self.local_id)

    def other_party(self, user):
        return self.local if user.id == self.traveler_id else self.traveler

    def role_of(self, user) -> str | None:
        if user.id == self.traveler_id:
            return "TRAVELER"
        if user.id == self.local_id:
            return "LOCAL"
        return None


class Agreement(models.Model):
    """A versioned, immutable proposal of itinerary + price.

    The local proposes; the traveler accepts or requests changes. An accepted
    version is never edited; any later change is a new version that the
    traveler must accept again.
    """

    class Status(models.TextChoices):
        PROPOSED = "PROPOSED"
        ACCEPTED = "ACCEPTED"
        CHANGES_REQUESTED = "CHANGES_REQUESTED"
        WITHDRAWN = "WITHDRAWN"
        SUPERSEDED = "SUPERSEDED"

    class PriceUnit(models.TextChoices):
        PER_GROUP = "PER_GROUP"
        PER_PERSON = "PER_PERSON"

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="agreements")
    version = models.PositiveIntegerField()
    proposed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PROPOSED)

    meeting_point = models.CharField(max_length=200)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    group_size = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    scope = models.TextField(max_length=2000, help_text="What the local will and won't do")

    price = models.PositiveIntegerField()
    currency = models.CharField(max_length=3, default="VND")
    price_unit = models.CharField(max_length=12, choices=PriceUnit.choices, default=PriceUnit.PER_GROUP)
    included = models.TextField(blank=True, max_length=1000)
    excluded = models.TextField(blank=True, max_length=1000)
    # Separate notes for common surprise costs (PRD B1)
    cost_tickets = models.CharField(max_length=300, blank=True)
    cost_transport = models.CharField(max_length=300, blank=True)
    cost_food = models.CharField(max_length=300, blank=True)
    cost_overtime = models.CharField(max_length=300, blank=True)
    cost_other = models.CharField(max_length=300, blank=True)
    cancellation_policy = models.TextField(max_length=1000)
    notes = models.TextField(blank=True, max_length=1000)

    response_note = models.TextField(blank=True, max_length=1000)
    responded_at = models.DateTimeField(null=True, blank=True)
    local_accepted_at = models.DateTimeField(null=True, blank=True)
    traveler_accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-version"]
        constraints = [models.UniqueConstraint(fields=["booking", "version"], name="uniq_agreement_version")]

    def __str__(self):
        return f"Agreement b{self.booking_id} v{self.version} {self.status}"

    @property
    def total_price(self) -> int:
        if self.price_unit == self.PriceUnit.PER_PERSON:
            return self.price * self.group_size
        return self.price


class ItineraryStop(models.Model):
    class Kind(models.TextChoices):
        SIGHTSEEING = "SIGHTSEEING"
        FOOD = "FOOD"
        SHOPPING = "SHOPPING"
        PARTNER = "PARTNER"  # partner / personal recommendation (possible commission)
        TRANSPORT = "TRANSPORT"
        ACTIVITY = "ACTIVITY"
        OTHER = "OTHER"

    # Stops the traveler may decline before accepting (PRD B3).
    DECLINABLE_KINDS = (Kind.SHOPPING, Kind.FOOD, Kind.PARTNER)

    agreement = models.ForeignKey(Agreement, on_delete=models.CASCADE, related_name="stops")
    order = models.PositiveSmallIntegerField()
    time = models.CharField(max_length=20, blank=True, help_text="e.g. 09:30")
    place_name = models.CharField(max_length=200)
    # Set when place_name matches a recommended place in the booking's city; free text otherwise.
    place = models.ForeignKey("profiles.Place", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    activity = models.CharField(max_length=300, blank=True)
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.SIGHTSEEING)
    estimated_cost = models.CharField(max_length=120, blank=True)
    declined_by_traveler = models.BooleanField(default=False)

    class Meta:
        ordering = ["order", "id"]

    @property
    def is_commercial(self) -> bool:
        return self.kind in (self.Kind.SHOPPING, self.Kind.PARTNER)


class TripShare(models.Model):
    """A read-only link the traveler can send to family/friends (PRD D3)."""

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="shares")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    token = models.CharField(max_length=64, unique=True, default=secrets.token_urlsafe)
    include_itinerary = models.BooleanField(default=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
