from django.db import models
from django.utils import timezone
from apps.common.models.base import BaseModel
from apps.participants.models.participant import Participant
from apps.challenges.models.challenge import Challenge


class ParticipantProgress(BaseModel):
    """
    Tracks a student participant's progress status for a specific CTF challenge.
    Server-authoritative store for challenge state, auto-saved draft answers, and timing.
    """
    class StatusChoices(models.TextChoices):
        NOT_STARTED = "not_started", "Not Started"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        EXPIRED = "expired", "Expired"

    participant = models.ForeignKey(Participant, on_delete=models.CASCADE, related_name="challenge_progresses")
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name="participant_progresses")
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.NOT_STARTED,
        db_index=True,
    )
    current_question_index = models.PositiveIntegerField(default=0)
    visited_questions = models.JSONField(default=list, blank=True)
    draft_answers = models.JSONField(default=dict, blank=True)
    score_earned = models.PositiveIntegerField(default=0)
    max_possible_score = models.PositiveIntegerField(default=100)
    time_limit_seconds = models.PositiveIntegerField(default=1200, blank=True)
    started_at = models.DateTimeField(blank=True, null=True)
    last_activity_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True, db_index=True)
    attempt_count = models.PositiveIntegerField(default=1)

    class Meta:
        verbose_name = "Participant Progress"
        verbose_name_plural = "Participant Progresses"
        unique_together = ["participant", "challenge"]
        ordering = ["challenge__challenge_number"]
        indexes = [
            models.Index(fields=["participant", "challenge"]),
            models.Index(fields=["participant", "status"]),
        ]

    def __str__(self):
        return f"{self.participant.name} - {self.challenge.slug} ({self.status})"

    def calculate_remaining_time_seconds(self) -> int:
        """
        Server-authoritative calculation of remaining time in seconds based on started_at and time_limit_seconds.
        """
        if not self.started_at:
            duration_min = getattr(self.challenge, "duration_minutes", 20) or 20
            return int(duration_min * 60)

        duration_sec = self.time_limit_seconds or (getattr(self.challenge, "duration_minutes", 20) * 60)
        elapsed = (timezone.now() - self.started_at).total_seconds()
        remaining = int(duration_sec - elapsed)
        return max(0, remaining)
