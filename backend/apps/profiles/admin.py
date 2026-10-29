from django.contrib import admin, messages
from django.utils.html import format_html
from django.utils import timezone

from apps.audit.services import record

from .models import (
    City,
    ExternalReviewSource,
    Interest,
    Language,
    LocalAvailability,
    LocalProfile,
    Place,
    Profile,
    ProfilePhoto,
    TravelerProfile,
)


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ("name", "name_vi", "slug", "country", "is_active")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Language)
class LanguageAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "name_vi")


@admin.register(Interest)
class InterestAdmin(admin.ModelAdmin):
    list_display = ("slug", "name", "name_vi", "category")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Place)
class PlaceAdmin(admin.ModelAdmin):
    list_display = ("name", "name_vi", "city", "category", "slug", "is_active")
    list_filter = ("city", "category", "is_active")
    search_fields = ("name", "name_vi", "slug", "address")
    prepopulated_fields = {"slug": ("name",)}


class PhotoInline(admin.TabularInline):
    model = ProfilePhoto
    fk_name = "user"
    extra = 0


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "display_name", "city", "traveler_completion", "local_completion", "updated_at")
    search_fields = ("user__email", "display_name", "user__full_name")
    list_filter = ("city", "visibility")
    readonly_fields = ("traveler_completion", "local_completion")


@admin.register(LocalProfile)
class LocalProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "review_status", "price_min", "price_max", "is_accepting_requests", "updated_at")
    list_filter = ("review_status", "is_accepting_requests")
    search_fields = ("user__email", "user__full_name")
    actions = ["mark_manually_checked", "mark_rejected"]

    def _set(self, request, queryset, status, action):
        for local in queryset:
            local.review_status = status
            local.reviewed_at = timezone.now()
            local.save(update_fields=["review_status", "reviewed_at"])
            record(request.user, local, action, request=request)
        messages.success(request, f"Updated {queryset.count()} profile(s).")

    @admin.action(description="Mark as manually checked")
    def mark_manually_checked(self, request, queryset):
        self._set(request, queryset, LocalProfile.ReviewStatus.MANUALLY_CHECKED, "MANUALLY_CHECKED")

    @admin.action(description="Reject manual check")
    def mark_rejected(self, request, queryset):
        self._set(request, queryset, LocalProfile.ReviewStatus.REJECTED, "MANUAL_CHECK_REJECTED")


@admin.register(TravelerProfile)
class TravelerProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "travel_style", "visibility", "updated_at")


@admin.register(ProfilePhoto)
class ProfilePhotoAdmin(admin.ModelAdmin):
    list_display = ("id", "preview", "user", "caption", "status", "created_at")
    list_filter = ("status",)
    actions = ["hide_photos"]

    @admin.display(description="Photo")
    def preview(self, photo):
        file = photo.thumbnail or photo.image
        return format_html('<img src="{}" style="height:64px;border-radius:6px">', file.url) if file else "-"

    @admin.action(description="Hide selected photos (moderation)")
    def hide_photos(self, request, queryset):
        for photo in queryset:
            photo.status = ProfilePhoto.Status.HIDDEN
            photo.save(update_fields=["status"])
            record(request.user, photo, "PHOTO_HIDDEN", request=request)


@admin.register(ExternalReviewSource)
class ExternalReviewSourceAdmin(admin.ModelAdmin):
    list_display = ("user", "platform", "url", "rating_text", "status", "created_at")
    list_filter = ("platform", "status")
    actions = ["mark_verified", "mark_rejected"]

    @admin.action(description="Mark as verified (checked it belongs to this person)")
    def mark_verified(self, request, queryset):
        for src in queryset:
            src.status = ExternalReviewSource.Status.VERIFIED
            src.save(update_fields=["status"])
            record(request.user, src, "EXTERNAL_REVIEW_VERIFIED", request=request)

    @admin.action(description="Reject")
    def mark_rejected(self, request, queryset):
        for src in queryset:
            src.status = ExternalReviewSource.Status.REJECTED
            src.save(update_fields=["status"])
            record(request.user, src, "EXTERNAL_REVIEW_REJECTED", request=request)


@admin.register(LocalAvailability)
class LocalAvailabilityAdmin(admin.ModelAdmin):
    list_display = ("local", "start_at", "end_at", "note")
