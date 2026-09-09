from django.db import models
from apps.common.models.base import BaseModel
from apps.events.models.event import Event


class Challenge(BaseModel):
    """
    CTF Investigation Challenge Model (e.g. Operation PhishNet, Alert Storm, AI Defender, Incident Zero, Final Hunt).
    """
    class DifficultyChoices(models.TextChoices):
        EASY = "Easy", "Easy"
        MEDIUM = "Medium", "Medium"
        HARD = "Hard", "Hard"

    challenge_number = models.PositiveIntegerField(unique=True, db_index=True)
    slug = models.SlugField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    description = models.TextField()
    brief = models.TextField()
    difficulty = models.CharField(max_length=20, choices=DifficultyChoices.choices, default=DifficultyChoices.EASY)
    duration_minutes = models.PositiveIntegerField(default=20)
    points = models.PositiveIntegerField(default=100)
    passing_percentage = models.PositiveIntegerField(default=60, help_text="Minimum percentage score to pass this challenge (0-100).")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="challenges", null=True, blank=True)
    skills = models.JSONField(default=list, blank=True)
    objectives = models.JSONField(default=list, blank=True)

    class Meta:
        verbose_name = "Challenge"
        verbose_name_plural = "Challenges"
        ordering = ["challenge_number"]
        indexes = [
            models.Index(fields=["slug"]),
            models.Index(fields=["challenge_number"]),
            models.Index(fields=["difficulty"]),
        ]

    def __str__(self):
        return f"Challenge {self.challenge_number}: {self.name}"
