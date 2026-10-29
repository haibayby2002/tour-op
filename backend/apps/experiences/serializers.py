from django.conf import settings
from rest_framework import serializers

from apps.common.fields import ContactSafeCharField
from apps.common.images import PhotoField, ProcessedPhotoMixin
from apps.profiles.models import City

from .models import LocalService, ServiceCategory, ServicePhoto


class ServiceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategory
        fields = ["slug", "name", "name_vi", "description"]


class ServicePhotoSerializer(ProcessedPhotoMixin, serializers.ModelSerializer):
    image = PhotoField()

    class Meta:
        model = ServicePhoto
        fields = ["id", "image", "thumbnail", "sort_order"]
        read_only_fields = ["thumbnail"]


class LocalServiceSerializer(serializers.ModelSerializer):
    category = serializers.SlugRelatedField(slug_field="slug", queryset=ServiceCategory.objects.all())
    city = serializers.SlugRelatedField(slug_field="slug", queryset=City.objects.filter(is_active=True))
    category_detail = ServiceCategorySerializer(source="category", read_only=True)
    city_name = serializers.CharField(source="city.name", read_only=True)
    photos = ServicePhotoSerializer(many=True, read_only=True)
    local_id = serializers.IntegerField(read_only=True)
    title = ContactSafeCharField(max_length=120)
    description = ContactSafeCharField(max_length=3000)
    location_name = ContactSafeCharField(max_length=120, required=False, allow_blank=True)
    included = ContactSafeCharField(max_length=1000, required=False, allow_blank=True)
    excluded = ContactSafeCharField(max_length=1000, required=False, allow_blank=True)

    class Meta:
        model = LocalService
        fields = [
            "id", "local_id", "category", "category_detail", "city", "city_name", "title", "description",
            "location_name", "duration_minutes", "price", "currency", "price_unit", "max_group_size",
            "included", "excluded", "status", "photos", "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate_max_group_size(self, value):
        if value > settings.MAX_GROUP_SIZE:
            raise serializers.ValidationError(
                f"Tour-op focuses on small groups (up to {settings.MAX_GROUP_SIZE} people)."
            )
        return value
