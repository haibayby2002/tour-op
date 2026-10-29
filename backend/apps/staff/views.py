"""Staff console API: the moderation work of the Django admin, shaped for the web console at /staff.

Every write goes through the same audit trail (apps.audit.record) as the admin actions it replaces.
The Django admin stays available for raw data editing (reference data, one-off fixes).
"""
from datetime import timedelta

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User, UserRole
from apps.audit.models import AuditLog
from apps.audit.services import record
from apps.bookings.models import Booking
from apps.common.exceptions import DomainError
from apps.common.images import file_url
from apps.notifications.services import notify
from apps.profiles.models import ExternalReviewSource, LocalProfile
from apps.profiles.selectors import avatar_url
from apps.reviews.models import Review
from apps.safety.models import Report


class IsStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class StaffView(APIView):
    permission_classes = [IsStaff]


def _page(request, qs, serialize, default_size=25):
    try:
        page = max(int(request.query_params.get("page", 1)), 1)
    except ValueError:
        page = 1
    size = default_size
    total = len(qs) if isinstance(qs, list) else qs.count()
    items = qs[(page - 1) * size: page * size]
    return Response({"count": total, "page": page, "page_size": size, "results": [serialize(i) for i in items]})


def _person(user: User | None, request) -> dict | None:
    """Staff can see who a person is (name, email), unlike the public card."""
    if user is None:
        return None
    profile = getattr(user, "profile", None)
    return {
        "id": user.id,
        "name": user.full_name,
        "display_name": profile.public_name if profile else user.full_name,
        "email": user.email,
        "avatar": avatar_url(profile, request) if profile else None,
        "status": user.status,
    }


# --- overview -----------------------------------------------------------------------------------------------


class OverviewView(StaffView):
    def get(self, request):
        week_ago = timezone.now() - timedelta(days=7)
        users = User.objects.exclude(status=User.Status.DELETED)
        roles = dict(
            UserRole.objects.filter(user__in=users).values_list("role").annotate(n=Count("id")).values_list("role", "n")
        )
        bookings = dict(Booking.objects.values_list("status").annotate(n=Count("id")).values_list("status", "n"))
        recent = AuditLog.objects.select_related("actor").exclude(action__startswith="STAFF_VIEWED")[:12]
        return Response({
            "users": {
                "total": users.count(),
                "travelers": roles.get(UserRole.Role.TRAVELER, 0),
                "locals": roles.get(UserRole.Role.LOCAL, 0),
                "new_this_week": users.filter(date_joined__gte=week_ago).count(),
                "suspended": users.filter(status=User.Status.SUSPENDED).count(),
            },
            "queues": {
                "open_reports": Report.objects.filter(status__in=[Report.Status.OPEN, Report.Status.IN_REVIEW]).count(),
                "critical_reports": Report.objects.filter(
                    status__in=[Report.Status.OPEN, Report.Status.IN_REVIEW],
                    severity__in=[Report.Severity.HIGH, Report.Severity.CRITICAL],
                ).count(),
                "pending_locals": LocalProfile.objects.filter(review_status=LocalProfile.ReviewStatus.PENDING).count(),
                "unverified_external_reviews": ExternalReviewSource.objects.filter(
                    status=ExternalReviewSource.Status.UNVERIFIED
                ).count(),
                "disputed_bookings": bookings.get(Booking.Status.DISPUTED, 0),
            },
            "bookings": bookings,
            "recent_activity": [_audit(a) for a in recent],
        })


# --- users --------------------------------------------------------------------------------------------------


def _user_row(user: User, request) -> dict:
    return {
        **_person(user, request),
        "phone": user.phone,
        "roles": sorted(r.role for r in user.roles.all()),
        "is_staff": user.is_staff,
        "date_joined": user.date_joined,
        "last_login": user.last_login,
        "email_verified": user.is_verified("EMAIL"),
        "phone_verified": user.is_verified("PHONE"),
        "city": user.profile.city.name if getattr(user, "profile", None) and user.profile.city else None,
        "reports_received": user.reports_received.count(),
    }


