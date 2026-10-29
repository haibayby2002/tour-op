from pathlib import Path

import pytest
from django.core.management import CommandError, call_command

from apps.profiles.models import City, Interest, Language, Place

SEED = Path(__file__).resolve().parent.parent / "seed"
FILES = [str(SEED / name) for name in ("cities.csv", "languages.csv", "interests.csv", "places.csv")]


@pytest.mark.django_db
def test_seed_files_import_and_rerun_changes_nothing():
    call_command("import_reference", *FILES)
    city_slugs = {line.split(",")[0] for line in (SEED / "cities.csv").read_text(encoding="utf-8").splitlines()[1:] if line}
    assert set(City.objects.values_list("slug", flat=True)) == city_slugs
    assert City.objects.get(slug="hai-phong").name_vi == "Hải Phòng"
    assert Language.objects.count() == 10
    assert Interest.objects.count() == 18
    assert Interest.objects.get(slug="street-food").category == "food"
    place = Place.objects.get(slug="ben-thanh-market")
    assert (place.city.slug, place.category.slug) == ("ho-chi-minh-city", "markets")
    place_count = Place.objects.count()
    assert place_count > 0
    call_command("import_reference", *FILES)
    assert City.objects.count() == len(city_slugs)
    assert Language.objects.count() == 10
    assert Interest.objects.count() == 18
    assert Place.objects.count() == place_count


@pytest.mark.django_db
def test_dry_run_writes_nothing():
    call_command("import_reference", *FILES, "--dry-run")
    assert not City.objects.exists()
    assert not Language.objects.exists()
    assert not Interest.objects.exists()
    assert not Place.objects.exists()


@pytest.mark.django_db
def test_invalid_row_aborts_whole_import(tmp_path):
    bad = tmp_path / "cities.csv"
    bad.write_text(
        "slug,name,name_vi,country,latitude,longitude,is_active\n"
        "hanoi,Hanoi,Hà Nội,VN,21.0285,105.8542,1\n"
        "nowhere,Nowhere,,VN,123,0,1\n",
        encoding="utf-8",
    )
    with pytest.raises(CommandError, match="line 3: latitude"):
        call_command("import_reference", str(SEED / "languages.csv"), str(bad))
    assert not City.objects.exists()
    assert not Language.objects.exists()


@pytest.mark.django_db
def test_place_with_unknown_city_is_rejected(tmp_path):
    bad = tmp_path / "places.csv"
    bad.write_text(
        "slug,city,name,name_vi,category,latitude,longitude,address,description,is_active\n"
        "somewhere,atlantis,Somewhere,,,,,,,1\n",
        encoding="utf-8",
    )
    with pytest.raises(CommandError, match="line 2: unknown city 'atlantis'"):
        call_command("import_reference", str(bad))
