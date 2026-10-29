from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import UserRole
from apps.common.exceptions import DomainError
from apps.profiles.selectors import public_card, public_profile

from . import services
from .models import Agreement, Booking, TourRequest, TripShare
from .serializers import (
    AcceptAgreementSerializer,
    AgreementInputSerializer,
    AgreementSerializer,
    BookingListSerializer,
    BookingSerializer,
    CancelSerializer,
    NoteSerializer,
    TourRequestInputSerializer,
    TourRequestSerializer,
    TourRequestUpdateSerializer,
    TripShareSerializer,
)


class TourRequestViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """GET ?box=sent|received&status=PENDING"""

    serializer_class = TourRequestSerializer

    def get_queryset(self):
        user = self.request.user
        qs = TourRequest.objects.filter(Q(traveler=user) | Q(local=user)).select_related(
            "traveler__profile", "local__profile", "service", "city", "language", "booking"
        ).prefetch_related("interests")
        box = self.request.query_params.get("box")
        if box == "sent":
            qs = qs.filter(traveler=user)
        elif box == "received":
            qs = qs.filter(local=user)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status__in=status_filter.upper().split(","))
        return qs

    def create(self, request):
        serializer = TourRequestInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        req = services.create_request(request.user, interests=data.pop("interests", []), **data)
        return Response(self.get_serializer(req).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        req = self.get_object()
        data = self.get_serializer(req).data
        # The local sees the traveler's profile and trust signals before deciding (PRD E2).
        if request.user.id == req.local_id:
            data["traveler_profile"] = public_profile(req.traveler, request.user, UserRole.Role.TRAVELER, request)
        return Response(data)

    def partial_update(self, request, pk=None):
        req = self.get_object()
        serializer = TourRequestUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        req = services.update_request(request.user, req, interests=data.pop("interests", None), **data)
        return Response(self.get_serializer(req).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        req = services.cancel_request(request.user, self.get_object())
        return Response(self.get_serializer(req).data)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        booking = services.accept_request(request.user, self.get_object())
        return Response(BookingSerializer(booking, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        serializer = NoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        req = services.decline_request(request.user, self.get_object(), serializer.validated_data["note"])
        return Response(self.get_serializer(req).data)

    @action(detail=True, methods=["post"], url_path="ask-info")
    def ask_info(self, request, pk=None):
        serializer = NoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        req = services.ask_for_info(request.user, self.get_object(), serializer.validated_data["note"])
        return Response(self.get_serializer(req).data)


class BookingViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """GET ?role=traveler|local&status=CONFIRMED,IN_PROGRESS"""

    def get_serializer_class(self):
        return BookingListSerializer if self.action == "list" else BookingSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Booking.objects.filter(Q(traveler=user) | Q(local=user)).select_related(
            "traveler__profile", "local__profile", "service", "tour_request__city", "current_agreement",
        )
        role = self.request.query_params.get("role")
        if role == "traveler":
            qs = qs.filter(traveler=user)
        elif role == "local":
            qs = qs.filter(local=user)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status__in=status_filter.upper().split(","))
        return qs

    def _respond(self, booking, code=status.HTTP_200_OK):
        booking.refresh_from_db()
        return Response(BookingSerializer(booking, context={"request": self.request}).data, status=code)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        serializer = CancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._respond(services.cancel_booking(request.user, self.get_object(), serializer.validated_data["reason"]))

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        return self._respond(services.start_booking(request.user, self.get_object()))

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        return self._respond(services.complete_booking(request.user, self.get_object()))

    @action(detail=True, methods=["get", "post"])
    def agreements(self, request, pk=None):
        booking = self.get_object()
        if request.method == "GET":
            return Response(AgreementSerializer(booking.agreements.prefetch_related("stops__place"), many=True).data)
        serializer = AgreementInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        agreement = services.propose_agreement(request.user, booking, stops=data.pop("stops"), **data)
        return Response(AgreementSerializer(agreement).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"])
    def shares(self, request, pk=None):
        booking = self.get_object()
        if request.method == "GET":
            if booking.traveler_id != request.user.id:
                return Response([])
            return Response(TripShareSerializer(booking.shares.all(), many=True).data)
        share = services.create_share(
            request.user, booking, include_itinerary=bool(request.data.get("include_itinerary", True))
        )
        return Response(TripShareSerializer(share).data, status=status.HTTP_201_CREATED)


class AgreementActionViewSet(viewsets.GenericViewSet):
    def get_queryset(self):
        user = self.request.user
        return Agreement.objects.filter(Q(booking__traveler=user) | Q(booking__local=user)).select_related("booking")

    def _respond(self, agreement):
        agreement.refresh_from_db()
        return Response(AgreementSerializer(agreement).data)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        serializer = AcceptAgreementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._respond(services.accept_agreement(request.user, self.get_object(), **serializer.validated_data))

    @action(detail=True, methods=["post"], url_path="request-changes")
    def request_changes(self, request, pk=None):
        serializer = NoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._respond(services.request_changes(request.user, self.get_object(), serializer.validated_data["note"]))

    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        return self._respond(services.withdraw_agreement(request.user, self.get_object()))


class ShareRevokeView(APIView):
    def delete(self, request, pk: int):
        share = get_object_or_404(TripShare, pk=pk, created_by=request.user)
        services.revoke_share(request.user, share)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PublicShareView(APIView):
    """What a traveler's family/friends see. No contact details, no prices."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, token: str):
        share = get_object_or_404(TripShare.objects.select_related("booking"), token=token)
        if share.revoked_at or share.expires_at < timezone.now():
            raise DomainError("This link has expired.", code="share_expired", status_code=410)
        booking = share.booking
        agreement = booking.current_agreement
        data = {
            "status": booking.status,
            "traveler_name": booking.traveler.profile.public_name,
            "local": public_card(booking.local, request),
            "start_at": booking.start_at,
            "end_at": booking.end_at,
            "group_size": booking.group_size,
            "meeting_point": agreement.meeting_point if agreement else None,
            "city": booking.tour_request.city.name,
            "itinerary": None,
            "expires_at": share.expires_at,
        }
        if share.include_itinerary and agreement:
            data["itinerary"] = [
                {"time": s.time, "place_name": s.place_name, "activity": s.activity, "kind": s.kind}
                for s in agreement.stops.filter(declined_by_traveler=False)
            ]
        return Response(data)