class UserListView(StaffView):
    def get(self, request):
        p = request.query_params
        qs = User.objects.select_related("profile__city").prefetch_related("roles").order_by("-date_joined")
        if p.get("q"):
            q = p["q"].strip()
            qs = qs.filter(Q(email__icontains=q) | Q(full_name__icontains=q) | Q(phone__icontains=q)
                           | Q(profile__display_name__icontains=q))
        if p.get("role") in UserRole.Role.values:
            qs = qs.filter(roles__role=p["role"])
        if p.get("status") in User.Status.values:
            qs = qs.filter(status=p["status"])
        else:
            qs = qs.exclude(status=User.Status.DELETED)
        return _page(request, qs.distinct(), lambda u: _user_row(u, request))


class UserStatusInput(serializers.Serializer):
    status = serializers.ChoiceField(choices=[User.Status.ACTIVE, User.Status.SUSPENDED])
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)


class UserStatusView(StaffView):
    def post(self, request, pk: int):
        user = get_object_or_404(User, pk=pk)
        data = UserStatusInput(data=request.data)
        data.is_valid(raise_exception=True)
        if user.id == request.user.id:
            raise DomainError("You can't change your own status.", code="invalid_target")
        if user.status == User.Status.DELETED:
            raise DomainError("This account was deleted.", code="invalid_target")
        new = data.validated_data["status"]
        if user.status != new:
            user.status = new
            user.save(update_fields=["status"])
            action = "SUSPENDED" if new == User.Status.SUSPENDED else "REACTIVATED"
            record(request.user, user, action, request=request, note=data.validated_data.get("note", ""))
        return Response(_user_row(user, request))


# --- reports ------------------------------------------------------------------------------------------------


def _report(report: Report, request, detail=False) -> dict:
    data = {
        "id": report.id,
        "category": report.category,
        "severity": report.severity,
        "status": report.status,
        "description": report.description if detail else report.description[:200],
        "reporter": _person(report.reporter, request),
        "reported_user": _person(report.reported_user, request),
        "assigned_to": _person(report.assigned_to, request),
        "booking_id": report.booking_id,
        "opened_dispute": report.opened_dispute,
        "resolution_note": report.resolution_note,
        "created_at": report.created_at,
        "resolved_at": report.resolved_at,
    }
    if detail:
        data["evidence"] = [
            {"id": e.id, "file": file_url(e.file, request), "description": e.description, "created_at": e.created_at}
            for e in report.evidence.all()
        ]
        data["context"] = {
            "message": report.message.content if report.message_id else None,
            "review": report.review.comment if report.review_id else None,
            "tour_request_id": report.tour_request_id,
        }
    return data


REPORT_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]


class ReportListView(StaffView):
    def get(self, request):
        status = request.query_params.get("status", "active")
        qs = Report.objects.select_related("reporter__profile", "reported_user__profile", "assigned_to__profile")
        if status == "active":
            qs = qs.filter(status__in=[Report.Status.OPEN, Report.Status.IN_REVIEW])
        elif status in Report.Status.values:
            qs = qs.filter(status=status)
        # Most severe first, then oldest first so nothing waits forever.
        reports = sorted(qs, key=lambda r: (REPORT_ORDER.index(r.severity), r.created_at))
        return _page(request, reports, lambda r: _report(r, request))


class ReportUpdateInput(serializers.Serializer):
    status = serializers.ChoiceField(choices=Report.Status.choices, required=False)
    severity = serializers.ChoiceField(choices=Report.Severity.choices, required=False)
    resolution_note = serializers.CharField(required=False, allow_blank=True, max_length=5000)
    assign_to_me = serializers.BooleanField(required=False)


