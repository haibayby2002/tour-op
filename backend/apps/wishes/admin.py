from django.contrib import admin

from .models import TripWish, WishCandidate, WishOffer


class CandidateInline(admin.TabularInline):
    model = WishCandidate
    extra = 0
    readonly_fields = ("local", "score", "reasons", "notified_at", "dismissed")
    can_delete = False


class OfferInline(admin.TabularInline):
    model = WishOffer
    extra = 0
    readonly_fields = ("local", "message", "proposed_price", "status", "booking", "created_at")
    can_delete = False


@admin.register(TripWish)
class TripWishAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "traveler", "city", "start_at", "status", "created_at")
    list_filter = ("status", "city")
    search_fields = ("title", "traveler__email")
    inlines = [CandidateInline, OfferInline]
