from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("full_name", "Administrator")
        extra.setdefault("birth_year", 1990)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """Identity/account. Contact details here are private and never exposed publicly."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE"
        SUSPENDED = "SUSPENDED"
        BANNED = "BANNED"
        DELETED = "DELETED"

    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=120)
    birth_year = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)
    preferred_language = models.CharField(max_length=5, default="vi")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    def __str__(self):
        return f"{self.full_name} <{self.email}>"

    @property
    def age_by_birth_year(self) -> int:
        return timezone.now().year - self.birth_year

    @property
    def is_demo(self) -> bool:
        """Example account created by seed_demo (.local addresses can't receive mail, so no real user has one)."""
        return self.email.endswith("@tour-op.local")

    def has_role(self, role: str) -> bool:
        return self.roles.filter(role=role).exists()

    @property
    def role_list(self) -> list[str]:
        return sorted(self.roles.values_list("role", flat=True))

    def is_verified(self, kind: str) -> bool:
        target = {Verification.Kind.EMAIL: self.email, Verification.Kind.PHONE: self.phone}.get(kind)
        qs = self.verifications.filter(kind=kind, status=Verification.Status.VERIFIED)
        if target is not None:
            qs = qs.filter(target=target)
        return qs.exists()

    @property
    def contacts_verified(self) -> bool:
        """Both email and phone verified (the full contact badge set)."""
        return self.is_verified(Verification.Kind.EMAIL) and self.is_verified(Verification.Kind.PHONE)

    @property
    def has_verified_contact(self) -> bool:
        """At least one of email/phone verified: the minimum for a traveler to book."""
        return self.is_verified(Verification.Kind.EMAIL) or self.is_verified(Verification.Kind.PHONE)

    @property
    def unverified_contacts(self) -> list[str]:
        """Contact kinds not yet verified, e.g. ["PHONE"]; shown to the other side."""
        return [k for k in (Verification.Kind.EMAIL, Verification.Kind.PHONE) if not self.is_verified(k)]


class UserRole(models.Model):
    class Role(models.TextChoices):
        TRAVELER = "TRAVELER"
        LOCAL = "LOCAL"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="roles")
    role = models.CharField(max_length=10, choices=Role.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "role"], name="uniq_user_role")]

    def __str__(self):
        return f"{self.user_id}:{self.role}"


class Verification(models.Model):
    """Verification is separate from authentication: proving control of a contact
    channel (or identity) is a trust signal, not a login mechanism."""

    class Kind(models.TextChoices):
        EMAIL = "EMAIL"
        PHONE = "PHONE"
        IDENTITY = "IDENTITY"

    class Status(models.TextChoices):
        PENDING = "PENDING"
        VERIFIED = "VERIFIED"
        FAILED = "FAILED"
        EXPIRED = "EXPIRED"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="verifications")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    # The email/phone value that was verified; changing it invalidates the badge.
    target = models.CharField(max_length=254, blank=True)
    code_hash = models.CharField(max_length=128, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    expires_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user_id} {self.kind} {self.status}"
