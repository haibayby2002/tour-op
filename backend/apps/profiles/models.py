from django.conf import settings
from django.core.validators import MaxValueValidator
from django.db import models

from apps.common.images import UploadTo
from apps.common.models import TimeStampedModel


# --- Reference data -------------------------------------------------------
class City(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=100)
    name_vi = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=2, default="VN")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "cities"

    def __str__(self):
        return self.name


class Language(models.Model):
    code = models.CharField(max_length=8, unique=True)
    name = models.CharField(max_length=60)
    name_vi = models.CharField(max_length=60, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Interest(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=60)
    name_vi = models.CharField(max_length=60, blank=True)
    category = models.CharField(max_length=40, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Place(models.Model):
    """A recommended place in a city, suggested to locals when they build an itinerary.

    Suggestions only: an itinerary stop can still name any place in free text.
    """

    slug = models.SlugField(unique=True, help_text="Stable ID used by import_reference. Never change it")
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name="places")
    name = models.CharField(max_length=200)
    name_vi = models.CharField(max_length=200, blank=True)
    category = models.ForeignKey(Interest, null=True, blank=True, on_delete=models.SET_NULL, related_name="places")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    address = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True, max_length=1000)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["city__name", "name"]

    def __str__(self):
        return f"{self.name} ({self.city.name})"


# --- Profiles ---------------------------------------------------------------
class Profile(TimeStampedModel):
    """Public-facing profile, shared by both roles. Contact details live on User only."""

    class Visibility(models.TextChoices):
        PUBLIC = "PUBLIC"
        MEMBERS = "MEMBERS"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, primary_key=True, on_delete=models.CASCADE, related_name="profile"
    )
    display_name = models.CharField(max_length=60, blank=True)
    bio = models.TextField(blank=True, max_length=2000)
    avatar = models.ImageField(upload_to=UploadTo("avatars"), blank=True)
    city = models.ForeignKey(City, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    location_name = models.CharField(max_length=120, blank=True, help_text="Area/district, never an exact address")
    visibility = models.CharField(max_length=10, choices=Visibility.choices, default=Visibility.PUBLIC)
    traveler_completion = models.PositiveSmallIntegerField(default=0)
    local_completion = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        return self.public_name

    @property
    def public_name(self) -> str:
        return self.display_name or self.user.full_name


class UserLanguage(models.Model):
    class Proficiency(models.TextChoices):
        BASIC = "BASIC"
        CONVERSATIONAL = "CONVERSATIONAL"
        FLUENT = "FLUENT"
        NATIVE = "NATIVE"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="languages")
    language = models.ForeignKey(Language, on_delete=models.CASCADE)
    proficiency = models.CharField(max_length=16, choices=Proficiency.choices, default=Proficiency.CONVERSATIONAL)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "language"], name="uniq_user_language")]


class UserInterest(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="interests")
    interest = models.ForeignKey(Interest, on_delete=models.CASCADE)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "interest"], name="uniq_user_interest")]


class ProfilePhoto(models.Model):
    class Status(models.TextChoices):
        VISIBLE = "VISIBLE"
        HIDDEN = "HIDDEN"  # hidden by moderation

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to=UploadTo("profile_photos"))
    thumbnail = models.ImageField(upload_to=UploadTo("profile_photos/thumbs"), blank=True, editable=False)
    caption = models.CharField(max_length=200, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.VISIBLE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]


class LocalProfile(TimeStampedModel):
    class ReviewStatus(models.TextChoices):
        NOT_SUBMITTED = "NOT_SUBMITTED"
        PENDING = "PENDING"
        MANUALLY_CHECKED = "MANUALLY_CHECKED"
        REJECTED = "REJECTED"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, primary_key=True, on_delete=models.CASCADE, related_name="local_profile"
    )
    experience_summary = models.TextField(blank=True, max_length=2000)
    years_experience = models.PositiveSmallIntegerField(default=0, validators=[MaxValueValidator(80)])
    areas_description = models.CharField(
        max_length=300, blank=True, help_text="Neighbourhoods/areas the local knows well"
    )
    support_skills = models.TextField(blank=True, max_length=1000, help_text="What the local can help with")
    price_min = models.PositiveIntegerField(null=True, blank=True)
    price_max = models.PositiveIntegerField(null=True, blank=True)
    currency = models.CharField(max_length=3, default="VND")
    pricing_note = models.CharField(max_length=300, blank=True)
    is_accepting_requests = models.BooleanField(default=True)
    review_status = models.CharField(
        max_length=20, choices=ReviewStatus.choices, default=ReviewStatus.NOT_SUBMITTED
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Local {self.user_id}"

    @property
    def has_pricing(self) -> bool:
        return self.price_min is not None


class TravelerProfile(TimeStampedModel):
    class TravelStyle(models.TextChoices):
        RELAXED = "RELAXED"
        ADVENTUROUS = "ADVENTUROUS"
        CULTURAL = "CULTURAL"
        FOODIE = "FOODIE"
        BUDGET = "BUDGET"
        COMFORT = "COMFORT"

    class Visibility(models.TextChoices):
        PUBLIC = "PUBLIC"
        REQUEST_ONLY = "REQUEST_ONLY"  # only locals who received a request see it

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, primary_key=True, on_delete=models.CASCADE, related_name="traveler_profile"
    )
    travel_style = models.CharField(max_length=16, choices=TravelStyle.choices, blank=True)
    wishes = models.TextField(blank=True, max_length=1000, help_text="Experiences the traveler hopes for")
    avoid_notes = models.TextField(blank=True, max_length=1000, help_text="Things the traveler wants to avoid")
    visibility = models.CharField(max_length=14, choices=Visibility.choices, default=Visibility.REQUEST_ONLY)

    def __str__(self):
        return f"Traveler {self.user_id}"


class ExternalReviewSource(models.Model):
    """A link/screenshot of reviews on another platform. Shown as UNVERIFIED unless staff check it."""

    class Platform(models.TextChoices):
        GOOGLE = "GOOGLE"
        TRIPADVISOR = "TRIPADVISOR"
        AIRBNB = "AIRBNB"
        FACEBOOK = "FACEBOOK"
        KLOOK = "KLOOK"
        OTHER = "OTHER"

    class Status(models.TextChoices):
        UNVERIFIED = "UNVERIFIED"
        VERIFIED = "VERIFIED"
        REJECTED = "REJECTED"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="external_reviews")
    platform = models.CharField(max_length=16, choices=Platform.choices)
    url = models.URLField(blank=True)
    screenshot = models.ImageField(upload_to=UploadTo("external_reviews"), blank=True)
    rating_text = models.CharField(max_length=60, blank=True, help_text="e.g. 4.8/5 from 120 reviews")
    note = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.UNVERIFIED)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class LocalAvailability(models.Model):
    local = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="availability")
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["start_at"]
        verbose_name_plural = "local availability"
        constraints = [
            models.CheckConstraint(condition=models.Q(end_at__gt=models.F("start_at")), name="availability_end_after_start")
        ]
