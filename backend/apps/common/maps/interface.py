"""Map provider abstraction so business logic never depends on one vendor."""
from dataclasses import dataclass
from functools import lru_cache
import math

from django.conf import settings
from django.utils.module_loading import import_string


@dataclass(frozen=True)
class Coordinates:
    latitude: float
    longitude: float


class MapService:
    def geocode(self, query: str) -> Coordinates | None:
        raise NotImplementedError

    def reverse_geocode(self, point: Coordinates) -> str | None:
        raise NotImplementedError

    @staticmethod
    def distance_km(a: Coordinates, b: Coordinates) -> float:
        """Great-circle distance; PostGIS can replace this when geo queries are needed."""
        r = 6371.0
        dlat = math.radians(b.latitude - a.latitude)
        dlon = math.radians(b.longitude - a.longitude)
        h = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(a.latitude))
            * math.cos(math.radians(b.latitude))
            * math.sin(dlon / 2) ** 2
        )
        return 2 * r * math.asin(math.sqrt(h))


class NullMapService(MapService):
    """Default provider: no external calls. Geocoding falls back to City records."""

    def geocode(self, query: str) -> Coordinates | None:
        from apps.profiles.models import City

        city = City.objects.filter(name__iexact=query.strip()).first()
        if city and city.latitude is not None:
            return Coordinates(float(city.latitude), float(city.longitude))
        return None

    def reverse_geocode(self, point: Coordinates) -> str | None:
        return None


@lru_cache
def get_map_service() -> MapService:
    path = getattr(settings, "MAP_SERVICE", "apps.common.maps.interface.NullMapService")
    return import_string(path)()
