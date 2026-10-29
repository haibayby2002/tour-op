from django.contrib import admin, messages

from . import services
from .models import Agreement, Booking, ItineraryStop, TourRequest, TripShare


@admin.register(TourRequest)
class TourRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "traveler", "local", "city", "start_at", "group_size", "status", "created_at")
    list_filter = ("status", "city")
    search_fields = ("traveler__email", "local__email")


class AgreementInline(admin.TabularInline):
    model = Agreement
    extra = 0
    can_delete = False
    fields = ("version", "status", "price", "currency", "price_unit", "start_at", "end_at", "created_at")
    readonly_fields = fields
    show_change_link = True


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("id", "traveler", "local", "status", "start_at", "agreed_price", "currency")
    list_filter = ("status",)
    search_fields = ("traveler__email", "local__email")
    inlines = [AgreementInline]
    readonly_fields = ("current_agreement", "status", "confirmed_at", "started_at", "completed_at", "cancelled_at")
    actions = ["resolve_completed", "resolve_cancelled"]

    def _resolve(self, request, queryset, outcome):
        done = 0
        for booking in queryset.filter(status=Booking.Status.DISPUTED):
            services.resolve_dispute(request.user, booking, outcome, note="Resolved via admin")
            done += 1
        messages.success(request, f"Resolved {done} disputed booking(s) as {outcome}.")

    @admin.action(description="Resolve dispute → COMPLETED")
    def resolve_completed(self, request, queryset):
        self._resolve(request, queryset, Booking.Status.COMPLETED)

    @admin.action(description="Resolve dispute → CANCELLED")
    def resolve_cancelled(self, request, queryset):
        self._resolve(request, queryset, Booking.Status.CANCELLED)


class StopInline(admin.TabularInline):
    model = ItineraryStop
    extra = 0
    can_delete = False
    readonly_fields = ("order", "time", "place_name", "activity", "kind", "estimated_cost", "declined_by_traveler")


@admin.register(Agreement)
class AgreementAdmin(admin.ModelAdmin):
    """Agreements are evidence; staff can read but never edit them."""

    list_display = ("id", "booking", "version", "status", "price", "currency", "created_at")
    list_filter = ("status",)
    inlines = [StopInline]

    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in Agreement._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(TripShare)
class TripShareAdmin(admin.ModelAdmin):
    list_display = ("id", "booking", "created_by", "expires_at", "revoked_at")
