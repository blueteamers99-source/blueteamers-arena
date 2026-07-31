from django.db import models
from apps.common.models.base import BaseModel
from apps.accounts.models.user import User


class Notification(BaseModel):
    """
    Enterprise Notification Model supporting In-App, Email, System, Event, Challenge, and Broadcast alerts.
    """
    class TypeChoices(models.TextChoices):
        IN_APP = "IN_APP", "In-App"
        EMAIL = "EMAIL", "Email"
        SYSTEM = "SYSTEM", "System Alert"
        EVENT = "EVENT", "Event Update"
        CHALLENGE = "CHALLENGE", "Challenge Update"
        BROADCAST = "BROADCAST", "Broadcast Notification"

    class PriorityChoices(models.TextChoices):
        LOW = "LOW", "Low"
        NORMAL = "NORMAL", "Normal"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
        db_index=True,
        help_text="Null for global broadcast notifications",
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=20,
        choices=TypeChoices.choices,
        default=TypeChoices.IN_APP,
        db_index=True,
    )
    priority = models.CharField(
        max_length=10,
        choices=PriorityChoices.choices,
        default=PriorityChoices.NORMAL,
        db_index=True,
    )
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    action_url = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
            models.Index(fields=["notification_type", "created_at"]),
            models.Index(fields=["is_read", "created_at"]),
        ]

    def __str__(self):
        target = self.recipient.email if self.recipient else "GLOBAL BROADCAST"
        return f"[{self.notification_type}] {self.title} → {target}"
