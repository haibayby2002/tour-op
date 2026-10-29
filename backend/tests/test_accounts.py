import pytest

from apps.accounts.models import User, Verification

from .conftest import client_for

REGISTER = {
    "full_name": "Nguyen Van A",
    "birth_year": 1995,
    "email": "a@example.com",
    "phone": "0901234567",
    "password": "Str0ng-pass-123",
    "roles": ["TRAVELER"],
}


@pytest.mark.django_db
@pytest.mark.parametrize("missing", ["full_name", "birth_year", "email", "phone"])
def test_registration_requires_core_fields(missing):
    payload = {k: v for k, v in REGISTER.items() if k != missing}
    response = client_for().post("/api/v1/auth/register/", payload, format="json")
    assert response.status_code == 400
    assert missing in response.data
    assert not User.objects.exists()


@pytest.mark.django_db
def test_registration_normalizes_phone_and_creates_profile(reference):
    response = client_for().post("/api/v1/auth/register/", REGISTER, format="json")
    assert response.status_code == 201, response.data
    user = User.objects.get(email="a@example.com")
    assert user.phone == "+84901234567"
    assert user.profile is not None
    assert user.traveler_profile is not None
    assert "access" in response.data and "refresh" in response.data
    assert response.data["user"]["email_verified"] is False


@pytest.mark.django_db
def test_web_client_gets_refresh_cookie_not_body(reference):
    response = client_for().post("/api/v1/auth/register/", REGISTER, format="json", HTTP_X_CLIENT="web")
    assert response.status_code == 201
    assert "refresh" not in response.data
    cookie = response.cookies["tourop_refresh"]
    assert cookie["httponly"]


@pytest.mark.django_db
def test_underage_registration_rejected():
    from django.utils import timezone

    payload = {**REGISTER, "birth_year": timezone.now().year - 15}
    response = client_for().post("/api/v1/auth/register/", payload, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_contact_details_not_allowed_in_name():
    payload = {**REGISTER, "full_name": "Linh 0901234567"}
    response = client_for().post("/api/v1/auth/register/", payload, format="json")
    assert response.status_code == 400
    assert "full_name" in response.data


@pytest.mark.django_db
def test_verification_flow(reference):
    response = client_for().post("/api/v1/auth/register/", REGISTER, format="json")
    codes = response.data["debug_verification_codes"]
    user = User.objects.get(email="a@example.com")
    client = client_for(user)

    bad = client.post("/api/v1/auth/verify/confirm/", {"kind": "EMAIL", "code": "000000"}, format="json")
    if codes["EMAIL"] != "000000":
        assert bad.status_code == 400

    ok = client.post("/api/v1/auth/verify/confirm/", {"kind": "EMAIL", "code": codes["EMAIL"]}, format="json")
    assert ok.status_code == 200
    assert ok.data["email_verified"] is True

    client.post("/api/v1/auth/verify/confirm/", {"kind": "PHONE", "code": codes["PHONE"]}, format="json")
    user.refresh_from_db()
    assert user.contacts_verified


@pytest.mark.django_db
def test_changing_phone_invalidates_phone_verification(traveler):
    assert traveler.is_verified(Verification.Kind.PHONE)
    response = client_for(traveler).patch("/api/v1/auth/me/", {"phone": "0911111111"}, format="json")
    assert response.status_code == 200
    assert response.data["phone_verified"] is False


@pytest.mark.django_db
def test_login_and_refresh(traveler):
    client = client_for()
    response = client.post("/api/v1/auth/login/", {"email": traveler.email, "password": "Str0ng-pass-123"}, format="json")
    assert response.status_code == 200
    refreshed = client.post("/api/v1/auth/refresh/", {"refresh": response.data["refresh"]}, format="json")
    assert refreshed.status_code == 200
    # rotated tokens are blacklisted
    reused = client.post("/api/v1/auth/refresh/", {"refresh": response.data["refresh"]}, format="json")
    assert reused.status_code == 401
