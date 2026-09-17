from django.db import models
from apps.common.models.base import BaseModel
from .challenge import Challenge


class Evidence(BaseModel):
    """
    Evidence model associated with a Challenge (Logs, Headers, JSON telemetry, CSV flows, Screenshots).
    """
    class FormatChoices(models.TextChoices):
        TXT = "TXT", "Text File"
        LOG = "LOG", "Log File"
        JSON = "JSON", "JSON Data"
        CSV = "CSV", "CSV Table"
        PNG = "PNG", "PNG Image"

    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name="evidence_files")
    position = models.PositiveIntegerField(
        default=0,
        db_index=True,
        help_text="Display order of the evidence within its challenge (0 = first resource shown).",
    )
    artifact_key = models.CharField(max_length=100, db_index=True)
    label = models.CharField(max_length=150)
    filename = models.CharField(max_length=150)
    file_format = models.CharField(max_length=10, choices=FormatChoices.choices, default=FormatChoices.TXT)
    content_text = models.TextField(blank=True, null=True)  # Raw text log / json / csv content
    image_url = models.CharField(max_length=500, blank=True, null=True)  # Image URL for PNG evidence
    file_size_display = models.CharField(max_length=50, default="4 KB")

    class Meta:
        verbose_name = "Evidence File"
        verbose_name_plural = "Evidence Files"
        ordering = ["created_at"]
        unique_together = ["challenge", "artifact_key"]
        ordering = ["position", "created_at"]
        indexes = [
            models.Index(fields=["challenge", "artifact_key"]),
            models.Index(fields=["file_format"]),
        ]

    def __str__(self):
        return f"{self.challenge.name} - {self.label} ({self.file_format})"
