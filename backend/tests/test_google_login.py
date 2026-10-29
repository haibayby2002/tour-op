import pytest
from django.core.cache import cache

from apps.accounts.models import User, Verification

from .conftest import client_for, make_user

CLIENT_ID = "web-client.apps.googleusercontent.com"


@pytest.fixture(autouse=True)
def _reset_auth_throttle():
    cache.clear()  # the auth endpoints' rate limit is shared with earlier tests


@pytest.fixture
def google(settings, monkeypatch):
    """Replace Google's signature check; `claims` controls what the token says."""
    settings.GOOGLE_CLIENT_IDS = [CLIENT_ID]
    claims = {
        "iss": "https://accounts.google.com",
        "aud": CLIENT_ID,
        "sub": "1234567890",
        "email": "New.Person@gmail.com",
        "email_verified": True,
        "name": "New Person",
    }

    def verify(token, request, audience=None, **kwargs):
        if token != "valid-token":
            raise ValueError("bad signature")
        return claims

    monkeypatch.setattr("apps.accounts.google.id_token.verify_oauth2_token", verify)
    return claims


def post(data, client="mobile"):
    return client_for().post("/api/v1/auth/google/", data, format="json", HTTP_X_CLIENT=client)


def test_existing_account_is_logged_in_and_email_verified(reference, google):
    user = make_user("new.person@gmail.com", verified=False)
    response = post({"id_token": "valid-token"})
    assert response.status_code == 200, response.data
    assert response.data["user"]["id"] == user.id
    assert response.data["access"] and response.data["refresh"]
    assert user.is_verified(Verification.Kind.EMAIL)
    assert not user.is_verified(Verification.Kind.PHONE)


def test_web_client_gets_refresh_cookie_not_body(reference, google):
    make_user("new.person@gmail.com")
    response = post({"id_token": "valid-token"}, client="web")
    assert "refresh" not in response.data
    assert response.cookies["tourop_refresh"].value


def test_new_person_is_asked_for_required_details_then_registered(reference, google):
    first = post({"id_token": "valid-token"})
    assert first.status_code == 200
    assert first.data == {
        "signup_required": True,
        "email": "new.person@gmail.com",
        "full_name": "New Person",
        "missing": ["birth_year", "phone"],
    }
    assert not User.objects.filter(email="new.person@gmail.com").exists()

    response = post({"id_token": "valid-token", "birth_year": 1995, "phone": "0901234567", "roles": ["LOCAL"]})
    assert response.status_code == 201, response.data
    user = User.objects.get(email="new.person@gmail.com")
    assert user.full_name == "New Person"
    assert user.role_list == ["LOCAL"]
    assert not user.has_usable_password()
    assert user.is_verified(Verification.Kind.EMAIL)
    assert not user.is_verified(Verification.Kind.PHONE)  # phone still needs its SMS code
    assert response.data["debug_verification_codes"]["PHONE"]


def test_signup_keeps_age_and_phone_rules(reference, google):
    too_young = post({"id_token": "valid-token", "birth_year": 2020, "phone": "0901234567"})
    assert too_young.status_code == 400
    make_user("someone@example.com", phone="+84901234567")
    taken = post({"id_token": "valid-token", "birth_year": 1990, "phone": "0901234567"})
    assert taken.status_code == 400 and "phone" in taken.data


@pytest.mark.parametrize(
    "change",
    [{"aud": "someone-elses-app"}, {"email_verified": False}, {"iss": "evil.example.com"}],
)
def test_untrusted_tokens_are_rejected(reference, google, change):
    google.update(change)
    response = post({"id_token": "valid-token"})
    assert response.status_code == 401


def test_bad_signature_and_banned_accounts(reference, google):
    assert post({"id_token": "forged"}).status_code == 401
    make_user("new.person@gmail.com", status=User.Status.BANNED)
    assert post({"id_token": "valid-token"}).status_code == 403


def test_not_configured(reference, settings):
    settings.GOOGLE_CLIENT_IDS = []
    assert post({"id_token": "anything"}).status_code == 503
