"""Authentication endpoints.

Web clients send `X-Client: web`; their refresh token is set as an HTTP-only
cookie scoped to /api/v1/auth/ and never exposed to JavaScript. Mobile clients
receive the refresh token in the response body and store it in secure storage.
"""
from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.services import record

from . import services
from .google import mark_email_verified, verify_google_token
from .models import User, Verification
from .serializers import (
    ChangePasswordSerializer,
    GoogleLoginSerializer,
    LoginSerializer,
    MeSerializer,
    RegisterSerializer,
    RoleSerializer,
    VerificationConfirmSerializer,
    VerificationRequestSerializer,
)


def _is_web(request) -> bool:
    return request.headers.get("X-Client", "").lower() == "web"


def _token_response(request, user: User, status_code=status.HTTP_200_OK, extra=None) -> Response:
    refresh = RefreshToken.for_user(user)
    body = {"access": str(refresh.access_token), "user": MeSerializer(user).data}
    if extra:
        body.update(extra)
    if not _is_web(request):
        body["refresh"] = str(refresh)
    response = Response(body, status=status_code)
    if _is_web(request):
        _set_refresh_cookie(response, str(refresh))
    return response


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        token,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=settings.REFRESH_COOKIE_PATH,
    )


def _expose_codes() -> bool:
    return getattr(settings, "EXPOSE_VERIFICATION_CODES", settings.DEBUG)


class AuthThrottleMixin:
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class RegisterView(AuthThrottleMixin, APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        preferred_language = data.pop("preferred_language")
        user = services.register_user(**data, request=request)
        user.preferred_language = preferred_language
        user.save(update_fields=["preferred_language"])

        debug_codes = {}
        with transaction.atomic():
            for kind in (Verification.Kind.EMAIL, Verification.Kind.PHONE):
                _, code = services.start_verification(user, kind)
                debug_codes[kind] = code
        extra = {"debug_verification_codes": debug_codes} if _expose_codes() else None
        return _token_response(request, user, status.HTTP_201_CREATED, extra)


class LoginView(AuthThrottleMixin, APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            email=serializer.validated_data["email"].lower(),
            password=serializer.validated_data["password"],
        )
        if user is None or user.status in (User.Status.BANNED, User.Status.DELETED):
            return Response(
                {"detail": "Incorrect email or password.", "code": "invalid_credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        record(user, user, "LOGIN", request=request)
        return _token_response(request, user)


class GoogleLoginView(AuthThrottleMixin, APIView):
    """Sign in with a Google ID token.

    Existing email → logged in (Google proves ownership, so accounts link and the
    email counts as verified). New email without signup fields → 200 with
    `signup_required` and the name/email from Google, so the client can ask for
    birth year, phone and role and post again with the same token.
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = GoogleLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        identity = verify_google_token(data["id_token"])

        user = User.objects.filter(email=identity.email).first()
        if user is not None:
            if user.status in (User.Status.BANNED, User.Status.DELETED) or not user.is_active:
                return Response(
                    {"detail": "This account can't sign in.", "code": "account_restricted"},
                    status=status.HTTP_403_FORBIDDEN,
                )
            mark_email_verified(user)
            record(user, user, "LOGIN", request=request, via="google")
            return _token_response(request, user)

        missing = [f for f in ("birth_year", "phone") if f not in data]
        if missing:
            return Response(
                {"signup_required": True, "email": identity.email, "full_name": identity.full_name, "missing": missing}
            )

        with transaction.atomic():
            user = services.register_user(
                full_name=data.get("full_name") or identity.full_name,
                birth_year=data["birth_year"],
                email=identity.email,
                phone=data["phone"],
                password=None,  # unusable password: this account signs in with Google
                roles=data["roles"],
                request=request,
            )
            user.preferred_language = data["preferred_language"]
            user.save(update_fields=["preferred_language"])
            mark_email_verified(user)
            _, code = services.start_verification(user, Verification.Kind.PHONE)
        extra = {"debug_verification_codes": {Verification.Kind.PHONE: code}} if _expose_codes() else None
        return _token_response(request, user, status.HTTP_201_CREATED, extra)


class RefreshView(AuthThrottleMixin, APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        raw = request.data.get("refresh") or request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not raw:
            return Response({"detail": "No refresh token.", "code": "no_refresh"}, status=401)
        try:
            old = RefreshToken(raw)
            user = User.objects.get(id=old["user_id"], is_active=True)
            if user.status in (User.Status.BANNED, User.Status.DELETED):
                raise User.DoesNotExist
            old.blacklist()
        except (TokenError, User.DoesNotExist, KeyError):
            response = Response({"detail": "Session expired.", "code": "invalid_refresh"}, status=401)
            response.delete_cookie(settings.REFRESH_COOKIE_NAME, path=settings.REFRESH_COOKIE_PATH)
            return response
        return _token_response(request, user)


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        raw = request.data.get("refresh") or request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(settings.REFRESH_COOKIE_NAME, path=settings.REFRESH_COOKIE_PATH)
        return response


class MeView(APIView):
    def get(self, request):
        return Response(MeSerializer(request.user).data)

    def patch(self, request):
        serializer = MeSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        changed = [f for f in ("email", "phone") if f in serializer.validated_data
                   and serializer.validated_data[f] != getattr(request.user, f)]
        user = serializer.save()
        if changed:
            # Verification is bound to the verified value; a new value needs a new check.
            record(user, user, "CONTACT_CHANGED", request=request, fields=changed)
        return Response(MeSerializer(user).data)

    def delete(self, request):
        """Delete (anonymise) the signed-in account. Body: {"password": "..."} for password accounts."""
        services.delete_account(request.user, password=request.data.get("password", ""), request=request)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(settings.REFRESH_COOKIE_NAME, path=settings.REFRESH_COOKIE_PATH)
        return response


class RolesView(APIView):
    def post(self, request):
        serializer = RoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.add_role(request.user, serializer.validated_data["role"])
        return Response(MeSerializer(request.user).data, status=status.HTTP_201_CREATED)

    def delete(self, request, role: str):
        services.remove_role(request.user, role.upper())
        return Response(MeSerializer(request.user).data)


class SendVerificationView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verification"

    def post(self, request):
        serializer = VerificationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verification, code = services.start_verification(request.user, serializer.validated_data["kind"])
        body = {"kind": verification.kind, "expires_at": verification.expires_at}
        if _expose_codes():
            body["debug_code"] = code
        return Response(body, status=status.HTTP_201_CREATED)


class ConfirmVerificationView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = VerificationConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.confirm_verification(
            request.user, serializer.validated_data["kind"], serializer.validated_data["code"]
        )
        return Response(MeSerializer(request.user).data)


class ChangePasswordView(APIView):
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        record(request.user, request.user, "PASSWORD_CHANGED", request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)
