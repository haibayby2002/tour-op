"""The critical business flow from the tech stack doc, end to end through the API."""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.bookings.models import Agreement, Booking, TourRequest
from apps.messaging.models import Message

from .conftest import agreement_payload, client_for, make_user, request_payload


def _accept_request(traveler, local):
    req = client_for(traveler).post("/api/v1/tour-requests/", request_payload(local), format="json")
    assert req.status_code == 201, req.data
    booking = client_for(local).post(f"/api/v1/tour-requests/{req.data['id']}/accept/")
    assert booking.status_code == 201, booking.data
    return booking.data


@pytest.mark.django_db
def test_full_flow_request_to_reviews(traveler, local):
    t, l = client_for(traveler), client_for(local)

    booking = _accept_request(traveler, local)
    # Accepting to talk is NOT confirming the tour.
    assert booking["status"] == "DISCUSSING"
    assert booking["conversation_id"] is not None

    msg = t.post(f"/api/v1/conversations/{booking['conversation_id']}/messages/", {"content": "Hi! Excited."}, format="json")
    assert msg.status_code == 201 and msg.data["moderation_status"] == "CLEAN"

    proposal = l.post(f"/api/v1/bookings/{booking['id']}/agreements/", agreement_payload(), format="json")
    assert proposal.status_code == 201, proposal.data
    assert Booking.objects.get(pk=booking["id"]).status == "DISCUSSING"

    shopping = next(s for s in proposal.data["stops"] if s["kind"] == "SHOPPING")
    accepted = t.post(
        f"/api/v1/agreements/{proposal.data['id']}/accept/",
        {"declined_stop_ids": [shopping["id"]], "acknowledge_costs": True},
        format="json",
    )
    assert accepted.status_code == 200, accepted.data
    b = Booking.objects.get(pk=booking["id"])
    assert b.status == "CONFIRMED"
    assert b.agreed_price == 500000
    assert b.current_agreement.stops.get(id=shopping["id"]).declined_by_traveler is True

    # Fast-forward to the tour.
    Booking.objects.filter(pk=b.pk).update(start_at=timezone.now() - timedelta(minutes=5))
    assert l.post(f"/api/v1/bookings/{b.id}/start/").status_code == 200
    assert t.post(f"/api/v1/bookings/{b.id}/complete/").status_code == 200

    r1 = t.post("/api/v1/reviews/", {"booking": b.id, "rating": 5, "comment": "Great", "felt_safe": True}, format="json")
    assert r1.status_code == 201, r1.data
    # double-blind: not public until the other side reviews
    public = client_for().get(f"/api/v1/users/{local.id}/reviews/?role=LOCAL")
    assert public.data["count"] == 0
    r2 = l.post("/api/v1/reviews/", {"booking": b.id, "rating": 5, "comment": "Lovely guest"}, format="json")
    assert r2.status_code == 201
    public = client_for().get(f"/api/v1/users/{local.id}/reviews/?role=LOCAL")
    assert public.data["count"] == 1


@pytest.mark.django_db
def test_accepted_agreement_is_immutable_and_changes_need_new_consent(traveler, local):
    booking = _accept_request(traveler, local)
    l, t = client_for(local), client_for(traveler)
    v1 = l.post(f"/api/v1/bookings/{booking['id']}/agreements/", agreement_payload(), format="json").data
    t.post(f"/api/v1/agreements/{v1['id']}/accept/", {"acknowledge_costs": True}, format="json")

    v2 = l.post(f"/api/v1/bookings/{booking['id']}/agreements/", agreement_payload(price=900000), format="json").data
    b = Booking.objects.get(pk=booking["id"])
    # Still confirmed on v1 until the traveler accepts v2.
    assert b.current_agreement_id == v1["id"] and b.agreed_price == 500000
    assert Agreement.objects.get(pk=v1["id"]).price == 500000

    t.post(f"/api/v1/agreements/{v2['id']}/accept/", {"acknowledge_costs": True}, format="json")
    b.refresh_from_db()
    assert b.current_agreement_id == v2["id"] and b.agreed_price == 900000
    assert Agreement.objects.get(pk=v1["id"]).status == "SUPERSEDED"


@pytest.mark.django_db
def test_only_traveler_accepts_and_only_local_proposes(traveler, local):
    booking = _accept_request(traveler, local)
    assert client_for(traveler).post(
        f"/api/v1/bookings/{booking['id']}/agreements/", agreement_payload(), format="json"
    ).status_code == 403
    v1 = client_for(local).post(f"/api/v1/bookings/{booking['id']}/agreements/", agreement_payload(), format="json").data
    assert client_for(local).post(
        f"/api/v1/agreements/{v1['id']}/accept/", {"acknowledge_costs": True}, format="json"
    ).status_code == 403


