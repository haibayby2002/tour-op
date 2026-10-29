"""Delivery providers for verification codes. Swap via settings.SMS_PROVIDER."""
import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils.module_loading import import_string

logger = logging.getLogger("tourop.verification")


class SmsProvider:
    def send(self, phone: str, message: str) -> None:
        raise NotImplementedError


class ConsoleSmsProvider(SmsProvider):
    """Development provider: prints the SMS to the server log."""

    def send(self, phone: str, message: str) -> None:
        logger.warning("[SMS to %s] %s", phone, message)


def get_sms_provider() -> SmsProvider:
    return import_string(settings.SMS_PROVIDER)()


def send_email_code(email: str, code: str) -> None:
    ttl = settings.VERIFICATION_CODE_TTL_MINUTES
    send_mail(
        subject="Tour-op verification code / Mã xác minh Tour-op",
        message=(
            f"Your Tour-op verification code is {code}. It expires in {ttl} minutes.\n\n"
            f"Mã xác minh Tour-op của bạn là {code}. Mã hết hạn sau {ttl} phút."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
    )


def send_sms_code(phone: str, code: str) -> None:
    get_sms_provider().send(phone, f"Tour-op: {code}")
