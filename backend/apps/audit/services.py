from django.db import models

from .models import AuditLog


def _client_ip(request):
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def record(actor, entity, action: str, request=None, **metadata) -> AuditLog:
    """Record an audit entry. `entity` is a model instance or an (type, id) tuple."""
    if isinstance(entity, models.Model):
        entity_type, entity_id = entity._meta.label_lower, entity.pk
    else:
        entity_type, entity_id = entity
    if actor is not None and not getattr(actor, "is_authenticated", False):
        actor = None
    return AuditLog.objects.create(
        actor=actor,
        entity_type=entity_type,
        entity_id=str(entity_id),
        action=action,
        metadata=metadata,
        ip_address=_client_ip(request),
    )
