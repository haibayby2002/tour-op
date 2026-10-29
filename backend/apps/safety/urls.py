from django.urls import path

from . import views

urlpatterns = [
    path("reports/", views.ReportListCreateView.as_view()),
    path("reports/<int:pk>/", views.ReportDetailView.as_view()),
    path("reports/<int:pk>/evidence/", views.ReportEvidenceView.as_view()),
    path("blocks/", views.BlockListView.as_view()),
    path("blocks/<int:user_id>/", views.BlockDetailView.as_view()),
]
