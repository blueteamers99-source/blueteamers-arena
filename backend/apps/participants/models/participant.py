from django.db import models
from django.utils import timezone
from apps.common.models.base import BaseModel
from apps.events.models.event import Event


class Participant(BaseModel):
    """
    Student Participant model representing student registration for a specific Event.
    Relationship: One Event -> Many Participants.
    """
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="participants")
    name = models.CharField(max_length=150)
    email = models.EmailField(db_index=True)
    score = models.PositiveIntegerField(default=0, db_index=True)
    completed = models.PositiveIntegerField(default=0)  # Count of completed challenges
    started_at = models.DateTimeField(blank=True, null=True)
    finished_at = models.DateTimeField(blank=True, null=True, db_index=True)

    class Meta:
        verbose_name = "Participant"
        verbose_name_plural = "Participants"
        ordering = ["-score", "finished_at", "-created_at"]
        unique_together = ["event", "email"]
        indexes = [
            models.Index(fields=["event", "email"]),
            models.Index(fields=["event", "score"]),
            models.Index(fields=["score", "finished_at"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.email}) - {self.event.event_code}"

    def get_event_remaining_seconds(self) -> int:
        """
        Server-authoritative event-wide countdown. The single timer for the
        whole event starts when the participant clicks 'Start Challenge'
        (started_at set by ProgressService.start_challenge) and runs for
        event.duration_minutes (2:30:00 by default) across ALL challenges.
        If started_at is None the clock has not started yet and the full
        window is returned.
        """
        duration_min = getattr(self.event, "duration_minutes", 150) or 150
        if not self.started_at:
            return int(duration_min * 60)
        elapsed = (timezone.now() - self.started_at).total_seconds()
        return max(0, int(duration_min * 60 - elapsed))
