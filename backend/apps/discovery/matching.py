"""Rule-based matching with explanations.

Each result carries machine-readable reasons (e.g. common_language) that the
clients translate, so travelers see *why* a local was suggested. Missing
reviews are never treated as negative; they surface as `new_member`.
"""
from dataclasses import dataclass, field

from apps.accounts.models import User


@dataclass
class MatchContext:
    viewer: User | None = None
    viewer_languages: set[str] = field(default_factory=set)
    viewer_interests: set[str] = field(default_factory=set)
    language: str | None = None
    interests: set[str] = field(default_factory=set)
    category: str | None = None
    date_available: bool = False
    budget_max: int | None = None


def score_local(candidate: dict, ctx: MatchContext) -> tuple[int, list[dict]]:
    score = 0
    reasons: list[dict] = []

    wanted_langs = {ctx.language} if ctx.language else ctx.viewer_languages
    common_langs = sorted(wanted_langs & candidate["language_codes"])
    if common_langs:
        score += 25
        reasons.append({"code": "common_language", "params": {"languages": common_langs}})

    wanted_interests = ctx.interests or ctx.viewer_interests
    shared = sorted(wanted_interests & candidate["interest_slugs"])
    if shared:
        score += min(20, 5 * len(shared))
        reasons.append({"code": "shared_interests", "params": {"interests": shared}})

    if ctx.category and ctx.category in candidate["category_slugs"]:
        score += 15
        reasons.append({"code": "offers_category", "params": {"category": ctx.category}})

    if ctx.date_available:
        score += 15
        reasons.append({"code": "available_on_date", "params": {}})

    if ctx.budget_max is not None and candidate["price_min"] is not None and candidate["price_min"] <= ctx.budget_max:
        score += 10
        reasons.append({"code": "within_budget", "params": {}})

    trust = candidate["trust"]
    if trust["email_verified"] and trust["phone_verified"]:
        score += 10
        reasons.append({"code": "verified_contacts", "params": {}})
    if trust.get("manually_checked"):
        score += 5
        reasons.append({"code": "manually_checked", "params": {}})
    score += trust["profile_completion"] // 10

    if trust["review_count"]:
        score += round((trust["rating_avg"] - 3) * 5)
        if trust["rating_avg"] >= 4.5:
            reasons.append({"code": "highly_rated", "params": {"rating": trust["rating_avg"]}})
    else:
        reasons.append({"code": "new_member", "params": {}})

    return score, reasons
