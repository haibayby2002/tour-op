from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("trip-wishes", views.TripWishViewSet, basename="trip-wishes")
router.register("wish-offers", views.WishOfferViewSet, basename="wish-offers")

urlpatterns = router.urls
