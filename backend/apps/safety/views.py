from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import parsers, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.bookings.models import Booking, TourRequest
from apps.common.exceptions import DomainError
from apps.messaging.models import Message
from apps.profiles.selectors import public_card
from apps.reviews.models import Review

from . import services
from .models import Block, Report, ReportEvidence

User = get_user_model()
MAX_EVIDENCE_BYTES = 10 * 1024 * 1024
ALLOWED_EVIDENCE = ("image/", "application/pdf", "video/")


class ReportInputSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=Report.Category.choices)
    description = serializers.CharField(max_length=5000)
    reported_user = serializers.IntegerField(required=False)
    booking = serializers.IntegerField(required=False)
    message = serializers.IntegerField(required=False)
    review = serializers.IntegerField(required=False)
    tour_request = serializers.IntegerField(required=False)
    open_dispute = serializers.BooleanField(required=False, default=False)


def _get(model, pk):
    if pk is None:
        return None
    obj = model.objects.filter(pk=pk).first()
    if obj is None:
        raise DomainError("Not found.", code="not_found", status_code=404)
    return obj


def serialize_report(report: Report, request) -> dict:
    """The reporter's view. Staff notes stay internal except the final resolution."""
    return {
        "id": report.id,
        "category": report.category,
        "description": report.description,
        "status": report.status,
        "reported_user": public_card(report.reported_user, request) if report.reported_user else None,
        "booking_id": report.booking_id,
        "message_id": report.message_id,
        "review_id": report.review_id,
        "tour_request_id": report.tour_request_id,
        "opened_dispute": report.opened_dispute,
        "resolution_note": report.resolution_note if report.status in ("RESOLVED", "DISMISSED") else "",
        "evidence": [
            {"id": e.id, "file": request.build_absolute_uri(e.file.url), "description": e.description}
            for e in report.evidence.all()
        ],
        "created_at": report.created_at,
        "resolved_at": report.resolved_at,
    }


class ReportListCreateView(APIView):
    def get(self, request):
        reports = Report.objects.filter(reporter=request.user).prefetch_related("evidence")
        return Response([serialize_report(r, request) for r in reports])

    def post(self, request):
        serializer = ReportInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        report = services.create_report(
            request.user,
            category=d["category"],
            description=d["description"],
            reported_user=_get(User, d.get("reported_user")),
            booking=_get(Booking, d.get("booking")),
            message=_get(Message, d.get("message")),
            review=_get(Review, d.get("review")),
            tour_request=_get(TourRequest, d.get("tour_request")),
            open_dispute=d["open_dispute"],
            request=request,
        )
        return Response(serialize_report(report, request), status=status.HTTP_201_CREATED)


class ReportDetailView(APIView):
    def get(self, request, pk: int):
        report = get_object_or_404(Report, pk=pk, reporter=request.user)
        return Response(serialize_report(report, request))


class ReportEvidenceView(APIView):
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def post(self, request, pk: int):
        report = get_object_or_404(Report, pk=pk, reporter=request.user)
        file = request.FILES.get("file")
        if not file:
            raise DomainError("Choose a file.", code="missing_file")
        if file.size > MAX_EVIDENCE_BYTES:
            raise DomainError("File is larger than 10 MB.", code="file_too_large")
        if not (file.content_type or "").startswith(ALLOWED_EVIDENCE):
            raise DomainError("Only images, videos or PDFs are accepted.", code="invalid_file_type")
        if report.evidence.count() >= 10:
            raise DomainError("Up to 10 files per report.", code="too_many_files")
        ReportEvidence.objects.create(
            report=report, uploaded_by=request.user, file=file, description=request.data.get("description", "")[:300]
        )
        return Response(serialize_report(report, request), status=status.HTTP_201_CREATED)


class BlockListView(APIView):
    def get(self, request):
        blocks = Block.objects.filter(blocker=request.user).select_related("blocked__profile")
        return Response([{**public_card(b.blocked, request), "blocked_at": b.created_at} for b in blocks])

    def post(self, request):
        target = get_object_or_404(User, pk=request.data.get("user_id"))
        services.block_user(request.user, target)
        return Response(status=status.HTTP_201_CREATED)


class BlockDetailView(APIView):
    def delete(self, request, user_id: int):
        target = get_object_or_404(User, pk=user_id)
        services.unblock_user(request.user, target)
        return Response(status=status.HTTP_204_NO_CONTENT)
