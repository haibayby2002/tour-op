from django.urls import path

from . import views

urlpatterns = [
    path("reviews/", views.ReviewCreateView.as_view()),
    path("users/<int:user_id>/reviews/", views.UserReviewsView.as_view()),
]
