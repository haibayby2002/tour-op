from .models import Review


def serialize_review(review: Review, request=None) -> dict:
    from apps.profiles.selectors import public_card

    return {
        "id": review.id,
        "rating": review.rating,
        "comment": review.comment,
        "reviewer": public_card(review.reviewer, request),
        "reviewee_role": review.reviewee_role,
        "felt_safe": review.felt_safe,
        "itinerary_respected": review.itinerary_respected,
        "price_as_agreed": review.price_as_agreed,
        "created_at": review.created_at.isoformat(),
        "booking_id": review.booking_id,
    }


def reviews_for(user, role: str):
    return (
        Review.objects.publicly_visible()
        .filter(reviewee=user, reviewee_role=role)
        .select_related("reviewer__profile", "reviewer__profile__city")
    )


def recent_reviews(user, role: str, limit: int = 5, request=None) -> list[dict]:
    return [serialize_review(r, request) for r in reviews_for(user, role)[:limit]]
