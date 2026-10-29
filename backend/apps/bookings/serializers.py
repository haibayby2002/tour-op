from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.experiences.models import LocalService
from apps.profiles.models import City, Interest, Language, Place
from apps.profiles.selectors import public_card
from apps.profiles.serializers import InterestSerializer

from .models import Agreement, Booking, ItineraryStop, TourRequest, TripShare

User = get_user_model()


class TourRequestInputSerializer(serializers.ModelSerializer):
    local = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True))
    service = serializers.PrimaryKeyRelatedField(
        queryset=LocalService.objects.all(), required=False, allow_null=True
    )
    city = serializers.SlugRelatedField(slug_field="slug", queryset=City.objects.filter(is_active=True))
    interests = serializers.SlugRelatedField(
        slug_field="slug", queryset=Interest.objects.all(), many=True, required=False
    )
    language = serializers.SlugRelatedField(
        slug_field="code", queryset=Language.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = TourRequest
        fields = [
            "local", "service", "city", "area", "start_at", "end_at", "group_size", "budget_min",
            "budget_max", "currency", "interests", "language", "wishes", "avoid_notes",
        ]


class TourRequestUpdateSerializer(TourRequestInputSerializer):
    class Meta(TourRequestInputSerializer.Meta):
        fields = [f for f in TourRequestInputSerializer.Meta.fields if f != "local"]


class ServiceBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocalService
        fields = ["id", "title", "price", "currency", "price_unit", "duration_minutes"]


class TourRequestSerializer(serializers.ModelSerializer):
    traveler = serializers.SerializerMethodField()
    local = serializers.SerializerMethodField()
    service = ServiceBriefSerializer(read_only=True)
    city = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    city_name = serializers.CharField(source="city.name", read_only=True)
    interests = InterestSerializer(many=True, read_only=True)
    language = serializers.SlugRelatedField(slug_field="code", read_only=True)
    booking_id = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()

    class Meta:
        model = TourRequest
        fields = [
            "id", "traveler", "local", "service", "city", "city_name", "area", "start_at", "end_at",
            "group_size", "budget_min", "budget_max", "currency", "interests", "language", "wishes",
            "avoid_notes", "status", "local_note", "responded_at", "expires_at", "created_at",
            "booking_id", "my_role",
        ]

    def get_traveler(self, obj):
        return public_card(obj.traveler, self.context.get("request"))

    def get_local(self, obj):
        return public_card(obj.local, self.context.get("request"))

    def get_booking_id(self, obj):
        booking = getattr(obj, "booking", None)
        return booking.id if booking else None

    def get_my_role(self, obj):
        user = self.context["request"].user
        return "TRAVELER" if user.id == obj.traveler_id else "LOCAL"


class StopInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItineraryStop
        fields = ["time", "place_name", "activity", "kind", "estimated_cost"]


class AgreementInputSerializer(serializers.ModelSerializer):
    stops = StopInputSerializer(many=True)

    class Meta:
        model = Agreement
        fields = [
            "meeting_point", "start_at", "end_at", "group_size", "scope", "price", "currency", "price_unit",
            "included", "excluded", "cost_tickets", "cost_transport", "cost_food", "cost_overtime",
            "cost_other", "cancellation_policy", "notes", "stops",
        ]


class StopPlaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Place
        fields = ["slug", "name", "name_vi", "latitude", "longitude", "address"]


class StopSerializer(serializers.ModelSerializer):
    place = StopPlaceSerializer(read_only=True)
    is_commercial = serializers.BooleanField(read_only=True)
    declinable = serializers.SerializerMethodField()

    class Meta:
        model = ItineraryStop
        fields = [
            "id", "order", "time", "place_name", "place", "activity", "kind", "estimated_cost",
            "declined_by_traveler", "is_commercial", "declinable",
        ]

    def get_declinable(self, obj):
        return obj.kind in ItineraryStop.DECLINABLE_KINDS


class AgreementSerializer(serializers.ModelSerializer):
    stops = StopSerializer(many=True, read_only=True)
    total_price = serializers.IntegerField(read_only=True)

    class Meta:
        model = Agreement
        fields = [
            "id", "booking", "version", "proposed_by", "status", "meeting_point", "start_at", "end_at",
            "group_size", "scope", "price", "currency", "price_unit", "total_price", "included", "excluded",
            "cost_tickets", "cost_transport", "cost_food", "cost_overtime", "cost_other",
            "cancellation_policy", "notes", "response_note", "responded_at", "local_accepted_at",
            "traveler_accepted_at", "created_at", "stops",
        ]


class AcceptAgreementSerializer(serializers.Serializer):
    declined_stop_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    acknowledge_costs = serializers.BooleanField()


class NoteSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=1000, allow_blank=True, required=False, default="")


class CancelSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=1000)


class TripShareSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    active = serializers.SerializerMethodField()

    class Meta:
        model = TripShare
        fields = ["id", "token", "url", "include_itinerary", "expires_at", "revoked_at", "created_at", "active"]

    def get_url(self, obj):
        from .services import share_url

        return share_url(obj)

    def get_active(self, obj):
        from django.utils import timezone

        return obj.revoked_at is None and obj.expires_at > timezone.now()


class BookingSerializer(serializers.ModelSerializer):
    traveler = serializers.SerializerMethodField()
    local = serializers.SerializerMethodField()
    service = ServiceBriefSerializer(read_only=True)
    current_agreement = AgreementSerializer(read_only=True)
    pending_agreement = serializers.SerializerMethodField()
    agreement_history = serializers.SerializerMethodField()
    conversation_id = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()
    request = TourRequestSerializer(source="tour_request", read_only=True)
    review_state = serializers.SerializerMethodField()
    late_cancellation = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id", "status", "traveler", "local", "service", "start_at", "end_at", "group_size",
            "agreed_price", "currency", "current_agreement", "pending_agreement", "agreement_history",
            "conversation_id", "my_role", "request", "confirmed_at", "started_at", "completed_at",
            "cancelled_at", "cancelled_by", "cancel_reason", "review_state", "late_cancellation",
            "created_at",
        ]

    def get_traveler(self, obj):
        return public_card(obj.traveler, self.context.get("request"))

    def get_local(self, obj):
        return public_card(obj.local, self.context.get("request"))

    def get_pending_agreement(self, obj):
        latest = obj.agreements.order_by("-version").first()
        if latest and latest.status in (Agreement.Status.PROPOSED, Agreement.Status.CHANGES_REQUESTED):
            return AgreementSerializer(latest).data
        return None

    def get_agreement_history(self, obj):
        return [
            {"id": a.id, "version": a.version, "status": a.status, "total_price": a.total_price,
             "currency": a.currency, "created_at": a.created_at, "response_note": a.response_note}
            for a in obj.agreements.order_by("-version")
        ]

    def get_conversation_id(self, obj):
        conversation = getattr(obj, "conversation", None)
        return conversation.id if conversation else None

    def get_my_role(self, obj):
        return obj.role_of(self.context["request"].user)

    def get_review_state(self, obj):
        from apps.reviews.services import review_state

        return review_state(obj, self.context["request"].user)

    def get_late_cancellation(self, obj):
        from datetime import timedelta

        return bool(
            obj.status == Booking.Status.CANCELLED
            and obj.cancelled_at
            and obj.confirmed_at
            and obj.start_at - obj.cancelled_at < timedelta(hours=24)
        )


class BookingListSerializer(serializers.ModelSerializer):
    traveler = serializers.SerializerMethodField()
    local = serializers.SerializerMethodField()
    service_title = serializers.CharField(source="service.title", read_only=True, default=None)
    city_name = serializers.CharField(source="tour_request.city.name", read_only=True)
    my_role = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id", "status", "traveler", "local", "service_title", "city_name", "start_at", "end_at",
            "group_size", "agreed_price", "currency", "my_role",
        ]

    def get_traveler(self, obj):
        return public_card(obj.traveler, self.context.get("request"))

    def get_local(self, obj):
        return public_card(obj.local, self.context.get("request"))

    def get_my_role(self, obj):
        return obj.role_of(self.context["request"].user)
