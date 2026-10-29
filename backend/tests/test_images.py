from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.accounts.models import UserRole
from apps.experiences.models import LocalService
from apps.profiles.models import ProfilePhoto
from config.storage import build_storages

from .conftest import client_for


def image_file(name="photo.jpg", fmt="JPEG", size=(3000, 2000), exif_gps=False, color="red"):
    buffer = BytesIO()
    image = Image.new("RGB", size, color)
    kwargs = {}
    if exif_gps:
        exif = Image.Exif()
        exif[0x0112] = 6  # orientation: rotate 90° clockwise
        exif.get_ifd(0x8825)[2] = (10.0, 46.0, 30.0)  # GPS latitude
        kwargs["exif"] = exif
    image.save(buffer, fmt, **kwargs)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=f"image/{fmt.lower()}")


def stored(field) -> Image.Image:
    field.open("rb")
    try:
        image = Image.open(field)
        image.load()
        return image
    finally:
        field.close()


def test_gallery_photo_is_reencoded_resized_and_stripped(local, settings):
    response = client_for(local).post(
        "/api/v1/profile/me/photos/",
        {"image": image_file("Nguyen Van A 0901234567.jpg", exif_gps=True), "caption": "Old quarter"},
        format="multipart",
    )
    assert response.status_code == 201, response.data
    assert response.data["image"].startswith("http://testserver/media/profile_photos/")
    assert response.data["thumbnail"].startswith("http://testserver/media/profile_photos/thumbs/")

    photo = ProfilePhoto.objects.get(pk=response.data["id"])
    assert "0901234567" not in photo.image.name  # original filename is discarded
    assert photo.image.name.endswith(".webp")
    full = stored(photo.image)
    assert full.format == "WEBP"
    assert max(full.size) == settings.IMAGE_SIZES["full"]
    assert full.size[1] > full.size[0]  # EXIF orientation applied before the metadata was dropped
    assert not full.getexif()
    assert max(stored(photo.thumbnail).size) == settings.IMAGE_SIZES["thumb"]


def test_non_images_and_oversized_uploads_are_rejected(local, settings):
    client = client_for(local)
    fake = SimpleUploadedFile("photo.jpg", b"%PDF-1.4 not an image", content_type="image/jpeg")
    response = client.post("/api/v1/profile/me/photos/", {"image": fake}, format="multipart")
    assert response.status_code == 400
    assert response.data["code"] == "invalid_image"

    gif = image_file("anim.gif", fmt="GIF", size=(50, 50))
    response = client.post("/api/v1/profile/me/photos/", {"image": gif}, format="multipart")
    assert response.data["code"] == "invalid_image_type"

    settings.IMAGE_MAX_UPLOAD_MB = 0
    response = client.post("/api/v1/profile/me/photos/", {"image": image_file()}, format="multipart")
    assert response.data["code"] == "file_too_large"
    assert ProfilePhoto.objects.count() == 0


def test_avatar_is_square_and_old_file_is_removed(local, django_capture_on_commit_callbacks):
    client = client_for(local)
    response = client.post("/api/v1/profile/me/avatar/", {"avatar": image_file()}, format="multipart")
    assert response.status_code == 200, response.data
    local.profile.refresh_from_db()
    first = local.profile.avatar
    assert stored(first).size == (512, 512)
    storage, first_name = first.storage, first.name

    with django_capture_on_commit_callbacks(execute=True):
        client.post("/api/v1/profile/me/avatar/", {"avatar": image_file(color="blue")}, format="multipart")
    assert not storage.exists(first_name)

    local.profile.refresh_from_db()
    second_name = local.profile.avatar.name
    with django_capture_on_commit_callbacks(execute=True):
        assert client.delete("/api/v1/profile/me/avatar/").data["avatar"] is None
    assert not storage.exists(second_name)

    response = client.post(
        "/api/v1/profile/me/avatar/",
        {"avatar": SimpleUploadedFile("a.png", b"nope", content_type="image/png")},
        format="multipart",
    )
    assert response.status_code == 400
    assert response.data["code"] == "invalid_image"


