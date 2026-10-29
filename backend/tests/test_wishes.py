from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.models import UserRole
from apps.bookings.models import Booking
from apps.experiences.models import LocalService, ServiceCategory
from apps.notifications.models import Notification
from apps.profiles.models import City, Language, LocalProfile, UserLanguage
from apps.wishes.models import TripWish, WishCandidate

from .conftest import client_for, future, make_user


def make_local(email, city, *, price=300000, languages=("en",), verified=True, checked=False, accepting=True):
    user = make_user(email, roles=(UserRole.Role.LOCAL,), verified=verified)
    LocalProfile.objects.filter(user=user).update(
        price_min=price,
        is_accepting_requests=accepting,
        review_status=LocalProfile.ReviewStatus.MANUALLY_CHECKED if checked else LocalProfile.ReviewStatus.NOT_SUBMITTED,
    )
    user.profile.city = city
    user.profile.save()
    for code in languages:
        UserLanguage.objects.create(user=user, language=Language.objects.get(code=code))
    return user


def wish_payload(**overrides):
    start = future(5)
    payload = {
        "title": "Street food night",
        "description": "We'd love to try local street food and hear some history.",
        "city": "hanoi",
        "start_at": start.isoformat(),
        "end_at": (start + timedelta(hours=3)).isoformat(),
        "group_size": 2,
        "budget_max": 800000,
        "interests": ["street-food"],
        "avoid_notes": "No shopping",
    }
    payload.update(overrides)
    return payload


@pytest.fixture(autouse=True)
def run_on_commit(monkeypatch):
    """Tests run inside one transaction; execute on_commit hooks (matching) right away."""
    from django.db import transaction

    monkeypatch.setattr(transaction, "on_commit", lambda fn, using=None, robust=False: fn())


@pytest.fixture
def hcmc(reference):
    return City.objects.create(slug="ho-chi-minh-city", name="Ho Chi Minh City")


@pytest.mark.django_db
def test_only_qualified_locals_in_the_region_are_notified(traveler, reference, hcmc):
    hanoi = reference["city"]
    good = make_local("good@example.com", hanoi, checked=True)
    other_city = make_local("hcmc@example.com", hcmc)
    unverified = make_local("unverified@example.com", hanoi, verified=False)
    paused = make_local("paused@example.com", hanoi, accepting=False)
    too_pricey = make_local("pricey@example.com", hanoi, price=2_000_000)
    no_english = make_local("vi-only@example.com", hanoi, languages=("vi",))
    not_checked = make_local("unchecked@example.com", hanoi)

    response = client_for(traveler).post(
        "/api/v1/trip-wishes/", wish_payload(language="en", require_manually_checked=True), format="json"
    )
    assert response.status_code == 201, response.data
    wish = TripWish.objects.get(pk=response.data["id"])
    matched = set(WishCandidate.objects.filter(wish=wish).values_list("local_id", flat=True))
    assert matched == {good.id}
    notified = set(Notification.objects.filter(kind="wish_match").values_list("user_id", flat=True))
    assert notified == {good.id}
    for user in (other_city, unverified, paused, too_pricey, no_english, not_checked):
        assert user.id not in notified


@pytest.mark.django_db
def test_without_requirements_all_eligible_locals_in_city_match(traveler, reference):
    a = make_local("a@example.com", reference["city"])
    b = make_local("b@example.com", reference["city"], languages=("vi",))
    response = client_for(traveler).post("/api/v1/trip-wishes/", wish_payload(), format="json")
    assert set(WishCandidate.objects.filter(wish_id=response.data["id"]).values_list("local_id", flat=True)) == {a.id, b.id}
    assert response.data["candidate_count"] == 2


@pytest.mark.django_db
def test_category_and_min_rating_requirements(traveler, reference):
    category = ServiceCategory.objects.get(slug="food")
    with_service = make_local("svc@example.com", reference["city"])
    LocalService.objects.create(local=with_service, category=category, city=reference["city"], title="Food",
                                description="x", duration_minutes=120, price=400000)
    make_local("nosvc@example.com", reference["city"])

    r = client_for(traveler).post("/api/v1/trip-wishes/", wish_payload(category="food"), format="json")
    assert list(WishCandidate.objects.filter(wish_id=r.data["id"]).values_list("local_id", flat=True)) == [with_service.id]

    # nobody has reviews yet, so a minimum rating excludes everyone
    r2 = client_for(traveler).post("/api/v1/trip-wishes/", wish_payload(min_rating="4.5"), format="json")
    assert WishCandidate.objects.filter(wish_id=r2.data["id"]).count() == 0


