from django.db import models
from apps.common.models.base import BaseModel


class Question(BaseModel):
    """
    Question Bank Model for SOC CTF challenges (Phishing, SIEM, AI, Incident Response, Digital Forensics).
    """
    class CategoryChoices(models.TextChoices):
        PHISHING = "Phishing", "Phishing"
        SIEM = "SIEM", "SIEM"
        AI = "AI", "AI"
        INCIDENT_RESPONSE = "Incident Response", "Incident Response"
        DIGITAL_FORENSICS = "Digital Forensics", "Digital Forensics"

    class DifficultyChoices(models.TextChoices):
        EASY = "Easy", "Easy"
        MEDIUM = "Medium", "Medium"
        HARD = "Hard", "Hard"

    class StatusChoices(models.TextChoices):
        DRAFT = "Draft", "Draft"
        PUBLISHED = "Published", "Published"

    class QuestionKindChoices(models.TextChoices):
        TEXT = "text", "Text Input"
        MCQ = "mcq", "Multiple Choice"

    category = models.CharField(max_length=50, choices=CategoryChoices.choices, db_index=True)
    difficulty = models.CharField(max_length=20, choices=DifficultyChoices.choices, db_index=True)
    kind = models.CharField(max_length=10, choices=QuestionKindChoices.choices, default=QuestionKindChoices.TEXT)
    question_text = models.TextField()
    evidence_text = models.TextField(blank=True, null=True)
    options_json = models.JSONField(default=list, blank=True)  # List of strings for MCQ
    correct_answer = models.TextField(blank=True, default="")  # Correct string for text, or option index/value
    correct_option_index = models.IntegerField(default=None, blank=True, null=True)
    explanation = models.TextField(blank=True, null=True)
    default_points = models.PositiveIntegerField(default=10)
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.PUBLISHED,
        db_index=True,
    )

    class Meta:
        verbose_name = "Question"
        verbose_name_plural = "Questions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["category"]),
            models.Index(fields=["difficulty"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"[{self.category}] {self.question_text[:50]}"
