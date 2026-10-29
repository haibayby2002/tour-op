import pytest
from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import AccessToken

from config.asgi import application

from .conftest import client_for, request_payload


def _connect(user, conversation_id):
    token = str(AccessToken.for_user(user)) if user else "bad"
    return WebsocketCommunicator(
        application, f"/ws/conversations/{conversation_id}/?token={token}", headers=[(b"origin", b"http://localhost")]
    )


@pytest.mark.django_db(transaction=True)
def test_websocket_chat_between_members_and_outsider_rejected(traveler, local, outsider):
    req = client_for(traveler).post("/api/v1/tour-requests/", request_payload(local), format="json").data
    cid = client_for(local).post(f"/api/v1/tour-requests/{req['id']}/accept/").data["conversation_id"]

    async def scenario():
        t = _connect(traveler, cid)
        l = _connect(local, cid)
        assert (await t.connect())[0]
        assert (await l.connect())[0]

        await t.send_json_to({"type": "send", "content": "See you at the lake!"})
        event = await l.receive_json_from(timeout=5)
        assert event["type"] == "message"
        assert event["message"]["content"] == "See you at the lake!"

        await t.send_json_to({"type": "send", "content": "my email is a@b.com"})
        blocked = await t.receive_json_from(timeout=5)
        # sender gets the echo of their own clean message first, then the blocked notice
        if blocked["message"]["moderation_status"] != "BLOCKED":
            blocked = await t.receive_json_from(timeout=5)
        assert blocked["message"]["moderation_status"] == "BLOCKED"
        assert await l.receive_nothing(timeout=0.5)

        o = _connect(outsider, cid)
        connected, code = await o.connect()
        assert not connected
        anon = _connect(None, cid)
        connected, _ = await anon.connect()
        assert not connected

        await t.disconnect()
        await l.disconnect()

    async_to_sync(scenario)()


@pytest.mark.django_db(transaction=True)
def test_native_clients_without_origin_connect_but_foreign_browser_origins_are_rejected(traveler, local, settings):
    settings.ALLOWED_HOSTS = ["api.tour-op.com", "testserver"]
    req = client_for(traveler).post("/api/v1/tour-requests/", request_payload(local), format="json").data
    cid = client_for(local).post(f"/api/v1/tour-requests/{req['id']}/accept/").data["conversation_id"]
    token = str(AccessToken.for_user(traveler))

    async def scenario():
        native = WebsocketCommunicator(application, f"/ws/conversations/{cid}/?token={token}")
        assert (await native.connect())[0]
        await native.disconnect()
        evil = WebsocketCommunicator(
            application, f"/ws/conversations/{cid}/?token={token}", headers=[(b"origin", b"https://evil.example")]
        )
        assert not (await evil.connect())[0]

    async_to_sync(scenario)()
