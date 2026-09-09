import hashlib
import uuid
from datetime import timedelta
from django.db import models
from django.utils import timezone
from apps.common.models.base import BaseModel
from .user import User


class PasswordResetToken(BaseModel):
    """
    Password Reset Token Model for secure password reset verification.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_tokens")
    token = models.CharField(max_length=255, unique=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    is_used = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Password Reset Token"
        verbose_name_plural = "Password Reset Tokens"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["token"]),
            models.Index(fields=["expires_at"]),
        ]

    @staticmethod
    def hash_token(token: str) -> str:
        """SHA-256 digest of a password-reset token. The token is high-entropy
        random data (not a memorable password), so a fast hash is appropriate
        and keeps the stored value unusable even if the database is
        compromised. Only the digest is ever persisted; the raw token is sent
        to the user's email."""
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)

    @property
    def is_valid(self) -> bool:
        return not self.is_used and timezone.now() < self.expires_at

    def __str__(self):
        return f"Reset Token for {self.user.email} (Used: {self.is_used})"
