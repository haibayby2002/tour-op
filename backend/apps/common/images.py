"""Image uploads: validation, re-encoding, storage keys and file cleanup.

Every user image is decoded and re-encoded before it is stored. That
  * rejects anything that isn't really a JPEG/PNG/WebP (whatever the extension says),
  * drops EXIF metadata, including GPS location, which matters on a platform
    about meeting strangers,
  * applies the camera's rotation, caps the size and stores WebP.
"""
from __future__ import annotations

import uuid
from io import BytesIO
from pathlib import PurePosixPath

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.db import transaction
from django.db.models.signals import post_delete, pre_save
from django.utils import timezone
from django.utils.deconstruct import deconstructible
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import serializers

from .exceptions import DomainError

# MPO is how many phones label multi-frame JPEGs.
ACCEPTED_FORMATS = {"JPEG", "MPO", "PNG", "WEBP"}


class ImageRejected(DomainError):
    """400 with a stable `code` (file_too_large, invalid_image…) clients can translate."""


@deconstructible
class UploadTo:
    """Random storage key under a dated prefix, e.g. profile_photos/2026/10/<uuid>.webp.

    Original filenames are discarded: they can leak names or phone numbers and
    make keys guessable.
    """

    def __init__(self, prefix: str):
        self.prefix = prefix.strip("/")

    def __call__(self, instance, filename: str) -> str:
        ext = PurePosixPath(filename).suffix.lower()[:8]
        return f"{self.prefix}/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{ext}"

    def __eq__(self, other):
        return isinstance(other, UploadTo) and other.prefix == self.prefix


def private_storage():
    """Storage for files that must never be public (report evidence)."""
    return storages["private"]


def _open(upload) -> Image.Image:
    max_bytes = settings.IMAGE_MAX_UPLOAD_MB * 1024 * 1024
    if upload.size > max_bytes:
        raise ImageRejected(
            f"Image is larger than {settings.IMAGE_MAX_UPLOAD_MB} MB.", code="file_too_large"
        )
    try:
        upload.seek(0)
        image = Image.open(upload)
        fmt = image.format
        width, height = image.size
    except (UnidentifiedImageError, OSError):
        raise ImageRejected("This file isn't an image we can read.", code="invalid_image") from None
    if fmt not in ACCEPTED_FORMATS:
        raise ImageRejected("Use a JPEG, PNG or WebP image.", code="invalid_image_type")
    if width * height > settings.IMAGE_MAX_PIXELS:
        raise ImageRejected("Image dimensions are too large.", code="image_too_large")
    try:
        image.load()
    except (OSError, Image.DecompressionBombError):
        raise ImageRejected("This image is damaged or can't be read.", code="invalid_image") from None
    return image


def _encode(image: Image.Image, max_side: int, square: bool = False) -> ContentFile:
    if square:
        image = ImageOps.fit(image, (max_side, max_side), Image.Resampling.LANCZOS)
    else:
        image = image.copy()
        image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    buffer = BytesIO()
    # No exif= argument → no metadata is written.
    image.save(buffer, "WEBP", quality=settings.IMAGE_QUALITY, method=4)
    return ContentFile(buffer.getvalue(), name=f"{uuid.uuid4().hex}.webp")


def _normalise(upload) -> Image.Image:
    image = ImageOps.exif_transpose(_open(upload))
    return image.convert("RGBA" if image.mode in ("RGBA", "LA", "P") else "RGB")


def process_photo(upload) -> tuple[ContentFile, ContentFile]:
    """Return (full, thumbnail) WebP files for a gallery-style photo."""
    image = _normalise(upload)
    sizes = settings.IMAGE_SIZES
    return _encode(image, sizes["full"]), _encode(image, sizes["thumb"])


def process_avatar(upload) -> ContentFile:
    """Square-cropped avatar."""
    return _encode(_normalise(upload), settings.IMAGE_SIZES["avatar"], square=True)


def process_single(upload) -> ContentFile:
    """One re-encoded image, e.g. a review screenshot (no thumbnail needed)."""
    return _encode(_normalise(upload), settings.IMAGE_SIZES["full"])


class PhotoField(serializers.ImageField):
    """Write: validates the upload. Read: absolute URL (works for local and S3/R2)."""

    def to_internal_value(self, data):
        try:
            upload = super().to_internal_value(data)
        except (serializers.ValidationError, DjangoValidationError):
            raise ImageRejected("This file isn't an image we can read.", code="invalid_image") from None
        _open(upload)  # validate early so errors are attached to this field
        upload.seek(0)
        return upload


def file_url(file, request=None) -> str | None:
    if not file:
        return None
    url = file.url
    return request.build_absolute_uri(url) if request else url


# --- Cleanup -----------------------------------------------------------------
def _delete_later(file) -> None:
    if file and file.name:
        storage, name = file.storage, file.name
        transaction.on_commit(lambda: storage.delete(name))


def delete_files_with(model, *fields: str) -> None:
    """Remove stored files when a row is deleted or its file is replaced."""

    def on_delete(sender, instance, **kwargs):
        for field in fields:
            _delete_later(getattr(instance, field))

    def on_change(sender, instance, raw=False, **kwargs):
        if raw or instance._state.adding or not instance.pk:
            return
        old = sender.objects.filter(pk=instance.pk).values(*fields).first()
        if not old:
            return
        for field in fields:
            new_name = getattr(instance, field).name if getattr(instance, field) else ""
            if old[field] and old[field] != new_name:
                file_field = getattr(instance, field).field
                storage = file_field.storage
                name = old[field]
                transaction.on_commit(lambda s=storage, n=name: s.delete(n))

    uid = f"{model._meta.label}:{','.join(fields)}"
    post_delete.connect(on_delete, sender=model, weak=False, dispatch_uid=f"files_delete:{uid}")
    pre_save.connect(on_change, sender=model, weak=False, dispatch_uid=f"files_change:{uid}")


class ProcessedPhotoMixin:
    """ModelSerializer mixin: re-encodes `image` and fills `thumbnail` on save."""

    def _process(self, validated_data):
        upload = validated_data.get("image")
        if upload is not None:
            validated_data["image"], validated_data["thumbnail"] = process_photo(upload)
        return validated_data

    def create(self, validated_data):
        return super().create(self._process(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._process(validated_data))
