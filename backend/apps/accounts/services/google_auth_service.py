from typing import Dict, Any, Tuple
from rest_framework_simplejwt.tokens import RefreshToken
from apps.accounts.models.user import User


class GoogleAuthService:
    @staticmethod
    def authenticate_google_student(email: str, name: str = "") -> Tuple[User, Dict[str, str]]:
        clean_email = email.strip().lower()
        if not clean_email:
            raise ValueError("Invalid Google OAuth credential payload.")

        try:
            user = User.objects.get(email__iexact=clean_email)
        except User.DoesNotExist:
            # Auto-create Student Account on first Google Login
            base_username = clean_email.split("@")[0]
            username = base_username
            counter = 1
            while User.objects.filter(username__iexact=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            user = User.objects.create_user(
                email=clean_email,
                username=username,
                full_name=name or base_username.capitalize(),
                role=User.RoleChoices.STUDENT,
                is_email_verified=True,
            )

        if not user.is_active:
            raise ValueError("Your account has been suspended.")

        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["email"] = user.email

        tokens = {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
        return user, tokens
