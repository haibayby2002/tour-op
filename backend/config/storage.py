"""Where uploaded files live, chosen by the MEDIA_STORAGE env var.

    local  files under MEDIA_ROOT, served at MEDIA_URL (default; fine for dev
           and small single-server deployments)
    s3     Amazon S3 (or any S3-compatible service)
    r2     Cloudflare R2 (S3-compatible; endpoint derived from R2_ACCOUNT_ID)

Two storage aliases are defined:

    default  public media: avatars, profile/service photos, review screenshots.
             Served from MEDIA_PUBLIC_URL (CDN / custom domain / r2.dev) when
             set, otherwise through short-lived signed URLs.
    private  report evidence. Always signed URLs on s3/r2, so put it in a
             bucket with no public access (MEDIA_PRIVATE_BUCKET).

Switching providers only needs env changes; the database stores storage keys
(e.g. "profile_photos/2026/10/3f2a….webp"), never full URLs. Copy existing
objects to the new bucket with the same keys when you switch.
"""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse

PROVIDERS = {"local", "s3", "r2"}
STATICFILES = {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"}
# Upload keys are random and never rewritten, so CDNs and browsers may cache forever.
IMMUTABLE_CACHE = {"CacheControl": "public, max-age=31536000, immutable"}


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _required(provider: str, *names: str) -> None:
    missing = [n for n in names if not _env(n)]
    if missing:
        raise RuntimeError(f"MEDIA_STORAGE={provider} needs {', '.join(missing)} to be set.")


def _s3_options(provider: str) -> dict:
    if provider == "r2":
        _required("r2", "MEDIA_BUCKET", "MEDIA_ACCESS_KEY_ID", "MEDIA_SECRET_ACCESS_KEY")
        account = _env("R2_ACCOUNT_ID")
        endpoint = _env("MEDIA_ENDPOINT_URL") or (account and f"https://{account}.r2.cloudflarestorage.com")
        if not endpoint:
            raise RuntimeError("MEDIA_STORAGE=r2 needs R2_ACCOUNT_ID (or MEDIA_ENDPOINT_URL).")
        region = "auto"
    else:
        _required("s3", "MEDIA_BUCKET")
        # Credentials may also come from an instance role / AWS_* env vars, so they're optional here.
        endpoint = _env("MEDIA_ENDPOINT_URL") or None
        region = _env("MEDIA_REGION") or None

    return {
        "endpoint_url": endpoint,
        "region_name": region,
        "access_key": _env("MEDIA_ACCESS_KEY_ID") or None,
        "secret_key": _env("MEDIA_SECRET_ACCESS_KEY") or None,
        "signature_version": "s3v4",
        "default_acl": None,  # access is controlled by bucket policy, not per-object ACLs
        "file_overwrite": False,
        "querystring_expire": int(_env("MEDIA_URL_EXPIRE_SECONDS", "3600")),
    }


def build_storages(base_dir: Path) -> tuple[dict, str]:
    """Return (STORAGES, provider) for settings.py."""
    provider = _env("MEDIA_STORAGE", "local").lower()
    if provider not in PROVIDERS:
        raise RuntimeError(f"MEDIA_STORAGE must be one of {sorted(PROVIDERS)}, got {provider!r}.")

    if provider == "local":
        # One directory for both aliases so existing files keep resolving.
        # Keys are random UUIDs, so evidence URLs are unguessable, but use s3/r2 in production.
        local = {"BACKEND": "django.core.files.storage.FileSystemStorage"}
        return {"default": local, "private": local, "staticfiles": STATICFILES}, provider

    common = _s3_options(provider)
    public_url = _env("MEDIA_PUBLIC_URL")
    public = {
        **common,
        "bucket_name": _env("MEDIA_BUCKET"),
        "location": _env("MEDIA_PREFIX"),
        "object_parameters": IMMUTABLE_CACHE,
    }
    if public_url:
        parsed = urlparse(public_url if "://" in public_url else f"https://{public_url}")
        public.update(
            custom_domain=(parsed.netloc + parsed.path).rstrip("/"),
            url_protocol=f"{parsed.scheme}:",
            querystring_auth=False,
        )
    else:
        public["querystring_auth"] = True

    private = {
        **common,
        "bucket_name": _env("MEDIA_PRIVATE_BUCKET") or _env("MEDIA_BUCKET"),
        # Same bucket as public media → keep evidence under its own prefix.
        "location": _env("MEDIA_PRIVATE_PREFIX", "" if _env("MEDIA_PRIVATE_BUCKET") else "private"),
        "querystring_auth": True,
        "custom_domain": None,
    }
    backend = "storages.backends.s3.S3Storage"
    return {
        "default": {"BACKEND": backend, "OPTIONS": public},
        "private": {"BACKEND": backend, "OPTIONS": private},
        "staticfiles": STATICFILES,
    }, provider
