from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils import timezone

from apps.audit.services import record

from .models import User, UserRole, Verification


class UserRoleInline(admin.TabularInline):
    model = UserRole
    extra = 0


class VerificationInline(admin.TabularInline):
    model = Verification
    fk_name = "user"
    extra = 0
    fields = ("kind", "status", "target", "verified_at", "reviewed_by", "note", "created_at")
    readonly_fields = ("created_at",)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("-date_joined",)
    list_display = ("email", "full_name", "phone", "status", "is_staff", "date_joined")
    list_filter = ("status", "is_staff", "roles__role")
    search_fields = ("email", "full_name", "phone")
    inlines = [UserRoleInline, VerificationInline]
    actions = ["suspend_users", "reactivate_users"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal", {"fields": ("full_name", "birth_year", "phone", "preferred_language")}),
        ("Status", {"fields": ("status", "is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "full_name", "birth_year", "phone", "password1", "password2")}),
    )

    @admin.action(description="Suspend selected users")
    def suspend_users(self, request, queryset):
        for user in queryset:
            user.status = User.Status.SUSPENDED
            user.save(update_fields=["status"])
            record(request.user, user, "SUSPENDED", request=request)
        messages.success(request, f"Suspended {queryset.count()} user(s).")

    @admin.action(description="Reactivate selected users")
    def reactivate_users(self, request, queryset):
        for user in queryset:
            user.status = User.Status.ACTIVE
            user.save(update_fields=["status"])
            record(request.user, user, "REACTIVATED", request=request)


@admin.register(Verification)
class VerificationAdmin(admin.ModelAdmin):
    list_display = ("user", "kind", "status", "target", "verified_at", "reviewed_by", "created_at")
    list_filter = ("kind", "status")
    search_fields = ("user__email", "target")
    exclude = ("code_hash",)
    actions = ["mark_identity_verified"]

    @admin.action(description="Mark IDENTITY verifications as verified (after manual document check)")
    def mark_identity_verified(self, request, queryset):
        count = 0
        for v in queryset.filter(kind=Verification.Kind.IDENTITY):
            v.status = Verification.Status.VERIFIED
            v.verified_at = timezone.now()
            v.reviewed_by = request.user
            v.save()
            record(request.user, v, "IDENTITY_VERIFIED", request=request, user_id=v.user_id)
            count += 1
        messages.success(request, f"Marked {count} identity verification(s) as verified.")
