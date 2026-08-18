from typing import Dict, Any
from django.utils import timezone
from rest_framework.exceptions import ValidationError, NotFound
from rest_framework_simplejwt.tokens import RefreshToken
from apps.events.models.event import Event
from apps.events.models.approved_student import ApprovedStudent
from apps.participants.models.participant import Participant


class ParticipantService:
    @staticmethod
    def generate_tokens_for_participant(participant: Participant) -> Dict[str, str]:
        refresh = RefreshToken()
        refresh["participant_id"] = str(participant.id)
        refresh["event_id"] = str(participant.event.id)
        refresh["college_id"] = str(participant.event.college_name)
        refresh["email"] = participant.email
        refresh["role"] = "PARTICIPANT"

        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "participant_id": str(participant.id),
            "event_id": str(participant.event.id),
        }

    @staticmethod
    def register_participant(event: Event, name: str, email: str) -> Participant:
        name = name.strip()
        email = email.strip().lower()

        if not name:
            raise ValidationError({"name": ["Student name is required."]})
        if not email:
            raise ValidationError({"email": ["College email ID is required."]})

        # Rule 1: Approved Student PostgreSQL Check
        approved_students_count = ApprovedStudent.objects.filter(event=event).count()
        if approved_students_count > 0:
            is_approved = ApprovedStudent.objects.filter(
                event=event,
                registered_email__iexact=email,
            ).exists()

            if not is_approved:
                raise ValidationError(
                    {
                        "detail": "You are not authorized for this event. Please use the same Name and Email that were submitted during registration.",
                        "message": "You are not authorized for this event. Please use the same Name and Email that were submitted during registration.",
                    }
                )

        # Rule 2: Duplicate Joined Protection
        existing_participant = Participant.objects.filter(event=event, email__iexact=email).first()
        if existing_participant:
            # For repeat access, return existing participant safely
            return existing_participant

        participant = Participant.objects.create(
            event=event,
            email=email,
            name=name,
            started_at=timezone.now(),
        )

        return participant
