from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("profile/me/photos", views.PhotoViewSet, basename="my-photos")
router.register("profile/me/external-reviews", views.ExternalReviewViewSet, basename="my-external-reviews")
router.register("profile/me/availability", views.AvailabilityViewSet, basename="my-availability")

urlpatterns = [
    path("meta/", views.MetaView.as_view()),
    path("places/", views.PlaceListView.as_view()),
    path("profile/me/", views.MyProfileView.as_view()),
    path("profile/me/avatar/", views.AvatarView.as_view()),
    path("profile/me/submit-review/", views.SubmitForReviewView.as_view()),
    path("users/<int:user_id>/", views.PublicProfileView.as_view()),
    *router.urls,
]
