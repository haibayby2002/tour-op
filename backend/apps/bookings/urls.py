from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("tour-requests", views.TourRequestViewSet, basename="tour-requests")
router.register("bookings", views.BookingViewSet, basename="bookings")
router.register("agreements", views.AgreementActionViewSet, basename="agreements")

urlpatterns = [
    *router.urls,
    path("shares/<int:pk>/", views.ShareRevokeView.as_view()),
    path("share/<str:token>/", views.PublicShareView.as_view()),
]
