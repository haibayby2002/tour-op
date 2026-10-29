"""JWT authentication for WebSocket connections (token passed as ?token=)."""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def _user_from_token(raw: str):
    try:
        token = AccessToken(raw)
        return get_user_model().objects.get(id=token["user_id"], is_active=True)
    except (TokenError, KeyError, get_user_model().DoesNotExist):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get("query_string", b"").decode())
        token = (query.get("token") or [None])[0]
        scope["user"] = await _user_from_token(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)


class OriginValidator:
    """Validate browser Origins against ALLOWED_HOSTS but allow clients with no Origin.

    Native mobile apps don't send an Origin header. Cross-site WebSocket hijacking
    is a browser-only concern, and these sockets authenticate with a JWT in the
    query string (never cookies), so origin-less clients are safe to accept.
    """

    def __init__(self, application):
        self.application = application

    async def __call__(self, scope, receive, send):
        from channels.security.websocket import AllowedHostsOriginValidator

        has_origin = any(name == b"origin" for name, _ in scope.get("headers", []))
        # Built per connection so it always reflects the current ALLOWED_HOSTS.
        target = AllowedHostsOriginValidator(self.application) if has_origin else self.application
        return await target(scope, receive, send)
