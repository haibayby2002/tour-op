from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User, UserRole
from apps.bookings.models import Booking
from apps.common.pagination import StandardPagination

from .selectors import reviews_for, serialize_review
from .services import create_review


class ReviewInputSerializer(serializers.Serializer):
    booking = serializers.IntegerField()
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(max_length=2000, allow_blank=True, required=False, default="")
    felt_safe = serializers.BooleanField(required=False, allow_null=True)
    itinerary_respected = serializers.BooleanField(required=False, allow_null=True)
    price_as_agreed = serializers.BooleanField(required=False, allow_null=True)


class ReviewCreateView(APIView):
    def post(self, request):
        serializer = ReviewInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        booking = get_object_or_404(
            Booking.objects.filter(Q(traveler=request.user) | Q(local=request.user)), pk=data.pop("booking")
        )
        review = create_review(request.user, booking, **data)
        return Response(serialize_review(review, request), status=status.HTTP_201_CREATED)


class UserReviewsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, user_id: int):
        user = get_object_or_404(User, pk=user_id, status=User.Status.ACTIVE)
        role = request.query_params.get("role", UserRole.Role.LOCAL).upper()
        paginator = StandardPagination()
        page = paginator.paginate_queryset(reviews_for(user, role), request, view=self)
        return paginator.get_paginated_response([serialize_review(r, request) for r in page])
