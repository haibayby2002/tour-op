from django.shortcuts import get_object_or_404
from rest_framework import parsers, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User, UserRole
from apps.common.exceptions import DomainError

from .models import LocalService, ServicePhoto
from .serializers import LocalServiceSerializer, ServicePhotoSerializer


class MyServiceViewSet(viewsets.ModelViewSet):
    """Services owned by the current local."""

    serializer_class = LocalServiceSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            LocalService.objects.filter(local=self.request.user)
            .exclude(status=LocalService.Status.ARCHIVED)
            .select_related("category", "city")
            .prefetch_related("photos")
        )

    def perform_create(self, serializer):
        if not self.request.user.has_role(UserRole.Role.LOCAL):
            raise DomainError("Add the Local role to offer experiences.", code="not_local", status_code=403)
        serializer.save(local=self.request.user)

    def perform_destroy(self, instance):
        # Services referenced by bookings must remain as a historical record.
        instance.status = LocalService.Status.ARCHIVED
        instance.save(update_fields=["status"])

    @action(detail=True, methods=["post"], parser_classes=[parsers.MultiPartParser, parsers.FormParser])
    def photos(self, request, pk=None):
        service = self.get_object()
        if service.photos.count() >= 8:
            raise DomainError("Up to 8 photos per experience.", code="too_many_photos")
        serializer = ServicePhotoSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save(service=service)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"photos/(?P<photo_id>\d+)")
    def delete_photo(self, request, pk=None, photo_id=None):
        service = self.get_object()
        get_object_or_404(ServicePhoto, pk=photo_id, service=service).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ServiceDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk: int):
        service = get_object_or_404(
            LocalService.objects.select_related("category", "city", "local").filter(
                status=LocalService.Status.ACTIVE, local__status=User.Status.ACTIVE
            ),
            pk=pk,
        )
        return Response(LocalServiceSerializer(service, context={"request": request}).data)
