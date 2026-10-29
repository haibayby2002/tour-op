from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.pagination import StandardPagination

from .models import DeviceToken, Notification
from .services import serialize


class NotificationListView(APIView):
    def get(self, request):
        qs = request.user.notifications.all()
        if request.query_params.get("unread") == "1":
            qs = qs.filter(read_at__isnull=True)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response([serialize(n) for n in page])


class UnreadCountView(APIView):
    def get(self, request):
        return Response({"count": request.user.notifications.filter(read_at__isnull=True).count()})


class MarkNotificationReadView(APIView):
    def post(self, request, pk: int):
        notification = get_object_or_404(Notification, pk=pk, user=request.user)
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(serialize(notification))


class MarkAllReadView(APIView):
    def post(self, request):
        request.user.notifications.filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeviceTokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=255)
    platform = serializers.ChoiceField(choices=DeviceToken.Platform.choices)


class DeviceTokenView(APIView):
    def post(self, request):
        serializer = DeviceTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        DeviceToken.objects.update_or_create(
            token=serializer.validated_data["token"],
            defaults={"user": request.user, "platform": serializer.validated_data["platform"]},
        )
        return Response(status=status.HTTP_201_CREATED)

    def delete(self, request):
        DeviceToken.objects.filter(user=request.user, token=request.data.get("token", "")).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
