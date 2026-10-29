import json

import pytest

from apps.accounts.models import UserRole

from .conftest import client_for, make_user


@pytest.mark.django_db
def test_public_profile_never_exposes_contact_details(local, traveler):
    for viewer in (None, traveler):
        response = client_for(viewer).get(f"/api/v1/users/{local.id}/?role=LOCAL")
        assert response.status_code == 200
        body = json.dumps(response.data, default=str)
        assert local.email not in body
        assert local.phone not in body
        assert local.full_name != response.data["name"] or "email" not in response.data
        assert "phone" not in response.data and "email" not in response.data


@pytest.mark.django_db
def test_search_results_do_not_expose_contacts(local, traveler):
    response = client_for(traveler).get("/api/v1/locals/?city=hanoi")
    assert response.status_code == 200
    assert response.data["count"] == 1
    body = json.dumps(response.data, default=str)
    assert local.email not in body and local.phone not in body


@pytest.mark.django_db
def test_completion_updates_when_profile_changes(traveler):
    client = client_for(traveler)
    before = client.get("/api/v1/profile/me/").data["completion"]["traveler"]["percent"]
    response = client.patch(
        "/api/v1/profile/me/",
        {
            "bio": "I love slow travel, street food and learning the history of each place.",
            "languages": [{"code": "en", "proficiency": "NATIVE"}],
            "interests": ["street-food", "history"],
            "traveler": {"travel_style": "FOODIE", "wishes": "Eat like a local"},
        },
        format="json",
    )
    assert response.status_code == 200, response.data
    after = response.data["completion"]["traveler"]["percent"]
    assert after > before
    traveler.profile.refresh_from_db()
    assert traveler.profile.traveler_completion == after


@pytest.mark.django_db
def test_bio_with_phone_is_rejected(traveler):
    response = client_for(traveler).patch("/api/v1/profile/me/", {"bio": "text me 0901234567"}, format="json")
    assert response.status_code == 400
    assert "bio" in response.data


@pytest.mark.django_db
def test_trust_signals_are_separate_and_honest(local, reference):
    response = client_for().get(f"/api/v1/users/{local.id}/?role=LOCAL")
    trust = response.data["trust"]
    assert trust["email_verified"] and trust["phone_verified"]
    # email/phone verification must never be presented as identity verification
    assert trust["identity_verified"] is False
    assert trust["review_count"] == 0 and trust["is_new_member"] is True


@pytest.mark.django_db
def test_request_only_traveler_details_hidden_from_strangers(traveler, local, outsider):
    traveler.traveler_profile.wishes = "Quiet places"
    traveler.traveler_profile.save()
    response = client_for(outsider).get(f"/api/v1/users/{traveler.id}/?role=TRAVELER")
    assert response.status_code == 200
    assert response.data["traveler"] is None


@pytest.mark.django_db
def test_unverified_locals_cannot_receive_requests(traveler, reference):
    from apps.profiles.models import LocalProfile

    unverified = make_user("new-local@example.com", roles=(UserRole.Role.LOCAL,), verified=False)
    LocalProfile.objects.filter(user=unverified).update(price_min=100000)
    from .conftest import request_payload

    response = client_for(traveler).post("/api/v1/tour-requests/", request_payload(unverified), format="json")
    assert response.status_code == 400
    assert response.data["code"] == "local_unverified"


@pytest.mark.django_db
def test_local_with_only_verified_email_can_receive_requests(traveler, reference):
    from django.utils import timezone

    from apps.accounts.models import Verification
    from apps.profiles.models import LocalProfile

    from .conftest import request_payload

    local = make_user("email-only-local@example.com", roles=(UserRole.Role.LOCAL,), verified=False)
    Verification.objects.create(user=local, kind=Verification.Kind.EMAIL, target=local.email,
                                status=Verification.Status.VERIFIED, verified_at=timezone.now())
    LocalProfile.objects.filter(user=local).update(price_min=100000)

    response = client_for(traveler).post("/api/v1/tour-requests/", request_payload(local), format="json")
    assert response.status_code == 201, response.data