@pytest.mark.django_db
def test_wish_is_private_to_owner_and_matched_locals(traveler, reference, hcmc):
    matched = make_local("m@example.com", reference["city"])
    outsider_local = make_local("o@example.com", hcmc)
    wish_id = client_for(traveler).post("/api/v1/trip-wishes/", wish_payload(), format="json").data["id"]

    detail = client_for(matched).get(f"/api/v1/trip-wishes/{wish_id}/")
    assert detail.status_code == 200
    assert detail.data["my_role"] == "LOCAL"
    assert detail.data["traveler_profile"]["traveler"] is not None  # matched locals see preferences
    assert traveler.email not in str(detail.data) and traveler.phone not in str(detail.data)
    assert "offers" not in detail.data  # locals never see competing offers

    assert client_for(outsider_local).get(f"/api/v1/trip-wishes/{wish_id}/").status_code == 404
    assert client_for(outsider_local).post(f"/api/v1/trip-wishes/{wish_id}/offer/", {"message": "hi"}, format="json").status_code == 404
    feed = client_for(matched).get("/api/v1/trip-wishes/?box=for_me").data
    assert [w["id"] for w in feed] == [wish_id]


@pytest.mark.django_db
def test_offer_accept_flow_creates_discussion_booking(traveler, reference):
    l1 = make_local("l1@example.com", reference["city"])
    l2 = make_local("l2@example.com", reference["city"])
    wish_id = client_for(traveler).post("/api/v1/trip-wishes/", wish_payload(), format="json").data["id"]

    o1 = client_for(l1).post(f"/api/v1/trip-wishes/{wish_id}/offer/", {"message": "I know the best stalls!", "proposed_price": 600000}, format="json")
    assert o1.status_code == 201, o1.data
    o2 = client_for(l2).post(f"/api/v1/trip-wishes/{wish_id}/offer/", {"message": "History + food walk"}, format="json")
    assert Notification.objects.filter(user=traveler, kind="wish_offer_received").count() == 2
    # duplicate offer refused
    assert client_for(l1).post(f"/api/v1/trip-wishes/{wish_id}/offer/", {"message": "again"}, format="json").status_code == 409

    detail = client_for(traveler).get(f"/api/v1/trip-wishes/{wish_id}/").data
    assert len(detail["offers"]) == 2 and "trust" in detail["offers"][0]

    accepted = client_for(traveler).post(f"/api/v1/wish-offers/{o1.data['id']}/accept/")
    assert accepted.status_code == 201, accepted.data
    booking = Booking.objects.get(pk=accepted.data["id"])
    assert booking.status == "DISCUSSING"  # still needs a written agreement
    assert booking.local_id == l1.id and booking.tour_request.wish_id == wish_id
    assert booking.conversation is not None

    wish = TripWish.objects.get(pk=wish_id)
    assert wish.status == "MATCHED" and wish.matched_local_id == l1.id
    assert Notification.objects.filter(user=l1, kind="wish_offer_accepted").exists()
    assert Notification.objects.filter(user=l2, kind="wish_filled").exists()
    # no more offers once matched
    assert client_for(l2).post(f"/api/v1/wish-offers/{o2.data['id']}/withdraw/").status_code == 409


@pytest.mark.django_db
def test_offer_message_cannot_contain_contacts(traveler, reference):
    local = make_local("l@example.com", reference["city"])
    wish_id = client_for(traveler).post("/api/v1/trip-wishes/", wish_payload(), format="json").data["id"]
    r = client_for(local).post(f"/api/v1/trip-wishes/{wish_id}/offer/", {"message": "zalo me 0901234567"}, format="json")
    assert r.status_code == 400 and r.data["code"] == "contact_info_not_allowed"


@pytest.mark.django_db
def test_wish_rules(traveler, reference):
    unverified = make_user("u@example.com", verified=False)
    assert client_for(unverified).post("/api/v1/trip-wishes/", wish_payload(), format="json").status_code == 403
    assert client_for(traveler).post("/api/v1/trip-wishes/", wish_payload(group_size=9), format="json").status_code == 400
    for _ in range(3):
        assert client_for(traveler).post("/api/v1/trip-wishes/", wish_payload(), format="json").status_code == 201
    r = client_for(traveler).post("/api/v1/trip-wishes/", wish_payload(), format="json")
    assert r.status_code == 400 and r.data["code"] == "too_many_wishes"


@pytest.mark.django_db
def test_close_and_expire(traveler, reference):
    from apps.wishes.services import expire_wishes

    local = make_local("l@example.com", reference["city"])
    c = client_for(traveler)
    w1 = c.post("/api/v1/trip-wishes/", wish_payload(), format="json").data["id"]
    client_for(local).post(f"/api/v1/trip-wishes/{w1}/offer/", {"message": "Happy to help"}, format="json")
    assert c.post(f"/api/v1/trip-wishes/{w1}/close/").data["status"] == "CLOSED"
    assert Notification.objects.filter(user=local, kind="wish_closed").exists()

    w2 = c.post("/api/v1/trip-wishes/", wish_payload(), format="json").data["id"]
    TripWish.objects.filter(pk=w2).update(start_at=timezone.now() - timedelta(minutes=1))
    assert expire_wishes() == 1
    assert TripWish.objects.get(pk=w2).status == "EXPIRED"
