from rest_framework import serializers

from .contact_filter import EMAIL, LINK, PHONE, SOCIAL_HANDLE, scan

PROFILE_FORBIDDEN = {PHONE, EMAIL, LINK, SOCIAL_HANDLE}


class ContactSafeCharField(serializers.CharField):
    """CharField that rejects phone numbers, emails, links and social handles.

    Used for public profile text so contact details can't leak through
    display names, bios or service descriptions. Merely mentioning a platform
    ("great Instagram spots") is fine; sharing an actual handle is not.
    """

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if PROFILE_FORBIDDEN.intersection(scan(value).reasons):
            raise serializers.ValidationError(
                "Contact details, links and social handles aren't allowed here. "
                "Please keep communication inside Tour-op.",
                code="contact_info_not_allowed",
            )
        return value
