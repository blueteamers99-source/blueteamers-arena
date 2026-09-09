from typing import Dict, Any, Tuple
from django.db.models import Q
from rest_framework_simplejwt.tokens import RefreshToken
from apps.accounts.models.user import User
from apps.accounts.validators.user_validator import UserValidator


class StudentAuthService:
    @staticmethod
    def signup_student(data: Dict[str, Any]) -> Tuple[User, Dict[str, str]]:
        UserValidator.validate_password_strength(data["password"])
        user = User.objects.create_user(
            email=data["email"].strip().lower(),
            username=data["username"].strip().lower(),
            password=data["password"],
            full_name=data.get("full_name", "").strip(),
            college=data.get("college", "").strip(),
            department=data.get("department", "").strip(),
            phone_number=data.get("phone_number", "").strip(),
            role=User.RoleChoices.STUDENT,
        )
        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["email"] = user.email

        tokens = {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
        return user, tokens

    @staticmethod
    def authenticate_student(identifier: str, password: str) -> Tuple[User, Dict[str, str]]:
        query = identifier.strip().lower()
        invalid = ValueError("Invalid email/username or password.")
        try:
            user = User.objects.get(Q(email__iexact=query) | Q(username__iexact=query))
        except User.DoesNotExist:
            user = None

        # Normalized failure: identical for every case so response timing and
        # messages do not reveal whether an account exists or is deactivated.
        if user is None:
            User().set_password("dummy-password-for-timing-normalization")
            User().check_password(password)
            raise invalid

        if not user.check_password(password) or not user.is_active:
            raise invalid

        # Role enforcement (H-10): the student login endpoint must only ever
        # mint student-context tokens. Admin / super-admin accounts must use
        # the dedicated admin portal login (admin/login). A uniform message
        # keeps us consistent with the generic invalid-credentials response
        # (no account enumeration).
        if user.role != User.RoleChoices.STUDENT:
            raise ValueError("This account must use the admin portal to sign in.")

        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["email"] = user.email

        tokens = {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
        return user, tokens
