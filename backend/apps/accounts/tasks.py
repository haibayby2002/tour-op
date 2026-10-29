from celery import shared_task

from . import providers


@shared_task
def deliver_verification_code(kind: str, target: str, code: str) -> None:
    if kind == "EMAIL":
        providers.send_email_code(target, code)
    else:
        providers.send_sms_code(target, code)
