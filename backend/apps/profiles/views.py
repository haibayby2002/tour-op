from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, parsers, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User, UserRole
from apps.audit.services import record
from apps.common.exceptions import DomainError
from apps.common.images import process_avatar

from .models import (
    City,
    ExternalReviewSource,
    Interest,
    Language,
    LocalAvailability,
    LocalProfile,
    Place,
    ProfilePhoto,
)
from .selectors import public_profile
from .serializers import (
    AvailabilitySerializer,
    CitySerializer,
    ExternalReviewSourceSerializer,
    InterestSerializer,
    LanguageSerializer,
    MyProfileSerializer,
    PlaceSerializer,
    ProfilePhotoSerializer,
)
from .services import ensure_profiles


class MetaView(APIView):
    """Reference data for clients: cities, languages, interests, categories, enums."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from apps.bookings.models import ItineraryStop
        from apps.experiences.models import ServiceCategory
        from apps.experiences.serializers import ServiceCategorySerializer
        from apps.safety.models import Report

        return Response(
            {
                "cities": CitySerializer(City.objects.filter(is_active=True), many=True).data,
                "languages": LanguageSerializer(Language.objects.all(), many=True).data,
                "interests": InterestSerializer(Interest.objects.all(), many=True).data,
                "service_categories": ServiceCategorySerializer(ServiceCategory.objects.all(), many=True).data,
                "report_categories": [c for c, _ in Report.Category.choices],
                "stop_kinds": [c for c, _ in ItineraryStop.Kind.choices],
                "max_group_size": settings.MAX_GROUP_SIZE,
                "image_upload": {
                    "max_mb": settings.IMAGE_MAX_UPLOAD_MB,
                    "types": ["image/jpeg", "image/png", "image/webp"],
                },
            }
        )


class PlaceListView(APIView):
    """Recommended places, for itinerary suggestions: /places/?city=<slug>&q=<text>."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        places = Place.objects.filter(is_active=True, city__is_active=True).select_related("city", "category")
        if city := request.query_params.get("city"):
            places = places.filter(city__slug=city)
        places = list(places[:500])
        # Matched in Python: database case-insensitive matching is unreliable for Vietnamese letters.
        if q := request.query_params.get("q", "").strip().casefold():
            places = [p for p in places if q in p.name.casefold() or q in p.name_vi.casefold()]
        return Response(PlaceSerializer(places[:200], many=True).data)


class MyProfileView(APIView):
    def get_profile(self, request):
        return ensure_profiles(request.user)

    def get(self, request):
        return Response(MyProfileSerializer(self.get_profile(request), context={"request": request}).data)

    def patch(self, request):
        profile = self.get_profile(request)
        serializer = MyProfileSerializer(profile, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        return Response(MyProfileSerializer(profile, context={"request": request}).data)


class AvatarView(APIView):
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request):
        profile = ensure_profiles(request.user)
        file = request.FILES.get("avatar")
        if not file:
            raise DomainError("Choose an image.", code="missing_file")
        profile.avatar = process_avatar(file)
        profile.save()
        return Response(MyProfileSerializer(profile, context={"request": request}).data)

    def delete(self, request):
        profile = ensure_profiles(request.user)
        profile.avatar = ""  # the old file is removed by apps.common.images.delete_files_with
        profile.save()
        return Response(MyProfileSerializer(profile, context={"request": request}).data)


class OwnedViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    owner_field = "user"
    pagination_class = None

    def get_queryset(self):
        return self.queryset.filter(**{self.owner_field: self.request.user})

    def perform_create(self, serializer):
        serializer.save(**{self.owner_field: self.request.user})


class PhotoViewSet(OwnedViewSet):
    queryset = ProfilePhoto.objects.all()
    serializer_class = ProfilePhotoSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def perform_create(self, serializer):
        if self.get_queryset().count() >= 12:
            raise DomainError("You can upload up to 12 photos.", code="too_many_photos")
        super().perform_create(serializer)


class ExternalReviewViewSet(OwnedViewSet):
    queryset = ExternalReviewSource.objects.all()
    serializer_class = ExternalReviewSourceSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def perform_update(self, serializer):
        # Any edit invalidates a previous staff verification.
        serializer.save(status=ExternalReviewSource.Status.UNVERIFIED)


class AvailabilityViewSet(OwnedViewSet):
    queryset = LocalAvailability.objects.all()
    serializer_class = AvailabilitySerializer
    owner_field = "local"

    def get_queryset(self):
        return super().get_queryset().filter(end_at__gte=timezone.now())

    def perform_create(self, serializer):
        if not self.request.user.has_role(UserRole.Role.LOCAL):
            raise DomainError("Only locals can publish availability.", code="not_local", status_code=403)
        super().perform_create(serializer)


class SubmitForReviewView(APIView):
    """Local asks staff to manually check the profile (shown as 'manually checked', never 'verified')."""

    def post(self, request):
        local = get_object_or_404(LocalProfile, user=request.user)
        if local.review_status == LocalProfile.ReviewStatus.PENDING:
            raise DomainError("Already waiting for review.", code="already_pending")
        local.review_status = LocalProfile.ReviewStatus.PENDING
        local.save(update_fields=["review_status"])
        record(request.user, local, "SUBMITTED_FOR_REVIEW", request=request)
        return Response({"review_status": local.review_status}, status=status.HTTP_202_ACCEPTED)


class PublicProfileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, user_id: int):
        user = get_object_or_404(User.objects.select_related("profile", "profile__city"), pk=user_id)
        role = request.query_params.get("role", UserRole.Role.LOCAL).upper()
        if role not in UserRole.Role.values:
            raise DomainError("Unknown role.", code="invalid_role")
        viewer = request.user if request.user.is_authenticated else None
        return Response(public_profile(user, viewer, role, request=request))
