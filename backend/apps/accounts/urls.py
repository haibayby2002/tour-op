from django.urls import path

from . import views

urlpatterns = [
    path("register/", views.RegisterView.as_view()),
    path("login/", views.LoginView.as_view()),
    path("google/", views.GoogleLoginView.as_view()),
    path("refresh/", views.RefreshView.as_view()),
    path("logout/", views.LogoutView.as_view()),
    path("me/", views.MeView.as_view()),
    path("me/password/", views.ChangePasswordView.as_view()),
    path("roles/", views.RolesView.as_view()),
    path("roles/<str:role>/", views.RolesView.as_view()),
    path("verify/send/", views.SendVerificationView.as_view()),
    path("verify/confirm/", views.ConfirmVerificationView.as_view()),
]
