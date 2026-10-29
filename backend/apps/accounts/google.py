"""Sign in with Google.

Clients (Google Identity Services on web, native sign-in on Android) obtain a
Google ID token and post it to /auth/google/. We verify its signature, audience
and issuer with Google's library, then log in the account with that email or,
for a new person, create one after they supply the details our rules require
(birth year for the age check, phone for contact verification).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from django.conf import settings
from django.utils import timezone
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from apps.audit.services import record
from apps.common.exceptions import DomainError

from .models import User, Verification

logger = logging.getLogger(__name__)
_transport = google_requests.Request()  # caches Google's signing certificates


@dataclass
class GoogleIdentity:
    email: str
    full_name: str
    subject: str


def verify_google_token(token: str) -> GoogleIdentity:
    client_ids = settings.GOOGLE_CLIENT_IDS
    if not client_ids:
        raise DomainError("Google sign-in isn't configured.", code="google_not_configured", status_code=503)
    try:
        # audience=None skips the library's single-audience check; we compare against our list below.
        # A little clock skew is allowed: a token minted a second "in the future" is otherwise rejected.
        claims = id_token.verify_oauth2_token(token, _transport, audience=None, clock_skew_in_seconds=10)
    except (ValueError, GoogleAuthError) as exc:
        logger.warning("Google ID token rejected: %s", exc)
        raise DomainError("Google sign-in failed. Please try again.", code="google_invalid_token", status_code=401) from None
    if claims.get("aud") not in client_ids or claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        logger.warning("Google ID token for another client: aud=%s iss=%s", claims.get("aud"), claims.get("iss"))
        raise DomainError("Google sign-in failed. Please try again.", code="google_invalid_token", status_code=401)
    if not claims.get("email") or not claims.get("email_verified"):
        raise DomainError("Your Google account has no verified email.", code="google_email_unverified", status_code=401)
    return GoogleIdentity(
        email=claims["email"].lower(),
        full_name=(claims.get("name") or claims["email"].split("@")[0]).strip(),
        subject=claims["sub"],
    )


def mark_email_verified(user: User) -> None:
    """Google has confirmed the address, so it counts as a verified email."""
    if user.is_verified(Verification.Kind.EMAIL):
        return
    user.verifications.filter(kind=Verification.Kind.EMAIL, status=Verification.Status.PENDING).update(
        status=Verification.Status.EXPIRED
    )
    verification = Verification.objects.create(
        user=user,
        kind=Verification.Kind.EMAIL,
        target=user.email,
        status=Verification.Status.VERIFIED,
        verified_at=timezone.now(),
        note="Verified by Google sign-in",
    )
    record(user, verification, "VERIFIED", kind=Verification.Kind.EMAIL, via="google")
