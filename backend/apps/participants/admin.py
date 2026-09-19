from django.contrib import admin
from apps.participants.models.participant import Participant
from apps.participants.models.participant_progress import ParticipantProgress
from apps.participants.models.participant_draft import ParticipantDraftAnswer
from apps.events.models.approved_student import ApprovedStudent


@admin.register(Participant)
class ParticipantAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "event", "score", "completed", "started_at", "finished_at", "created_at")
    list_filter = ("event", "completed")
    search_fields = ("name", "email", "event__event_code", "event__college_name")
    ordering = ("-score", "finished_at", "-created_at")

    def save_model(self, request, obj, form, change):
        """Whitelist convenience: adding a Participant from Django admin also
        adds them to the event's Approved Students list, so the registration
        gate accepts them. (Admin-created rows are treated as pre-approved.)"""
        super().save_model(request, obj, form, change)
        if obj.event_id and obj.email:
            ApprovedStudent.objects.get_or_create(
                event=obj.event,
                registered_email__iexact=obj.email,
                defaults={"registered_name": obj.name, "registered_email": obj.email},
            )


@admin.register(ParticipantProgress)
class ParticipantProgressAdmin(admin.ModelAdmin):
    list_display = ("participant", "challenge", "status", "current_question_index", "score_earned", "started_at", "completed_at")
    list_filter = ("status", "challenge")
    search_fields = ("participant__name", "participant__email", "challenge__slug")


@admin.register(ParticipantDraftAnswer)
class ParticipantDraftAnswerAdmin(admin.ModelAdmin):
    list_display = ("participant", "challenge", "question", "updated_at")
    list_filter = ("challenge",)
    search_fields = ("participant__name", "participant__email", "answer_text")
