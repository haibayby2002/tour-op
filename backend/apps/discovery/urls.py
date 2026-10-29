from django.urls import path

from . import views

urlpatterns = [
    path("locals/", views.LocalSearchView.as_view()),
]
