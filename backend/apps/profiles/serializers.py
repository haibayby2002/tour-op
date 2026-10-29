from django.db import transaction
from rest_framework import serializers

from apps.accounts.models import UserRole
from apps.common.fields import ContactSafeCharField
from apps.common.images import PhotoField, ProcessedPhotoMixin, file_url, process_single

from .models import (
    City,
    ExternalReviewSource,
    Interest,
    Language,
    LocalAvailability,
    LocalProfile,
    Place,
    Profile,
    ProfilePhoto,
    TravelerProfile,
    UserInterest,
    UserLanguage,
)
from .services import completion_report


# --- reference data --------------------------------------------------------
class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ["slug", "name", "name_vi", "country", "latitude", "longitude"]


class LanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = ["code", "name", "name_vi"]


class InterestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interest
        fields = ["slug", "name", "name_vi", "category"]


class PlaceSerializer(serializers.ModelSerializer):
    city = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    category = serializers.SlugRelatedField(slug_field="slug", read_only=True)

    class Meta:
        model = Place
        fields = ["slug", "city", "name", "name_vi", "category", "latitude", "longitude", "address", "description"]


# --- nested pieces ---------------------------------------------------------
class UserLanguageSerializer(serializers.ModelSerializer):
    code = serializers.SlugRelatedField(source="language", slug_field="code", queryset=Language.objects.all())
    name = serializers.CharField(source="language.name", read_only=True)
    name_vi = serializers.CharField(source="language.name_vi", read_only=True)

    class Meta:
        model = UserLanguage
        fields = ["code", "name", "name_vi", "proficiency"]


class ProfilePhotoSerializer(ProcessedPhotoMixin, serializers.ModelSerializer):
    image = PhotoField()
    caption = ContactSafeCharField(max_length=200, required=False, allow_blank=True)

    class Meta:
        model = ProfilePhoto
        fields = ["id", "image", "thumbnail", "caption", "sort_order", "status", "created_at"]
        read_only_fields = ["thumbnail", "status", "created_at"]


class LocalProfileSerializer(serializers.ModelSerializer):
    experience_summary = ContactSafeCharField(max_length=2000, required=False, allow_blank=True)
    areas_description = ContactSafeCharField(max_length=300, required=False, allow_blank=True)
    support_skills = ContactSafeCharField(max_length=1000, required=False, allow_blank=True)
    pricing_note = ContactSafeCharField(max_length=300, required=False, allow_blank=True)

    class Meta:
        model = LocalProfile
        fields = [
            "experience_summary", "years_experience", "areas_description", "support_skills",
            "price_min", "price_max", "currency", "pricing_note", "is_accepting_requests",
            "review_status", "reviewed_at",
        ]
        read_only_fields = ["review_status", "reviewed_at"]

    def validate(self, attrs):
        price_min = attrs.get("price_min", getattr(self.instance, "price_min", None))
        price_max = attrs.get("price_max", getattr(self.instance, "price_max", None))
        if price_min is not None and price_max is not None and price_max < price_min:
            raise serializers.ValidationError({"price_max": "Must be greater than or equal to the minimum price."})
        return attrs


class TravelerProfileSerializer(serializers.ModelSerializer):
    wishes = ContactSafeCharField(max_length=1000, required=False, allow_blank=True)
    avoid_notes = ContactSafeCharField(max_length=1000, required=False, allow_blank=True)

    class Meta:
        model = TravelerProfile
        fields = ["travel_style", "wishes", "avoid_notes", "visibility"]


class ExternalReviewSourceSerializer(serializers.ModelSerializer):
    screenshot = PhotoField(required=False, allow_null=True)
    note = ContactSafeCharField(max_length=300, required=False, allow_blank=True)

    class Meta:
        model = ExternalReviewSource
        fields = ["id", "platform", "url", "screenshot", "rating_text", "note", "status", "created_at"]
        read_only_fields = ["status", "created_at"]

    def validate(self, attrs):
        url = attrs.get("url", getattr(self.instance, "url", ""))
        screenshot = attrs.get("screenshot", getattr(self.instance, "screenshot", None))
        if not url and not screenshot:
            raise serializers.ValidationError("Provide a link or a screenshot.")
        if attrs.get("screenshot"):
            attrs["screenshot"] = process_single(attrs["screenshot"])
        return attrs