class ReportDetailView(StaffView):
    def _get(self, pk):
        return get_object_or_404(
            Report.objects.select_related("reporter__profile", "reported_user__profile", "assigned_to__profile",
                                          "message", "review").prefetch_related("evidence"),
            pk=pk,
        )

    def get(self, request, pk: int):
        report = self._get(pk)
        record(request.user, report, "STAFF_VIEWED_REPORT", request=request)
        return Response(_report(report, request, detail=True))

    def patch(self, request, pk: int):
        report = self._get(pk)
        data = ReportUpdateInput(data=request.data)
        data.is_valid(raise_exception=True)
        d = data.validated_data
        changed = []
        if d.get("assign_to_me"):
            report.assigned_to = request.user
            changed.append("assigned_to")
            if report.status == Report.Status.OPEN and "status" not in d:
                report.status = Report.Status.IN_REVIEW
                changed.append("status")
        for field in ("severity", "resolution_note", "status"):
            if field in d and getattr(report, field) != d[field]:
                setattr(report, field, d[field])
                changed.append(field)
        if "status" in changed:
            closed = report.status in (Report.Status.RESOLVED, Report.Status.DISMISSED)
            report.resolved_at = timezone.now() if closed else None
            changed.append("resolved_at")
        if changed:
            report.save(update_fields=sorted(set(changed)) + ["updated_at"])
            record(request.user, report, "REPORT_UPDATED", request=request, changed=sorted(set(changed)))
            if "status" in changed:
                notify(report.reporter, "report_updated", {"report_id": report.pk, "status": report.status})
        return Response(_report(report, request, detail=True))


# --- local profile checks -----------------------------------------------------------------------------------


def _local(local: LocalProfile, request) -> dict:
    user = local.user
    profile = user.profile
    return {
        **_person(user, request),
        "city": profile.city.name if profile.city else None,
        "bio": profile.bio,
        "experience_summary": local.experience_summary,
        "areas": local.areas_description,
        "years_experience": local.years_experience,
        "price_min": local.price_min,
        "price_max": local.price_max,
        "currency": local.currency,
        "completion": profile.local_completion,
        "review_status": local.review_status,
        "reviewed_at": local.reviewed_at,
        "service_count": user.services.count(),
        "email_verified": user.is_verified("EMAIL"),
        "phone_verified": user.is_verified("PHONE"),
        "external_reviews": [
            {"id": s.id, "platform": s.platform, "url": s.url, "rating_text": s.rating_text, "status": s.status,
             "screenshot": file_url(s.screenshot, request) if s.screenshot else None}
            for s in user.external_reviews.all()
        ],
        "updated_at": local.updated_at,
    }


class LocalListView(StaffView):
    def get(self, request):
        status = request.query_params.get("review_status", LocalProfile.ReviewStatus.PENDING)
        qs = LocalProfile.objects.select_related("user__profile__city").prefetch_related("user__external_reviews")
        if status in LocalProfile.ReviewStatus.values:
            qs = qs.filter(review_status=status)
        if request.query_params.get("q"):
            q = request.query_params["q"].strip()
            qs = qs.filter(Q(user__email__icontains=q) | Q(user__full_name__icontains=q))
        return _page(request, qs.order_by("-updated_at"), lambda lp: _local(lp, request))


class LocalReviewInput(serializers.Serializer):
    review_status = serializers.ChoiceField(choices=[
        LocalProfile.ReviewStatus.MANUALLY_CHECKED, LocalProfile.ReviewStatus.REJECTED, LocalProfile.ReviewStatus.PENDING,
    ])


class LocalReviewView(StaffView):
    ACTIONS = {"MANUALLY_CHECKED": "MANUALLY_CHECKED", "REJECTED": "MANUAL_CHECK_REJECTED", "PENDING": "MANUAL_CHECK_REOPENED"}

    def post(self, request, pk: int):
        local = get_object_or_404(LocalProfile.objects.select_related("user__profile__city"), pk=pk)
        data = LocalReviewInput(data=request.data)
        data.is_valid(raise_exception=True)
        local.review_status = data.validated_data["review_status"]
        local.reviewed_at = timezone.now()
        local.save(update_fields=["review_status", "reviewed_at", "updated_at"])
        record(request.user, local, self.ACTIONS[local.review_status], request=request)
        return Response(_local(local, request))