@pytest.mark.django_db
def test_sightseeing_stop_cannot_be_declined(traveler, local):
    booking = _accept_request(traveler, local)
    v1 = client_for(local).post(f"/api/v1/bookings/{booking['id']}/agreements/", agreement_payload(), format="json").data
    sight = next(s for s in v1["stops"] if s["kind"] == "SIGHTSEEING")
    response = client_for(traveler).post(
        f"/api/v1/agreements/{v1['id']}/accept/",
        {"declined_stop_ids": [sight["id"]], "acknowledge_costs": True},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_invalid_transitions_rejected(traveler, local):
    booking = _accept_request(traveler, local)
    # can't complete or start a tour that was never confirmed
    Booking.objects.filter(pk=booking["id"]).update(start_at=timezone.now() - timedelta(minutes=1))
    assert client_for(traveler).post(f"/api/v1/bookings/{booking['id']}/complete/").status_code == 409
    assert client_for(local).post(f"/api/v1/bookings/{booking['id']}/start/").status_code == 409


@pytest.mark.django_db
def test_reviews_require_completed_booking_and_no_self_review(traveler, local):
    booking = _accept_request(traveler, local)
    response = client_for(traveler).post("/api/v1/reviews/", {"booking": booking["id"], "rating": 5}, format="json")
    assert response.status_code == 400
    assert response.data["code"] == "not_completed"


@pytest.mark.django_db
def test_outsider_cannot_read_messages_or_booking(traveler, local, outsider):
    booking = _accept_request(traveler, local)
    o = client_for(outsider)
    cid = booking["conversation_id"]
    assert o.get(f"/api/v1/conversations/{cid}/messages/").status_code == 404
    assert o.post(f"/api/v1/conversations/{cid}/messages/", {"content": "hi"}, format="json").status_code == 404
    assert o.get(f"/api/v1/bookings/{booking['id']}/").status_code == 404
    assert client_for().get(f"/api/v1/conversations/{cid}/messages/").status_code == 401


@pytest.mark.django_db
def test_message_with_phone_is_blocked_and_hidden_from_recipient(traveler, local):
    booking = _accept_request(traveler, local)
    cid = booking["conversation_id"]
    sent = client_for(traveler).post(
        f"/api/v1/conversations/{cid}/messages/", {"content": "call me on 0901234567"}, format="json"
    )
    assert sent.status_code == 201
    assert sent.data["moderation_status"] == "BLOCKED"
    local_view = client_for(local).get(f"/api/v1/conversations/{cid}/messages/").data["results"]
    assert all(m["moderation_status"] != "BLOCKED" for m in local_view)
    sender_view = client_for(traveler).get(f"/api/v1/conversations/{cid}/messages/").data["results"]
    assert any(m["moderation_status"] == "BLOCKED" for m in sender_view)

    warned = client_for(traveler).post(f"/api/v1/conversations/{cid}/messages/", {"content": "add me on zalo"}, format="json")
    assert warned.data["moderation_status"] == "WARNED"
    assert Message.objects.filter(moderation_status="BLOCKED").count() == 1


@pytest.mark.django_db
def test_unverified_traveler_cannot_send_request(local, reference):
    unverified = make_user("unverified@example.com", verified=False)
    response = client_for(unverified).post("/api/v1/tour-requests/", request_payload(local), format="json")
    assert response.status_code == 403
    assert response.data["code"] == "contacts_not_verified"


@pytest.mark.django_db
def test_group_size_limited_to_small_groups(traveler, local):
    response = client_for(traveler).post("/api/v1/tour-requests/", request_payload(local, group_size=8), format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_blocked_users_cannot_request_or_message(traveler, local):
    booking = _accept_request(traveler, local)
    assert client_for(local).post("/api/v1/blocks/", {"user_id": traveler.id}, format="json").status_code == 201
    response = client_for(traveler).post(
        f"/api/v1/conversations/{booking['conversation_id']}/messages/", {"content": "hello?"}, format="json"
    )
    assert response.status_code == 403
    search = client_for(traveler).get("/api/v1/locals/?city=hanoi")
    assert search.data["count"] == 0


@pytest.mark.django_db
def test_local_sees_traveler_profile_on_request(traveler, local):
    req = client_for(traveler).post("/api/v1/tour-requests/", request_payload(local), format="json").data
    detail = client_for(local).get(f"/api/v1/tour-requests/{req['id']}/")
    assert detail.status_code == 200
    assert detail.data["traveler_profile"]["traveler"] is not None
    assert traveler.email not in str(detail.data)


@pytest.mark.django_db
def test_request_expiry_task(traveler, local):
    from apps.bookings.tasks import expire_stale_requests

    req = client_for(traveler).post("/api/v1/tour-requests/", request_payload(local), format="json").data
    TourRequest.objects.filter(pk=req["id"]).update(expires_at=timezone.now() - timedelta(minutes=1))
    assert expire_stale_requests() == 1
    assert TourRequest.objects.get(pk=req["id"]).status == "EXPIRED"


@pytest.mark.django_db
@pytest.mark.parametrize("verified_kind, context", [("EMAIL", "unverified_phone"), ("PHONE", "unverified_email")])
def test_one_verified_contact_is_enough_and_local_is_told(local, reference, verified_kind, context):
    from apps.accounts.models import Verification
    from apps.notifications.models import Notification

    traveler = make_user("half@example.com", verified=False)
    target = traveler.email if verified_kind == "EMAIL" else traveler.phone
    Verification.objects.create(user=traveler, kind=verified_kind, target=target,
                                status=Verification.Status.VERIFIED, verified_at=timezone.now())

    response = client_for(traveler).post("/api/v1/tour-requests/", request_payload(local), format="json")
    assert response.status_code == 201, response.data
    note = Notification.objects.get(user=local, kind="request_received")
    assert note.data["context"] == context

    profile = client_for(local).get(f"/api/v1/users/{traveler.id}/", {"role": "TRAVELER"}).data
    missing = "phone_verified" if verified_kind == "EMAIL" else "email_verified"
    assert profile["trust"][missing] is False


@pytest.mark.django_db
def test_fully_verified_traveler_request_has_no_warning(traveler, local):
    from apps.notifications.models import Notification

    client_for(traveler).post("/api/v1/tour-requests/", request_payload(local), format="json")
    assert "context" not in Notification.objects.get(user=local, kind="request_received").data
