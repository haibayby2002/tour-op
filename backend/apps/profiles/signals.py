"""Keep the cached completion percentage in sync with any profile change."""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.common.images import delete_files_with

from .models import (
    ExternalReviewSource,
    LocalProfile,
    Profile,
    ProfilePhoto,
    TravelerProfile,
    UserInterest,
    UserLanguage,
)
from .services import refresh_completion

TRACKED = (Profile, LocalProfile, TravelerProfile, UserLanguage, UserInterest, ProfilePhoto)


def _refresh(sender, instance, **kwargs):
    if kwargs.get("raw"):
        return
    refresh_completion(instance.user)


for model in TRACKED:
    post_save.connect(_refresh, sender=model, dispatch_uid=f"completion_save_{model.__name__}")
    post_delete.connect(_refresh, sender=model, dispatch_uid=f"completion_delete_{model.__name__}")


@receiver(post_save, sender="experiences.LocalService", dispatch_uid="completion_service_save")
@receiver(post_delete, sender="experiences.LocalService", dispatch_uid="completion_service_delete")
def _service_changed(sender, instance, **kwargs):
    if not kwargs.get("raw"):
        refresh_completion(instance.local)


# Stored files follow their rows: removed on delete or when replaced.
delete_files_with(Profile, "avatar")
delete_files_with(ProfilePhoto, "image", "thumbnail")
delete_files_with(ExternalReviewSource, "screenshot")
