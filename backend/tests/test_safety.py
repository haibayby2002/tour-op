from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from apps.bookings.models import Booking
from apps.safety.models import Report

from .conftest import agreement_payload, client_for, request_payload


def _confirmed_booking(traveler, local):
    req = client_for(traveler).post("/api/v1/tour-requests/", request_payload(local), format="json").data
    booking = client_for(local).post(f"/api/v1/tour-requests/{req['id']}/accept/").data
    v1 = client_for(local).post(f"/api/v1/bookings/{booking['id']}/agreements/", agreement_payload(), format="json").data
    client_for(traveler).post(f"/api/v1/agreements/{v1['id']}/accept/", {"acknowledge_costs": True}, format="json")
    return Booking.objects.get(pk=booking["id"])


@pytest.mark.django_db
def test_report_is_private_and_not_deletable(traveler, local):
    booking = _confirmed_booking(traveler, local)
    response = client_for(traveler).post(
        "/api/v1/reports/",
        {"category": "OVERCHARGING", "description": "Asked for extra money", "booking": booking.id},
        format="json",
    )
    assert response.status_code == 201, response.data
    report_id = response.data["id"]
    # the reported local can't see it
    assert client_for(local).get(f"/api/v1/reports/{report_id}/").status_code == 404
    assert client_for(local).get("/api/v1/reports/").data == []
    # nobody can delete via the API
    assert client_for(traveler).delete(f"/api/v1/reports/{report_id}/").status_code == 405
    # it does not appear in public reviews
    assert client_for().get(f"/api/v1/users/{local.id}/reviews/?role=LOCAL").data["count"] == 0


@pytest.mark.django_db
def test_safety_report_is_critical_and_can_open_dispute(traveler, local):
    booking = _confirmed_booking(traveler, local)
    Booking.objects.filter(pk=booking.pk).update(start_at=timezone.now() - timedelta(minutes=10))
    response = client_for(traveler).post(
        "/api/v1/reports/",
        {"category": "SAFETY", "description": "Felt unsafe", "booking": booking.id, "open_dispute": True},
        format="json",
    )
    assert response.status_code == 201
    assert Report.objects.get(pk=response.data["id"]).severity == "CRITICAL"
    booking.refresh_from_db()
    assert booking.status == "DISPUTED"


@pytest.mark.django_db
def test_outsider_cannot_report_on_foreign_booking(traveler, local, outsider):
    booking = _confirmed_booking(traveler, local)
    response = client_for(outsider).post(
        "/api/v1/reports/", {"category": "OTHER", "description": "x", "booking": booking.id}, format="json"
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_evidence_upload(traveler, local):
    booking = _confirmed_booking(traveler, local)
    report = client_for(traveler).post(
        "/api/v1/reports/", {"category": "OTHER", "description": "see photo", "booking": booking.id}, format="json"
    ).data
    gif = SimpleUploadedFile("e.gif", b"GIF89a\x01\x00\x01\x00\x00\x00\x00;", content_type="image/gif")
    response = client_for(traveler).post(f"/api/v1/reports/{report['id']}/evidence/", {"file": gif}, format="multipart")
    assert response.status_code == 201
    assert len(response.data["evidence"]) == 1


@pytest.mark.django_db
def test_trip_share_link_has_no_contact_or_price(traveler, local):
    booking = _confirmed_booking(traveler, local)
    share = client_for(traveler).post(f"/api/v1/bookings/{booking.id}/shares/", {}, format="json")
    assert share.status_code == 201
    public = client_for().get(f"/api/v1/share/{share.data['token']}/")
    assert public.status_code == 200
    body = str(public.data)
    assert local.phone not in body and local.email not in body and traveler.email not in body
    assert "agreed_price" not in public.data
    # shopping stop is still listed unless declined; itinerary present
    assert public.data["itinerary"]
    # local cannot create a share for the traveler
    assert client_for(local).post(f"/api/v1/bookings/{booking.id}/shares/", {}, format="json").status_code == 403
    # revoke
    client_for(traveler).delete(f"/api/v1/shares/{share.data['id']}/")
    assert client_for().get(f"/api/v1/share/{share.data['token']}/").status_code == 410
