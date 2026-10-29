from rest_framework import serializers

from apps.experiences.models import ServiceCategory
from apps.profiles.models import City, Interest, Language
from apps.profiles.selectors import public_card
from apps.profiles.serializers import InterestSerializer

from .models import TripWish, WishOffer


class WishInputSerializer(serializers.ModelSerializer):
    city = serializers.SlugRelatedField(slug_field="slug", queryset=City.objects.filter(is_active=True))
    interests = serializers.SlugRelatedField(slug_field="slug", queryset=Interest.objects.all(), many=True, required=False)
    language = serializers.SlugRelatedField(slug_field="code", queryset=Language.objects.all(), required=False, allow_null=True)
    category = serializers.SlugRelatedField(
        slug_field="slug", queryset=ServiceCategory.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = TripWish
        fields = [
            "title", "description", "city", "area", "start_at", "end_at", "group_size", "budget_min", "budget_max",
            "currency", "interests", "avoid_notes", "language", "category", "require_manually_checked", "min_rating",
        ]


class OfferInputSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=1500)
    proposed_price = serializers.IntegerField(min_value=0, required=False, allow_null=True)


def serialize_offer(offer: WishOffer, request, with_trust=False) -> dict:
    data = {
        "id": offer.id,
        "local": public_card(offer.local, request),
        "message": offer.message,
        "proposed_price": offer.proposed_price,
        "status": offer.status,
        "booking_id": offer.booking_id,
        "created_at": offer.created_at,
    }
    if with_trust:
        from apps.accounts.models import UserRole
        from apps.profiles.services import trust_signals

        data["trust"] = trust_signals(offer.local, UserRole.Role.LOCAL)
    return data


def serialize_wish(wish: TripWish, viewer, request, detail=False) -> dict:
    is_owner = viewer.id == wish.traveler_id
    data = {
        "id": wish.id,
        "title": wish.title,
        "description": wish.description,
        "city": wish.city.slug,
        "city_name": wish.city.name,
        "city_name_vi": wish.city.name_vi,
        "area": wish.area,
        "start_at": wish.start_at,
        "end_at": wish.end_at,
        "group_size": wish.group_size,
        "budget_min": wish.budget_min,
        "budget_max": wish.budget_max,
        "currency": wish.currency,
        "interests": InterestSerializer(wish.interests.all(), many=True).data,
        "avoid_notes": wish.avoid_notes,
        "language": wish.language.code if wish.language_id else None,
        "category": wish.category.slug if wish.category_id else None,
        "require_manually_checked": wish.require_manually_checked,
        "min_rating": float(wish.min_rating) if wish.min_rating is not None else None,
        "status": wish.status,
        "created_at": wish.created_at,
        "traveler": public_card(wish.traveler, request),
        "my_role": "TRAVELER" if is_owner else "LOCAL",
    }
    if is_owner:
        data["candidate_count"] = wish.candidates.count()
        offers = wish.offers.exclude(status=WishOffer.Status.WITHDRAWN).select_related("local__profile")
        data["offer_count"] = offers.count()
        if detail:
            data["offers"] = [serialize_offer(o, request, with_trust=True) for o in offers]
            booking = wish.offers.filter(status=WishOffer.Status.ACCEPTED).values_list("booking_id", flat=True).first()
            data["booking_id"] = booking
    else:
        candidate = wish.candidates.filter(local=viewer).first()
        offer = wish.offers.filter(local=viewer).first()
        data["match_reasons"] = candidate.reasons if candidate else []
        data["dismissed"] = bool(candidate and candidate.dismissed)
        data["my_offer"] = serialize_offer(offer, request) if offer else None
        if detail:
            from apps.accounts.models import UserRole
            from apps.profiles.selectors import public_profile

            data["traveler_profile"] = public_profile(wish.traveler, viewer, UserRole.Role.TRAVELER, request)
    return data
