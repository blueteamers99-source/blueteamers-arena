from django.db import models
from apps.accounts.models.user import User
from apps.notifications.models.notification import Notification


class NotificationRead(models.Model):
    """
    Tracks which users have read which notifications.
    This prevents "mark all read" from affecting other users' read status,
    especially for broadcast notifications (recipient=None).
    """
    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name="read_by",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="read_notifications",
    )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Notification Read"
        verbose_name_plural = "Notifications Read"
        unique_together = ("notification", "user")
        indexes = [
            models.Index(fields=["user", "notification"]),
        ]

    def __str__(self):
        return f"{self.user.email} read {self.notification.title}"
