"""Account deletion (Google Play): personal data is erased, history stays as "Deleted user"."""
import json

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.bookings.models import Booking

from .conftest import PASSWORD, client_for
from .test_booking_flow import _accept_request


def _login(user):
    client = APIClient()
    response = client.post("/api/v1/auth/login/", {"email": user.email, "password": PASSWORD}, format="json")
    assert response.status_code == 200, response.data
    return response.data["refresh"]


@pytest.mark.django_db
def test_delete_account_erases_personal_data_and_signs_out(traveler):
    email, phone = traveler.email, traveler.phone
    traveler.profile.bio = "I love noodles"
    traveler.profile.save()
    refresh = _login(traveler)

    response = client_for(traveler).delete("/api/v1/auth/me/", {"password": PASSWORD}, format="json")
    assert response.status_code == 204

    traveler.refresh_from_db()
    assert traveler.status == User.Status.DELETED and not traveler.is_active
    assert traveler.email != email and traveler.phone is None
    assert traveler.full_name == "Deleted user" and traveler.profile.bio == ""
    assert not traveler.verifications.exists()
    assert APIClient().post("/api/v1/auth/refresh/", {"refresh": refresh}, format="json").status_code == 401
    login = APIClient().post("/api/v1/auth/login/", {"email": email, "password": PASSWORD}, format="json")
    assert login.status_code == 401


@pytest.mark.django_db
def test_wrong_password_keeps_account(traveler):
    response = client_for(traveler).delete("/api/v1/auth/me/", {"password": "nope"}, format="json")
    assert response.status_code == 400
    assert response.data["code"] == "invalid_password"
    traveler.refresh_from_db()
    assert traveler.status == User.Status.ACTIVE


@pytest.mark.django_db
def test_open_booking_blocks_deletion_and_finished_one_keeps_history(traveler, local):
    booking = _accept_request(traveler, local)
    blocked = client_for(traveler).delete("/api/v1/auth/me/", {"password": PASSWORD}, format="json")
    assert blocked.status_code == 409
    assert blocked.data["code"] == "open_bookings"

    Booking.objects.filter(pk=booking["id"]).update(status=Booking.Status.COMPLETED)
    assert client_for(traveler).delete("/api/v1/auth/me/", {"password": PASSWORD}, format="json").status_code == 204
    seen_by_local = client_for(local).get(f"/api/v1/bookings/{booking['id']}/")
    assert seen_by_local.status_code == 200
    assert seen_by_local.data["traveler"]["name"] == "Deleted user"
    assert "traveler@example.com" not in json.dumps(seen_by_local.data, default=str)