class AvailabilitySerializer(serializers.ModelSerializer):
    note = ContactSafeCharField(max_length=200, required=False, allow_blank=True)

    class Meta:
        model = LocalAvailability
        fields = ["id", "start_at", "end_at", "note"]

    def validate(self, attrs):
        start = attrs.get("start_at", getattr(self.instance, "start_at", None))
        end = attrs.get("end_at", getattr(self.instance, "end_at", None))
        if start and end and end <= start:
            raise serializers.ValidationError({"end_at": "End must be after start."})
        return attrs


# --- my profile ------------------------------------------------------------
class LanguageInputSerializer(serializers.Serializer):
    code = serializers.SlugRelatedField(slug_field="code", queryset=Language.objects.all())
    proficiency = serializers.ChoiceField(
        choices=UserLanguage.Proficiency.choices, default=UserLanguage.Proficiency.CONVERSATIONAL
    )


class MyProfileSerializer(serializers.Serializer):
    """Composite read/write view of the owner's profile across both roles."""

    display_name = ContactSafeCharField(max_length=60, required=False, allow_blank=True)
    bio = ContactSafeCharField(max_length=2000, required=False, allow_blank=True)
    city = serializers.SlugRelatedField(
        slug_field="slug", queryset=City.objects.filter(is_active=True), required=False, allow_null=True
    )
    location_name = ContactSafeCharField(max_length=120, required=False, allow_blank=True)
    visibility = serializers.ChoiceField(choices=Profile.Visibility.choices, required=False)
    languages = LanguageInputSerializer(many=True, required=False)
    interests = serializers.SlugRelatedField(
        slug_field="slug", queryset=Interest.objects.all(), many=True, required=False
    )
    local = LocalProfileSerializer(required=False)
    traveler = TravelerProfileSerializer(required=False)

    PROFILE_FIELDS = ("display_name", "bio", "city", "location_name", "visibility")

    def to_representation(self, profile: Profile):
        user = profile.user
        request = self.context.get("request")
        data = {
            "user_id": user.id,
            "full_name": user.full_name,
            "age_by_birth_year": user.age_by_birth_year,
            "roles": user.role_list,
            "display_name": profile.display_name,
            "public_name": profile.public_name,
            "bio": profile.bio,
            "avatar": file_url(profile.avatar, request),
            "city": CitySerializer(profile.city).data if profile.city else None,
            "location_name": profile.location_name,
            "visibility": profile.visibility,
            "languages": UserLanguageSerializer(user.languages.select_related("language"), many=True).data,
            "interests": InterestSerializer(
                Interest.objects.filter(userinterest__user=user), many=True
            ).data,
            "photos": ProfilePhotoSerializer(user.photos.all(), many=True, context=self.context).data,
            "completion": completion_report(user),
            "local": None,
            "traveler": None,
        }
        if hasattr(user, "local_profile") and user.has_role(UserRole.Role.LOCAL):
            data["local"] = LocalProfileSerializer(user.local_profile).data
        if hasattr(user, "traveler_profile") and user.has_role(UserRole.Role.TRAVELER):
            data["traveler"] = TravelerProfileSerializer(user.traveler_profile).data
        return data

    @transaction.atomic
    def update(self, profile: Profile, validated):
        user = profile.user
        for field in self.PROFILE_FIELDS:
            if field in validated:
                setattr(profile, field, validated[field])
        profile.save()

        if "languages" in validated:
            user.languages.all().delete()
            UserLanguage.objects.bulk_create(
                [UserLanguage(user=user, language=item["code"], proficiency=item["proficiency"])
                 for item in validated["languages"]]
            )
        if "interests" in validated:
            user.interests.all().delete()
            UserInterest.objects.bulk_create(
                [UserInterest(user=user, interest=i) for i in set(validated["interests"])]
            )
        if "local" in validated:
            if not user.has_role(UserRole.Role.LOCAL):
                raise serializers.ValidationError({"local": "Add the Local role first."})
            local, _ = LocalProfile.objects.get_or_create(user=user)
            LocalProfileSerializer().update(local, validated["local"])
        if "traveler" in validated:
            if not user.has_role(UserRole.Role.TRAVELER):
                raise serializers.ValidationError({"traveler": "Add the Traveler role first."})
            traveler, _ = TravelerProfile.objects.get_or_create(user=user)
            TravelerProfileSerializer().update(traveler, validated["traveler"])

        # bulk operations above skip signals, so refresh explicitly
        from .services import refresh_completion

        refresh_completion(user)
        profile.refresh_from_db()
        return profile
