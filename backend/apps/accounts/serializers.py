from django.contrib.auth import password_validation
from rest_framework import serializers

from apps.common.exceptions import DomainError
from apps.common.fields import ContactSafeCharField

from .models import User, UserRole, Verification
from .services import normalize_phone, validate_birth_year


def _domain_to_validation(fn, value):
    try:
        return fn(value)
    except DomainError as exc:
        raise serializers.ValidationError(exc.detail["detail"], code=exc.detail["code"])


class RegisterSerializer(serializers.Serializer):
    full_name = ContactSafeCharField(max_length=120)
    birth_year = serializers.IntegerField()
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=32)
    password = serializers.CharField(write_only=True, min_length=8)
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=UserRole.Role.choices),
        allow_empty=False,
        default=[UserRole.Role.TRAVELER],
    )
    preferred_language = serializers.ChoiceField(choices=["vi", "en"], default="vi")

    def validate_full_name(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Enter your name.")
        return value

    def validate_birth_year(self, value):
        return _domain_to_validation(validate_birth_year, value)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("This email is already registered.", code="email_taken")
        return value

    def validate_phone(self, value):
        phone = _domain_to_validation(normalize_phone, value)
        if User.objects.filter(phone=phone).exists():
            raise serializers.ValidationError("This phone number is already registered.", code="phone_taken")
        return phone

    def validate(self, attrs):
        password_validation.validate_password(
            attrs["password"], User(email=attrs["email"], full_name=attrs["full_name"])
        )
        return attrs


class GoogleLoginSerializer(serializers.Serializer):
    """`id_token` alone logs in an existing account. A new person also sends the
    fields our rules require; `full_name` defaults to the name on the Google account."""

    id_token = serializers.CharField()
    full_name = ContactSafeCharField(max_length=120, required=False)
    birth_year = serializers.IntegerField(required=False)
    phone = serializers.CharField(max_length=32, required=False)
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=UserRole.Role.choices),
        allow_empty=False,
        default=[UserRole.Role.TRAVELER],
    )
    preferred_language = serializers.ChoiceField(choices=["vi", "en"], default="vi")

    validate_birth_year = RegisterSerializer.validate_birth_year
    validate_phone = RegisterSerializer.validate_phone


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class MeSerializer(serializers.ModelSerializer):
    """The owner's private account view. Never used for other users."""

    roles = serializers.SerializerMethodField()
    email_verified = serializers.SerializerMethodField()
    phone_verified = serializers.SerializerMethodField()
    identity_verified = serializers.SerializerMethodField()
    has_password = serializers.SerializerMethodField()
    age_by_birth_year = serializers.IntegerField(read_only=True)
    full_name = ContactSafeCharField(max_length=120)

    class Meta:
        model = User
        fields = [
            "id", "email", "phone", "full_name", "birth_year", "age_by_birth_year",
            "status", "preferred_language", "roles", "email_verified", "phone_verified",
            "identity_verified", "has_password", "is_staff", "date_joined",
        ]
        read_only_fields = ["id", "status", "is_staff", "date_joined"]

    def get_roles(self, obj):
        return obj.role_list

    def get_has_password(self, obj):
        # False for accounts created with Google only; deleting those needs no password.
        return obj.has_usable_password()

    def get_email_verified(self, obj):
        return obj.is_verified(Verification.Kind.EMAIL)

    def get_phone_verified(self, obj):
        return obj.is_verified(Verification.Kind.PHONE)

    def get_identity_verified(self, obj):
        return obj.is_verified(Verification.Kind.IDENTITY)

    def validate_birth_year(self, value):
        return _domain_to_validation(validate_birth_year, value)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("This email is already registered.", code="email_taken")
        return value

    def validate_phone(self, value):
        phone = _domain_to_validation(normalize_phone, value)
        if User.objects.filter(phone=phone).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("This phone number is already registered.", code="phone_taken")
        return phone


class RoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=UserRole.Role.choices)


class VerificationRequestSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=[Verification.Kind.EMAIL, Verification.Kind.PHONE])


class VerificationConfirmSerializer(VerificationRequestSerializer):
    code = serializers.CharField(max_length=10)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": "Incorrect password."})
        password_validation.validate_password(attrs["new_password"], user)
        return attrs
