from django.urls import path

from . import views

urlpatterns = [
    path("overview/", views.OverviewView.as_view()),
    path("users/", views.UserListView.as_view()),
    path("users/<int:pk>/status/", views.UserStatusView.as_view()),
    path("reports/", views.ReportListView.as_view()),
    path("reports/<int:pk>/", views.ReportDetailView.as_view()),
    path("locals/", views.LocalListView.as_view()),
    path("locals/<int:pk>/review/", views.LocalReviewView.as_view()),
    path("external-reviews/<int:pk>/", views.ExternalReviewView.as_view()),
    path("reviews/", views.ReviewListView.as_view()),
    path("reviews/<int:pk>/visibility/", views.ReviewVisibilityView.as_view()),
    path("bookings/", views.BookingListView.as_view()),
    path("audit/", views.AuditLogView.as_view()),
]