def test_deleting_a_photo_removes_both_files(local, django_capture_on_commit_callbacks):
    client = client_for(local)
    photo_id = client.post("/api/v1/profile/me/photos/", {"image": image_file()}, format="multipart").data["id"]
    photo = ProfilePhoto.objects.get(pk=photo_id)
    names = [photo.image.name, photo.thumbnail.name]
    with django_capture_on_commit_callbacks(execute=True):
        assert client.delete(f"/api/v1/profile/me/photos/{photo_id}/").status_code == 204
    assert not any(photo.image.storage.exists(n) for n in names)


def test_service_photos_upload_show_publicly_and_delete(local, traveler, django_capture_on_commit_callbacks):
    service = LocalService.objects.get(local=local)
    client = client_for(local)
    response = client.post(f"/api/v1/services/mine/{service.id}/photos/", {"image": image_file()}, format="multipart")
    assert response.status_code == 201, response.data
    assert response.data["thumbnail"]

    profile = client_for(traveler).get(f"/api/v1/users/{local.id}/", {"role": UserRole.Role.LOCAL}).data
    assert profile["services"][0]["photos"][0]["id"] == response.data["id"]

    photo = service.photos.get()
    with django_capture_on_commit_callbacks(execute=True):
        assert client.delete(f"/api/v1/services/mine/{service.id}/photos/{photo.id}/").status_code == 204
    assert not photo.image.storage.exists(photo.image.name)


def test_meta_exposes_upload_limits(db, settings):
    settings.IMAGE_MAX_UPLOAD_MB = 7
    data = client_for().get("/api/v1/meta/").data
    assert data["image_upload"]["max_mb"] == 7


# --- storage selection --------------------------------------------------------
@pytest.fixture
def media_env(monkeypatch):
    for name in ("MEDIA_STORAGE", "MEDIA_BUCKET", "MEDIA_PRIVATE_BUCKET", "MEDIA_PUBLIC_URL", "R2_ACCOUNT_ID",
                 "MEDIA_ENDPOINT_URL", "MEDIA_ACCESS_KEY_ID", "MEDIA_SECRET_ACCESS_KEY", "MEDIA_REGION"):
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


def test_local_storage_is_the_default(media_env, tmp_path):
    storages, provider = build_storages(tmp_path)
    assert provider == "local"
    assert storages["default"]["BACKEND"].endswith("FileSystemStorage")


def test_r2_storage_from_env(media_env, tmp_path):
    media_env.setenv("MEDIA_STORAGE", "r2")
    media_env.setenv("R2_ACCOUNT_ID", "abc123")
    media_env.setenv("MEDIA_BUCKET", "tourop-media")
    media_env.setenv("MEDIA_PRIVATE_BUCKET", "tourop-private")
    media_env.setenv("MEDIA_ACCESS_KEY_ID", "key")
    media_env.setenv("MEDIA_SECRET_ACCESS_KEY", "secret")
    media_env.setenv("MEDIA_PUBLIC_URL", "https://media.tour-op.com")
    storages, provider = build_storages(tmp_path)
    public, private = storages["default"]["OPTIONS"], storages["private"]["OPTIONS"]
    assert provider == "r2"
    assert public["endpoint_url"] == "https://abc123.r2.cloudflarestorage.com"
    assert public["region_name"] == "auto"
    assert public["custom_domain"] == "media.tour-op.com"
    assert public["querystring_auth"] is False
    assert private["bucket_name"] == "tourop-private"
    assert private["querystring_auth"] is True and private["custom_domain"] is None


def test_s3_without_public_url_uses_signed_urls(media_env, tmp_path):
    media_env.setenv("MEDIA_STORAGE", "s3")
    media_env.setenv("MEDIA_BUCKET", "tourop-media")
    media_env.setenv("MEDIA_REGION", "ap-southeast-1")
    storages, _ = build_storages(tmp_path)
    assert storages["default"]["OPTIONS"]["querystring_auth"] is True
    assert storages["private"]["OPTIONS"]["location"] == "private"  # same bucket → separate prefix


def test_misconfigured_storage_fails_fast(media_env, tmp_path):
    media_env.setenv("MEDIA_STORAGE", "r2")
    with pytest.raises(RuntimeError, match="MEDIA_BUCKET"):
        build_storages(tmp_path)
    media_env.setenv("MEDIA_STORAGE", "dropbox")
    with pytest.raises(RuntimeError, match="MEDIA_STORAGE"):
        build_storages(tmp_path)
