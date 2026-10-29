from django.db.models import Max
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.profiles.selectors import public_card

from . import services
from .models import Conversation


def conversation_summary(conversation: Conversation, user, request) -> dict:
    booking = conversation.booking
    other = booking.other_party(user)
    last = services.visible_messages(conversation, user).order_by("-created_at", "-id").first()
    return {
        "id": conversation.id,
        "booking_id": booking.id,
        "booking_status": booking.status,
        "status": conversation.status,
        "my_role": booking.role_of(user),
        "other": public_card(other, request),
        "last_message": services.serialize_message(last) if last else None,
        "unread_count": services.unread_count(user, conversation),
    }


class ConversationListView(APIView):
    def get(self, request):
        conversations = (
            Conversation.objects.filter(members__user=request.user)
            .select_related("booking", "booking__traveler__profile", "booking__local__profile")
            .annotate(last_at=Max("messages__created_at"))
            .order_by("-last_at")
        )
        return Response([conversation_summary(c, request.user, request) for c in conversations])


class ConversationDetailView(APIView):
    def get(self, request, conversation_id: int):
        conversation = services.get_conversation_for(request.user, conversation_id)
        return Response(conversation_summary(conversation, request.user, request))


class MessageListView(APIView):
    """GET ?before=<id>&limit=50 returns older messages, newest last."""

    def get(self, request, conversation_id: int):
        conversation = services.get_conversation_for(request.user, conversation_id)
        qs = services.visible_messages(conversation, request.user)
        before = request.query_params.get("before")
        if before and before.isdigit():
            qs = qs.filter(id__lt=int(before))
        limit = min(int(request.query_params.get("limit", 50) or 50), 100)
        messages = list(qs.order_by("-created_at", "-id")[:limit])[::-1]
        return Response(
            {"results": [services.serialize_message(m) for m in messages], "has_more": qs.count() > limit}
        )

    def post(self, request, conversation_id: int):
        conversation = services.get_conversation_for(request.user, conversation_id)
        message = services.send_message(request.user, conversation, request.data.get("content", ""))
        return Response(services.serialize_message(message), status=status.HTTP_201_CREATED)


class MarkReadView(APIView):
    def post(self, request, conversation_id: int):
        conversation = services.get_conversation_for(request.user, conversation_id)
        services.mark_read(request.user, conversation)
        return Response(status=status.HTTP_204_NO_CONTENT)
