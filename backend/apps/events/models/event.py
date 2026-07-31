from django.db import models
from apps.common.models.base import BaseModel
from apps.accounts.models.user import User


class Event(BaseModel):
    """
    Event model for Blueteamers Arena workshops and competitions across colleges.
    """
    class StatusChoices(models.TextChoices):
        UPCOMING = "Upcoming", "Upcoming"
        LIVE = "Live", "Live"
        COMPLETED = "Completed", "Completed"

    college_name = models.CharField(max_length=150, db_index=True)
    workshop_name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    event_code = models.CharField(max_length=50, unique=True, db_index=True)
    event_date = models.DateField()
    duration_minutes = models.PositiveIntegerField(default=60)
    passing_score = models.PositiveIntegerField(default=600)
    total_challenges = models.PositiveIntegerField(default=5)
    accent_color = models.CharField(max_length=20, default="blue")
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.UPCOMING,
        db_index=True,
    )
    banner_image = models.CharField(max_length=500, blank=True, null=True, default="")
    banner_image_url = models.CharField(max_length=500, blank=True, null=True, default="")
    auto_publish = models.BooleanField(default=True)
    auto_close = models.BooleanField(default=True)
    registration_open_at = models.DateTimeField(blank=True, null=True)
    registration_close_at = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_events",
    )

    class Meta:
        verbose_name = "Event"
        verbose_name_plural = "Events"
        ordering = ["-event_date", "-created_at"]
        indexes = [
            models.Index(fields=["event_code"]),
            models.Index(fields=["status"]),
            models.Index(fields=["college_name"]),
        ]

    def __str__(self):
        return f"{self.college_name} - {self.workshop_name} ({self.event_code})"