class ExternalReviewInput(serializers.Serializer):
    status = serializers.ChoiceField(choices=ExternalReviewSource.Status.choices)


class ExternalReviewView(StaffView):
    def post(self, request, pk: int):
        source = get_object_or_404(ExternalReviewSource, pk=pk)
        data = ExternalReviewInput(data=request.data)
        data.is_valid(raise_exception=True)
        source.status = data.validated_data["status"]
        source.save(update_fields=["status"])
        record(request.user, source, f"EXTERNAL_REVIEW_{source.status}", request=request)
        return Response({"id": source.id, "status": source.status})


# --- reviews ------------------------------------------------------------------------------------------------


def _review(review: Review, request) -> dict:
    return {
        "id": review.id,
        "booking_id": review.booking_id,
        "reviewer": _person(review.reviewer, request),
        "reviewee": _person(review.reviewee, request),
        "reviewee_role": review.reviewee_role,
        "rating": review.rating,
        "comment": review.comment,
        "felt_safe": review.felt_safe,
        "is_hidden": review.is_hidden,
        "reported": review.reports.exists(),
        "created_at": review.created_at,
    }


class ReviewListView(StaffView):
    def get(self, request):
        p = request.query_params
        qs = Review.objects.select_related("reviewer__profile", "reviewee__profile").order_by("-created_at")
        if p.get("filter") == "hidden":
            qs = qs.filter(is_hidden=True)
        elif p.get("filter") == "reported":
            qs = qs.filter(reports__isnull=False).distinct()
        elif p.get("filter") == "low":
            qs = qs.filter(rating__lte=2)
        return _page(request, qs, lambda r: _review(r, request))


class ReviewVisibilityInput(serializers.Serializer):
    is_hidden = serializers.BooleanField()


class ReviewVisibilityView(StaffView):
    def post(self, request, pk: int):
        review = get_object_or_404(Review.objects.select_related("reviewer__profile", "reviewee__profile"), pk=pk)
        data = ReviewVisibilityInput(data=request.data)
        data.is_valid(raise_exception=True)
        if review.is_hidden != data.validated_data["is_hidden"]:
            review.is_hidden = data.validated_data["is_hidden"]
            review.save(update_fields=["is_hidden"])
            record(request.user, review, "REVIEW_HIDDEN" if review.is_hidden else "REVIEW_UNHIDDEN", request=request)
        return Response(_review(review, request))


# --- bookings & audit ---------------------------------------------------------------------------------------


class BookingListView(StaffView):
    def get(self, request):
        qs = Booking.objects.select_related("traveler__profile", "local__profile", "service").order_by("-start_at")
        status = request.query_params.get("status")
        if status in Booking.Status.values:
            qs = qs.filter(status=status)
        return _page(request, qs, lambda b: {
            "id": b.id,
            "status": b.status,
            "traveler": _person(b.traveler, request),
            "local": _person(b.local, request),
            "service": b.service.title if b.service else None,
            "start_at": b.start_at,
            "group_size": b.group_size,
            "agreed_price": b.agreed_price,
            "currency": b.currency,
        })


def _audit(entry: AuditLog) -> dict:
    return {
        "id": entry.id,
        "actor": entry.actor.full_name if entry.actor else None,
        "actor_is_staff": bool(entry.actor and entry.actor.is_staff),
        "action": entry.action,
        "entity_type": entry.entity_type,
        "entity_id": entry.entity_id,
        "metadata": entry.metadata,
        "created_at": entry.created_at,
    }


class AuditLogView(StaffView):
    def get(self, request):
        qs = AuditLog.objects.select_related("actor")
        if request.query_params.get("q"):
            q = request.query_params["q"].strip()
            qs = qs.filter(Q(action__icontains=q) | Q(entity_type__icontains=q) | Q(actor__email__icontains=q))
        return _page(request, qs, _audit, default_size=50)
