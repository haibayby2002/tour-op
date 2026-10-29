from django.contrib import admin

from apps.audit.services import record

from .models import Conversation, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    can_delete = False
    fields = ("created_at", "sender", "kind", "content", "system_code", "moderation_status", "moderation_reasons")
    readonly_fields = fields


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    """Reading a conversation is sensitive: every staff view is audited."""

    list_display = ("id", "booking", "status", "created_at")
    list_filter = ("status",)
    inlines = [MessageInline]
    readonly_fields = ("booking", "created_at", "closed_at")

    def change_view(self, request, object_id, form_url="", extra_context=None):
        record(request.user, ("messaging.conversation", object_id), "STAFF_VIEWED_CONVERSATION", request=request)
        return super().change_view(request, object_id, form_url, extra_context)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "sender", "kind", "moderation_status", "created_at")
    list_filter = ("moderation_status", "kind")
    readonly_fields = [f.name for f in Message._meta.fields]

    def has_add_permission(self, request):
        return False

    def change_view(self, request, object_id, form_url="", extra_context=None):
        record(request.user, ("messaging.message", object_id), "STAFF_VIEWED_MESSAGE", request=request)
        return super().change_view(request, object_id, form_url, extra_context)
