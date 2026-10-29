from datetime import datetime, time

from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User, UserRole
from apps.common.images import file_url
from apps.experiences.models import LocalService
from apps.profiles.models import ProfilePhoto
from apps.profiles.selectors import avatar_url
from apps.profiles.services import trust_signals
from apps.safety.models import Block

from .matching import MatchContext, score_local

MAX_CANDIDATES = 300


def _int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


class LocalSearchView(APIView):
    """GET /locals/?city=&language=&category=&interest=a,b&price_max=&date=YYYY-MM-DD&q=&verified=1&sort=match|rating|price_asc|price_desc"""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        p = request.query_params
        viewer = request.user if request.user.is_authenticated else None

        qs = User.objects.filter(
            roles__role=UserRole.Role.LOCAL,
            status=User.Status.ACTIVE,
            is_active=True,
            local_profile__is_accepting_requests=True,
            local_profile__price_min__isnull=False,
        )
        if viewer:
            blocked_ids = set(Block.objects.filter(blocker=viewer).values_list("blocked_id", flat=True)) | set(
                Block.objects.filter(blocked=viewer).values_list("blocker_id", flat=True)
            )
            qs = qs.exclude(id=viewer.id).exclude(id__in=blocked_ids)

        if p.get("city"):
            qs = qs.filter(profile__city__slug=p["city"])
        if p.get("language"):
            qs = qs.filter(languages__language__code=p["language"])
        if p.get("category"):
            qs = qs.filter(services__category__slug=p["category"], services__status=LocalService.Status.ACTIVE)
        interests = {s for s in p.get("interest", "").split(",") if s}
        if interests:
            qs = qs.filter(interests__interest__slug__in=interests)
        price_max = _int(p.get("price_max"))
        if price_max is not None:
            qs = qs.filter(local_profile__price_min__lte=price_max)
        price_min = _int(p.get("price_min"))
        if price_min is not None:
            qs = qs.filter(Q(local_profile__price_max__gte=price_min) | Q(local_profile__price_max__isnull=True))
        date_filter = None
        if p.get("date"):
            try:
                day = datetime.strptime(p["date"], "%Y-%m-%d").date()
                tz = timezone.get_current_timezone()
                day_start = timezone.make_aware(datetime.combine(day, time.min), tz)
                day_end = timezone.make_aware(datetime.combine(day, time.max), tz)
                qs = qs.filter(availability__start_at__lte=day_end, availability__end_at__gte=day_start)
                date_filter = day
            except ValueError:
                pass
        if p.get("q"):
            q = p["q"].strip()
            qs = qs.filter(
                Q(profile__display_name__icontains=q)
                | Q(full_name__icontains=q)
                | Q(profile__bio__icontains=q)
                | Q(local_profile__areas_description__icontains=q)
                | Q(services__title__icontains=q)
            )

        users = list(
            qs.distinct()
            .select_related("profile", "profile__city", "local_profile")
            .prefetch_related("languages__language", "interests__interest", "services__category", "services__photos",
                              "photos")[:MAX_CANDIDATES]
        )

        ctx = MatchContext(
            viewer=viewer,
            language=p.get("language") or None,
            interests=interests,
            category=p.get("category") or None,
            date_available=date_filter is not None,
            budget_max=price_max,
        )
        if viewer:
            ctx.viewer_languages = set(viewer.languages.values_list("language__code", flat=True))
            ctx.viewer_interests = set(viewer.interests.values_list("interest__slug", flat=True))

        verified_only = p.get("verified") == "1"
        results = []
        for user in users:
            item = self._card(user, request)
            if verified_only and not (item["trust"]["email_verified"] and item["trust"]["phone_verified"]):
                continue
            score, reasons = score_local(item, ctx)
            item["match"] = {"score": score, "reasons": reasons}
            for key in ("language_codes", "interest_slugs", "category_slugs"):
                item[key] = sorted(item[key])
            results.append(item)

        sort = p.get("sort", "match")
        if sort == "rating":
            results.sort(key=lambda r: (r["trust"]["rating_avg"] or 0, r["trust"]["review_count"]), reverse=True)
        elif sort == "price_asc":
            results.sort(key=lambda r: r["price_min"])
        elif sort == "price_desc":
            results.sort(key=lambda r: r["price_min"], reverse=True)
        else:
            results.sort(key=lambda r: r["match"]["score"], reverse=True)

        page = max(_int(p.get("page")) or 1, 1)
        size = min(max(_int(p.get("page_size")) or 20, 1), 50)
        start = (page - 1) * size
        return Response(
            {"count": len(results), "page": page, "page_size": size, "results": results[start:start + size]}
        )

    @staticmethod
    def _cover(user: User, services, request) -> str | None:
        """A picture for the card: the local's first visible profile photo, else a photo of one of their experiences."""
        photo = next((p for p in user.photos.all() if p.status == ProfilePhoto.Status.VISIBLE), None)
        if photo is None:
            photo = next((p for s in services for p in s.photos.all()), None)
        return file_url(photo.thumbnail or photo.image, request) if photo else None

    @staticmethod
    def _card(user: User, request) -> dict:
        profile, local = user.profile, user.local_profile
        services = [s for s in user.services.all() if s.status == LocalService.Status.ACTIVE]
        trust = trust_signals(user, UserRole.Role.LOCAL)
        return {
            "id": user.id,
            "name": profile.public_name,
            "avatar": avatar_url(profile, request),
            "cover": LocalSearchView._cover(user, services, request),
            "age_by_birth_year": user.age_by_birth_year,
            "is_demo": user.is_demo,
            "city": profile.city.name if profile.city else None,
            "city_slug": profile.city.slug if profile.city else None,
            "bio": profile.bio[:240],
            "areas": local.areas_description,
            "years_experience": local.years_experience,
            "price_min": local.price_min,
            "price_max": local.price_max,
            "currency": local.currency,
            "languages": [
                {"code": ul.language.code, "name": ul.language.name, "name_vi": ul.language.name_vi}
                for ul in user.languages.all()
            ],
            "language_codes": {ul.language.code for ul in user.languages.all()},
            "interest_slugs": {ui.interest.slug for ui in user.interests.all()},
            "category_slugs": {s.category.slug for s in services},
            "service_count": len(services),
            "trust": {
                key: trust[key]
                for key in ("email_verified", "phone_verified", "identity_verified", "manually_checked",
                            "profile_completion", "profile_complete", "rating_avg", "review_count",
                            "completed_tours", "is_new_member")
            },
        }
