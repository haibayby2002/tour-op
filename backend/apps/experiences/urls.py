from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("services/mine", views.MyServiceViewSet, basename="my-services")

urlpatterns = [
    *router.urls,
    path("services/<int:pk>/", views.ServiceDetailView.as_view()),
]
