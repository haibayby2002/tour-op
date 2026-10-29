"""Import reference data (cities, languages, interests, places) from CSV files.

    python manage.py import_reference seed/cities.csv seed/languages.csv seed/interests.csv seed/places.csv --dry-run
    python manage.py import_reference seed/cities.csv seed/languages.csv seed/interests.csv seed/places.csv

The file kind is picked from its header, and files are imported in the order given
(so put places.csv after the cities and interests it refers to). Rows are upserted
by slug (cities, interests, places) or code (languages), nothing is ever deleted, and all files are imported in one
transaction: any invalid row aborts the whole import.
"""
import csv
from decimal import Decimal, InvalidOperation

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.profiles.models import City, Interest, Language, Place

CITY_COLUMNS = {"slug", "name", "name_vi", "country", "latitude", "longitude", "is_active"}
LANGUAGE_COLUMNS = {"code", "name", "name_vi"}
INTEREST_COLUMNS = {"slug", "name", "name_vi", "category"}
PLACE_COLUMNS = {
    "slug", "city", "name", "name_vi", "category", "latitude", "longitude", "address", "description", "is_active",
}


class DryRun(Exception):
    pass


def _coordinate(value, limit, line, column):
    if not value:
        return None
    try:
        number = Decimal(value)
    except InvalidOperation:
        raise CommandError(f"line {line}: {column} '{value}' is not a number")
    if abs(number) > limit:
        raise CommandError(f"line {line}: {column} {value} is out of range")
    return number


def _flag(value, line):
    if value.strip().lower() in {"1", "true", "yes"}:
        return True
    if value.strip().lower() in {"0", "false", "no"}:
        return False
    raise CommandError(f"line {line}: is_active must be 1 or 0, got '{value}'")


class Command(BaseCommand):
    help = "Upsert cities, languages, interests and places from CSV files (safe to re-run)"

    def add_arguments(self, parser):
        parser.add_argument("files", nargs="+")
        parser.add_argument("--dry-run", action="store_true", help="Show the changes without writing them")

    def handle(self, *args, files, dry_run, **options):
        try:
            with transaction.atomic():
                for path in files:
                    self._import(path)
                if dry_run:
                    raise DryRun
        except DryRun:
            self.stdout.write(self.style.WARNING("Dry run: nothing was written."))
            return
        self.stdout.write(self.style.SUCCESS("Reference data imported."))

    def _import(self, path):
        try:
            with open(path, encoding="utf-8-sig", newline="") as handle:
                rows = list(csv.DictReader(handle))
        except OSError as exc:
            raise CommandError(f"{path}: {exc}")
        columns = set(rows[0].keys()) if rows else set()
        if columns == CITY_COLUMNS:
            self._cities(path, rows)
        elif columns == LANGUAGE_COLUMNS:
            self._languages(path, rows)
        elif columns == INTEREST_COLUMNS:
            self._interests(path, rows)
        elif columns == PLACE_COLUMNS:
            self._places(path, rows)
        else:
            raise CommandError(f"{path}: unrecognised columns {sorted(columns)}")

    def _report(self, path, created, updated, unchanged):
        self.stdout.write(f"{path}: {created} created, {updated} updated, {unchanged} unchanged")

    def _upsert(self, model, key, value, fields):
        obj = model.objects.filter(**{key: value}).first()
        if obj is None:
            model.objects.create(**{key: value}, **fields)
            return "created"
        if all(getattr(obj, name) == new for name, new in fields.items()):
            return "unchanged"
        for name, new in fields.items():
            setattr(obj, name, new)
        obj.save()
        return "updated"

    def _cities(self, path, rows):
        counts = {"created": 0, "updated": 0, "unchanged": 0}
        seen = set()
        for line, row in enumerate(rows, start=2):
            slug = row["slug"].strip()
            if not slug or not row["name"].strip():
                raise CommandError(f"{path} line {line}: slug and name are required")
            if slug in seen:
                raise CommandError(f"{path} line {line}: duplicate slug '{slug}'")
            seen.add(slug)
            fields = {
                "name": row["name"].strip(),
                "name_vi": row["name_vi"].strip(),
                "country": row["country"].strip().upper() or "VN",
                "latitude": _coordinate(row["latitude"].strip(), 90, line, "latitude"),
                "longitude": _coordinate(row["longitude"].strip(), 180, line, "longitude"),
                "is_active": _flag(row["is_active"], line),
            }
            counts[self._upsert(City, "slug", slug, fields)] += 1
        self._report(path, **counts)

    def _languages(self, path, rows):
        counts = {"created": 0, "updated": 0, "unchanged": 0}
        seen = set()
        for line, row in enumerate(rows, start=2):
            code = row["code"].strip().lower()
            if not code or not row["name"].strip():
                raise CommandError(f"{path} line {line}: code and name are required")
            if code in seen:
                raise CommandError(f"{path} line {line}: duplicate code '{code}'")
            seen.add(code)
            fields = {"name": row["name"].strip(), "name_vi": row["name_vi"].strip()}
            counts[self._upsert(Language, "code", code, fields)] += 1
        self._report(path, **counts)

    def _interests(self, path, rows):
        counts = {"created": 0, "updated": 0, "unchanged": 0}
        seen = set()
        for line, row in enumerate(rows, start=2):
            slug = row["slug"].strip()
            if not slug or not row["name"].strip():
                raise CommandError(f"{path} line {line}: slug and name are required")
            if slug in seen:
                raise CommandError(f"{path} line {line}: duplicate slug '{slug}'")
            seen.add(slug)
            fields = {"name": row["name"].strip(), "name_vi": row["name_vi"].strip(), "category": row["category"].strip()}
            counts[self._upsert(Interest, "slug", slug, fields)] += 1
        self._report(path, **counts)

    def _places(self, path, rows):
        counts = {"created": 0, "updated": 0, "unchanged": 0}
        seen = set()
        cities = {city.slug: city for city in City.objects.all()}
        interests = {interest.slug: interest for interest in Interest.objects.all()}
        for line, row in enumerate(rows, start=2):
            slug = row["slug"].strip()
            if not slug or not row["name"].strip():
                raise CommandError(f"{path} line {line}: slug and name are required")
            if slug in seen:
                raise CommandError(f"{path} line {line}: duplicate slug '{slug}'")
            seen.add(slug)
            city = cities.get(row["city"].strip())
            if city is None:
                raise CommandError(f"{path} line {line}: unknown city '{row['city']}'")
            category = None
            if row["category"].strip():
                category = interests.get(row["category"].strip())
                if category is None:
                    raise CommandError(f"{path} line {line}: unknown category '{row['category']}'")
            fields = {
                "city": city,
                "name": row["name"].strip(),
                "name_vi": row["name_vi"].strip(),
                "category": category,
                "latitude": _coordinate(row["latitude"].strip(), 90, line, "latitude"),
                "longitude": _coordinate(row["longitude"].strip(), 180, line, "longitude"),
                "address": row["address"].strip(),
                "description": row["description"].strip(),
                "is_active": _flag(row["is_active"], line),
            }
            counts[self._upsert(Place, "slug", slug, fields)] += 1
        self._report(path, **counts)
