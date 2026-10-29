import json
from unittest import mock

import pytest

from apps.notifications.models import DeviceToken
from apps.notifications.tasks import send_push_notification

from .conftest import make_user


class FakeResponse:
    def __init__(self, body):
        self.body = json.dumps(body).encode()

    def read(self):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


@pytest.mark.django_db
def test_failed_push_tickets_are_logged_and_stale_tokens_removed(reference, settings, caplog):
    settings.EXPO_PUSH_ENABLED = True
    user = make_user("push@example.com")
    DeviceToken.objects.create(user=user, token="ExponentPushToken[good]", platform="android")
    DeviceToken.objects.create(user=user, token="ExponentPushToken[gone]", platform="android")
    tickets = {"data": [
        {"status": "ok", "id": "abc"},
        {"status": "error", "message": "not registered", "details": {"error": "DeviceNotRegistered"}},
    ]}
    tokens = list(DeviceToken.objects.filter(user=user).values_list("token", flat=True))
    tickets["data"] = [tickets["data"][0] if t.endswith("[good]") else tickets["data"][1] for t in tokens]

    with mock.patch("urllib.request.urlopen", return_value=FakeResponse(tickets)):
        send_push_notification(user.id, "request_received", {})

    assert list(DeviceToken.objects.filter(user=user).values_list("token", flat=True)) == ["ExponentPushToken[good]"]
    assert "DeviceNotRegistered" in caplog.text


@pytest.mark.django_db
def test_credential_errors_keep_the_token(reference, settings, caplog):
    settings.EXPO_PUSH_ENABLED = True
    user = make_user("push2@example.com")
    DeviceToken.objects.create(user=user, token="ExponentPushToken[x]", platform="android")
    tickets = {"data": [{"status": "error", "message": "Unable to retrieve the FCM server key",
                         "details": {"error": "InvalidCredentials"}}]}

    with mock.patch("urllib.request.urlopen", return_value=FakeResponse(tickets)):
        send_push_notification(user.id, "request_received", {})

    assert DeviceToken.objects.filter(user=user).exists()
    assert "InvalidCredentials" in caplog.text
