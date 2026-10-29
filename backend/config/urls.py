from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

api_v1 = [
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.profiles.urls")),
    path("", include("apps.experiences.urls")),
    path("", include("apps.discovery.urls")),
    path("", include("apps.bookings.urls")),
    path("", include("apps.messaging.urls")),
    path("", include("apps.reviews.urls")),
    path("", include("apps.safety.urls")),
    path("", include("apps.notifications.urls")),
    path("", include("apps.wishes.urls")),
    path("staff/", include("apps.staff.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

if settings.SERVE_MEDIA:
    # django.conf.urls.static.static() is a no-op without DEBUG, so wire serve() directly.
    urlpatterns += [
        re_path(rf"^{settings.MEDIA_URL.strip('/')}/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    ]

admin.site.site_header = "Tour-op administration"
admin.site.site_title = "Tour-op admin"
