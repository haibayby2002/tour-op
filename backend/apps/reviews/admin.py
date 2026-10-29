from django.contrib import admin

from apps.audit.services import record

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "booking", "reviewer", "reviewee", "reviewee_role", "rating", "is_hidden", "created_at")
    list_filter = ("reviewee_role", "rating", "is_hidden", "felt_safe")
    search_fields = ("reviewer__email", "reviewee__email", "comment")
    readonly_fields = [f.name for f in Review._meta.fields if f.name != "is_hidden"]
    actions = ["hide_reviews", "unhide_reviews"]

    def has_add_permission(self, request):
        return False

    @admin.action(description="Hide selected reviews")
    def hide_reviews(self, request, queryset):
        for review in queryset:
            review.is_hidden = True
            review.save(update_fields=["is_hidden"])
            record(request.user, review, "REVIEW_HIDDEN", request=request)

    @admin.action(description="Unhide selected reviews")
    def unhide_reviews(self, request, queryset):
        for review in queryset:
            review.is_hidden = False
            review.save(update_fields=["is_hidden"])
            record(request.user, review, "REVIEW_UNHIDDEN", request=request)
