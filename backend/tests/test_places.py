import pytest

from apps.profiles.models import City, Place

from .conftest import agreement_payload, client_for, request_payload
from .test_booking_flow import _accept_request


@pytest.fixture
def places(reference):
    hanoi = City.objects.get(slug="hanoi")
    saigon = City.objects.create(slug="ho-chi-minh-city", name="Ho Chi Minh City")
    return {
        "temple": Place.objects.create(slug="temple-of-literature", city=hanoi, name="Temple of Literature",
                                       name_vi="Văn Miếu – Quốc Tử Giám"),
        "market": Place.objects.create(slug="dong-xuan-market", city=hanoi, name="Dong Xuan Market",
                                       name_vi="Chợ Đồng Xuân"),
        "hidden": Place.objects.create(slug="closed-place", city=hanoi, name="Closed place", is_active=False),
        "saigon": Place.objects.create(slug="ben-thanh-market", city=saigon, name="Ben Thanh Market"),
    }


@pytest.mark.django_db
def test_places_list_filters_by_city_and_search(places):
    api = client_for()
    hanoi = api.get("/api/v1/places/?city=hanoi")
    assert hanoi.status_code == 200
    assert {p["slug"] for p in hanoi.data} == {"temple-of-literature", "dong-xuan-market"}
    found = api.get("/api/v1/places/?city=hanoi&q=đồng xuân")
    assert [p["slug"] for p in found.data] == ["dong-xuan-market"]


@pytest.mark.django_db
def test_stop_links_to_matching_place_and_free_text_still_works(traveler, local, places):
    booking = _accept_request(traveler, local)
    payload = agreement_payload()
    payload["stops"][0]["place_name"] = "chợ đồng xuân"  # Vietnamese name, different case
    payload["stops"][1]["place_name"] = "Ben Thanh Market"  # a place, but in another city
    response = client_for(local).post(f"/api/v1/bookings/{booking['id']}/agreements/", payload, format="json")
    assert response.status_code == 201, response.data
    stops = response.data["stops"]
    assert stops[0]["place"]["slug"] == "dong-xuan-market"
    assert stops[0]["place_name"] == "chợ đồng xuân"
    assert stops[1]["place"] is None
    assert stops[2]["place"]["slug"] == "temple-of-literature"
