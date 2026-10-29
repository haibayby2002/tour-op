from django.apps import AppConfig


class ExperiencesConfig(AppConfig):
    name = "apps.experiences"

    def ready(self):
        from apps.common.images import delete_files_with

        from .models import ServicePhoto

        delete_files_with(ServicePhoto, "image", "thumbnail")
