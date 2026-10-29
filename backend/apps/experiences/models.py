from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.common.images import UploadTo
from apps.common.models import TimeStampedModel


class ServiceCategory(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=60)
    name_vi = models.CharField(max_length=60, blank=True)
    description = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "service categories"

    def __str__(self):
        return self.name


class LocalService(TimeStampedModel):
    """A specific experience a local offers (e.g. 'Street food evening walk')."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE"
        PAUSED = "PAUSED"
        ARCHIVED = "ARCHIVED"

    class PriceUnit(models.TextChoices):
        PER_GROUP = "PER_GROUP"
        PER_PERSON = "PER_PERSON"
        PER_HOUR = "PER_HOUR"

    local = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="services")
    category = models.ForeignKey(ServiceCategory, on_delete=models.PROTECT, related_name="services")
    city = models.ForeignKey("profiles.City", on_delete=models.PROTECT, related_name="services")
    title = models.CharField(max_length=120)
    description = models.TextField(max_length=3000)
    location_name = models.CharField(max_length=120, blank=True, help_text="Area, not an exact address")
    duration_minutes = models.PositiveIntegerField(validators=[MinValueValidator(30), MaxValueValidator(24 * 60)])
    price = models.PositiveIntegerField()
    currency = models.CharField(max_length=3, default="VND")
    price_unit = models.CharField(max_length=12, choices=PriceUnit.choices, default=PriceUnit.PER_GROUP)
    max_group_size = models.PositiveSmallIntegerField(default=3, validators=[MinValueValidator(1)])
    included = models.TextField(blank=True, max_length=1000, help_text="What the price includes")
    excluded = models.TextField(blank=True, max_length=1000, help_text="What is NOT included (tickets, food...)")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class ServicePhoto(models.Model):
    service = models.ForeignKey(LocalService, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to=UploadTo("service_photos"))
    thumbnail = models.ImageField(upload_to=UploadTo("service_photos/thumbs"), blank=True, editable=False)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
