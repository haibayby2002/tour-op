from django.contrib import admin, messages
from django.utils import timezone

from apps.audit.services import record
from apps.notifications.services import notify

from .models import Block, Report, ReportEvidence


class EvidenceInline(admin.TabularInline):
    model = ReportEvidence
    extra = 0
    can_delete = False
    readonly_fields = ("file", "description", "uploaded_by", "created_at")


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("id", "category", "severity", "status", "reporter", "reported_user", "booking",
                    "assigned_to", "created_at")
    list_filter = ("status", "severity", "category", "opened_dispute")
    search_fields = ("reporter__email", "reported_user__email", "description")
    readonly_fields = ("reporter", "reported_user", "booking", "message", "review", "tour_request",
                       "category", "description", "opened_dispute", "created_at", "resolved_at")
    fields = readonly_fields[:-2] + ("severity", "status", "assigned_to", "resolution_note", "created_at", "resolved_at")
    inlines = [EvidenceInline]
    actions = ["assign_to_me", "mark_resolved", "mark_dismissed"]

    def has_delete_permission(self, request, obj=None):
        return False  # reports are evidence

    def change_view(self, request, object_id, form_url="", extra_context=None):
        record(request.user, ("safety.report", object_id), "STAFF_VIEWED_REPORT", request=request)
        return super().change_view(request, object_id, form_url, extra_context)

    def save_model(self, request, obj, form, change):
        if change and "status" in form.changed_data:
            if obj.status in (Report.Status.RESOLVED, Report.Status.DISMISSED):
                obj.resolved_at = timezone.now()
            notify(obj.reporter, "report_updated", {"report_id": obj.pk, "status": obj.status})
        record(request.user, obj, "REPORT_UPDATED", request=request, changed=form.changed_data)
        super().save_model(request, obj, form, change)

    @admin.action(description="Assign to me (in review)")
    def assign_to_me(self, request, queryset):
        queryset.update(assigned_to=request.user, status=Report.Status.IN_REVIEW)
        for report in queryset:
            record(request.user, report, "REPORT_ASSIGNED", request=request)

    def _close(self, request, queryset, status):
        for report in queryset:
            report.status = status
            report.resolved_at = timezone.now()
            report.save(update_fields=["status", "resolved_at"])
            record(request.user, report, f"REPORT_{status}", request=request)
            notify(report.reporter, "report_updated", {"report_id": report.pk, "status": status})
        messages.success(request, f"Updated {queryset.count()} report(s).")

    @admin.action(description="Mark resolved")
    def mark_resolved(self, request, queryset):
        self._close(request, queryset, Report.Status.RESOLVED)

    @admin.action(description="Dismiss")
    def mark_dismissed(self, request, queryset):
        self._close(request, queryset, Report.Status.DISMISSED)


@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display = ("blocker", "blocked", "created_at")
