from django.db import models
from apps.common.models.base import BaseModel
from apps.events.models.event import Event


class ApprovedStudent(BaseModel):
    """
    Approved student model created when event organizers upload a student CSV.
    Only students in this table for a given event are authorized to register/enter the arena.
    """
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="approved_students",
        db_index=True,
    )
    registered_name = models.CharField(max_length=200, db_index=True)
    registered_email = models.EmailField(max_length=254, db_index=True)

    class Meta:
        verbose_name = "Approved Student"
        verbose_name_plural = "Approved Students"
        ordering = ["registered_name"]
        unique_together = ["event", "registered_email"]
        indexes = [
            models.Index(fields=["event", "registered_email"]),
            models.Index(fields=["registered_email"]),
        ]

    def save(self, *args, **kwargs):
        if self.registered_email:
            self.registered_email = self.registered_email.strip().lower()
        if self.registered_name:
            self.registered_name = self.registered_name.strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.registered_name} ({self.registered_email}) - {self.event.event_code}"
