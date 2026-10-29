from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.bookings.serializers import BookingSerializer

from . import services
from .models import TripWish, WishOffer
from .serializers import OfferInputSerializer, WishInputSerializer, serialize_offer, serialize_wish


class TripWishViewSet(viewsets.ViewSet):
    """GET ?box=mine (traveler's wishes) | for_me (wishes matched to me as a local)."""

    def _visible(self):
        user = self.request.user
        # Only the owner and matched locals can see a wish.
        return TripWish.objects.filter(Q(traveler=user) | Q(candidates__local=user)).distinct().select_related(
            "city", "language", "category", "traveler__profile"
        )

    def _get(self, pk):
        return get_object_or_404(self._visible(), pk=pk)

    def list(self, request):
        box = request.query_params.get("box", "mine")
        qs = self._visible()
        if box == "for_me":
            qs = qs.filter(candidates__local=request.user, candidates__dismissed=False)
            if request.query_params.get("open") != "0":
                qs = qs.filter(status=TripWish.Status.OPEN)
        else:
            qs = qs.filter(traveler=request.user)
        return Response([serialize_wish(w, request.user, request) for w in qs[:100]])

    def create(self, request):
        serializer = WishInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        wish = services.create_wish(request.user, interests=data.pop("interests", []), **data)
        wish.refresh_from_db()
        return Response(serialize_wish(wish, request.user, request, detail=True), status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        return Response(serialize_wish(self._get(pk), request.user, request, detail=True))

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        wish = services.close_wish(request.user, self._get(pk))
        return Response(serialize_wish(wish, request.user, request, detail=True))

    @action(detail=True, methods=["post"])
    def offer(self, request, pk=None):
        serializer = OfferInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        offer = services.make_offer(request.user, self._get(pk), **serializer.validated_data)
        return Response(serialize_offer(offer, request), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def dismiss(self, request, pk=None):
        services.dismiss(request.user, self._get(pk))
        return Response(status=status.HTTP_204_NO_CONTENT)


class WishOfferViewSet(viewsets.ViewSet):
    def _get(self, pk):
        user = self.request.user
        return get_object_or_404(
            WishOffer.objects.filter(Q(local=user) | Q(wish__traveler=user)).select_related("wish", "local"), pk=pk
        )

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        booking = services.accept_offer(request.user, self._get(pk))
        return Response(BookingSerializer(booking, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        return Response(serialize_offer(services.decline_offer(request.user, self._get(pk)), request))

    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        return Response(serialize_offer(services.withdraw_offer(request.user, self._get(pk)), request))
