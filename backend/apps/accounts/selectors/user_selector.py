from typing import Optional, List
from django.db.models import QuerySet
from apps.accounts.models.user import User
from apps.accounts.models.password_reset import PasswordResetToken


class UserSelector:
    """
    Query selector for User data operations (Repository / Selector pattern).
    """

    @staticmethod
    def get_by_id(user_id: str) -> Optional[User]:
        try:
            return User.objects.get(id=user_id)
        except (User.DoesNotExist, ValueError):
            return None

    @staticmethod
    def get_by_email(email: str) -> Optional[User]:
        try:
            return User.objects.get(email__iexact=email.strip())
        except User.DoesNotExist:
            return None

    @staticmethod
    def list_all_active_users() -> QuerySet[User]:
        return User.objects.filter(is_active=True).order_by("-created_at")

    @staticmethod
    def get_valid_password_reset_token(token_str: str) -> Optional[PasswordResetToken]:
        try:
            token_obj = PasswordResetToken.objects.get(
                token=PasswordResetToken.hash_token(token_str),
                is_used=False,
            )
            if token_obj.is_valid:
                return token_obj
            return None
        except PasswordResetToken.DoesNotExist:
            return None
