from rest_framework import status
from rest_framework.exceptions import APIException


class DomainError(APIException):
    """A business-rule violation. `code` is a stable key clients can translate."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "domain_error"

    def __init__(self, detail: str, code: str | None = None, status_code: int | None = None):
        if status_code:
            self.status_code = status_code
        super().__init__(detail={"detail": detail, "code": code or self.default_code})
