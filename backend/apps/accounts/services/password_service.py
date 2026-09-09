import secrets
from django.core.mail import send_mail
from django.conf import settings
from rest_framework.exceptions import ValidationError, NotFound
from apps.accounts.models.user import User
from apps.accounts.models.password_reset import PasswordResetToken
from apps.accounts.selectors.user_selector import UserSelector
from apps.accounts.validators.user_validator import UserValidator


class PasswordService:
    """
    Business Logic Service for Password Operations (Change Password, Forgot Password, Reset Password).
    """

    @staticmethod
    def change_password(user: User, old_password: str, new_password: str) -> None:
        if not user.check_password(old_password):
            raise ValidationError({"old_password": ["Old password is incorrect."]})

        UserValidator.validate_password_strength(new_password, user=user)
        user.set_password(new_password)
        user.save()

    @staticmethod
    def forgot_password(email: str) -> str:
        user = UserSelector.get_by_email(email)
        if not user:
            # Silent return to prevent user enumeration
            return "If an account with that email exists, password reset instructions have been sent."

        # Invalidate prior unused tokens
        PasswordResetToken.objects.filter(user=user, is_used=False).update(is_used=True)

        token_str = secrets.token_urlsafe(32)
        reset_token = PasswordResetToken.objects.create(
            user=user,
            token=PasswordResetToken.hash_token(token_str),
        )

        reset_url = f"{settings.CORS_ALLOWED_ORIGINS[0]}/admin/reset-password?token={token_str}"
        
        subject = "Blueteamers Arena — Password Reset Instructions"
        message = (
            f"Hello {user.first_name or 'Admin'},\n\n"
            f"You requested a password reset for your Blueteamers Arena account.\n"
            f"Click the link below to reset your password:\n\n{reset_url}\n\n"
            f"This link will expire in 24 hours.\n\n"
            f"If you did not request this, please ignore this email."
        )

        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@blueteamers.io"),
                recipient_list=[user.email],
                fail_silently=True,
            )
        except Exception:
            pass

        return "If an account with that email exists, password reset instructions have been sent."

    @staticmethod
    def reset_password(token_str: str, new_password: str) -> None:
        token_obj = UserSelector.get_valid_password_reset_token(token_str)
        if not token_obj:
            raise ValidationError({"token": ["Invalid or expired password reset token."]})

        user = token_obj.user
        UserValidator.validate_password_strength(new_password, user=user)

        user.set_password(new_password)
        user.save()

        token_obj.is_used = True
        token_obj.save()
