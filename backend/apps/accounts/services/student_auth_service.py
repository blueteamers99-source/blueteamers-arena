from typing import Dict, Any, Tuple
from django.db.models import Q
from rest_framework_simplejwt.tokens import RefreshToken
from apps.accounts.models.user import User


class StudentAuthService:
    @staticmethod
    def signup_student(data: Dict[str, Any]) -> Tuple[User, Dict[str, str]]:
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
        try:
            user = User.objects.get(Q(email__iexact=query) | Q(username__iexact=query))
        except User.DoesNotExist:
            raise ValueError("Invalid email/username or password.")

        if not user.check_password(password):
            raise ValueError("Invalid email/username or password.")

        if not user.is_active:
            raise ValueError("Your account has been suspended or deactivated.")

        # If user is admin trying to log in through student login, we allow or assign student tokens safely
        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["email"] = user.email

        tokens = {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
        return user, tokens
