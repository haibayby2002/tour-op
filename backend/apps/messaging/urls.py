from django.urls import path

from . import views

urlpatterns = [
    path("conversations/", views.ConversationListView.as_view()),
    path("conversations/<int:conversation_id>/", views.ConversationDetailView.as_view()),
    path("conversations/<int:conversation_id>/messages/", views.MessageListView.as_view()),
    path("conversations/<int:conversation_id>/read/", views.MarkReadView.as_view()),
]
