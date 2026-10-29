from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.common.exceptions import DomainError

from . import services


class ConversationConsumer(AsyncJsonWebsocketConsumer):
    """Realtime channel for one conversation.

    Client -> server: {"type": "send", "content": "..."} | {"type": "typing"} | {"type": "read"}
    Server -> client: {"type": "message", "message": {...}} | {"type": "typing", "user_id": n}
                      {"type": "read", "user_id": n, "at": iso} | {"type": "error", ...}
    """

    async def connect(self):
        user = self.scope.get("user")
        self.conversation_id = int(self.scope["url_route"]["kwargs"]["conversation_id"])
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return
        self.conversation = await self._load(user)
        if self.conversation is None:
            await self.close(code=4404)
            return
        self.group = services.group_name(self.conversation_id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if getattr(self, "group", None):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    @database_sync_to_async
    def _load(self, user):
        try:
            return services.get_conversation_for(user, self.conversation_id)
        except DomainError:
            return None

    @database_sync_to_async
    def _send(self, content):
        conversation = services.get_conversation_for(self.scope["user"], self.conversation_id)
        return services.serialize_message(services.send_message(self.scope["user"], conversation, content))

    @database_sync_to_async
    def _read(self):
        conversation = services.get_conversation_for(self.scope["user"], self.conversation_id)
        services.mark_read(self.scope["user"], conversation)

    async def receive_json(self, content, **kwargs):
        kind = content.get("type")
        try:
            if kind == "send":
                message = await self._send(content.get("content", ""))
                if message["moderation_status"] == "BLOCKED":
                    # Only the sender learns about a blocked message.
                    await self.send_json({"type": "message", "message": message})
            elif kind == "typing":
                await self.channel_layer.group_send(
                    self.group, {"type": "typing.event", "user_id": self.scope["user"].id}
                )
            elif kind == "read":
                await self._read()
        except DomainError as exc:
            await self.send_json({"type": "error", **exc.detail})

    async def message_new(self, event):
        await self.send_json({"type": "message", "message": event["message"]})

    async def typing_event(self, event):
        if event["user_id"] != self.scope["user"].id:
            await self.send_json({"type": "typing", "user_id": event["user_id"]})

    async def read_receipt(self, event):
        await self.send_json({"type": "read", "user_id": event["user_id"], "at": event["at"]})
