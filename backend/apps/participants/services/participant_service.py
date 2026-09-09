from typing import Dict, Any
from django.db import IntegrityError, transaction
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

        # Rule 0: Event Status Check — only LIVE events accept registrations
        if event.status != Event.StatusChoices.LIVE:
            raise ValidationError({
                "detail": "This event is not currently accepting registrations.",
                "message": "This event is not currently accepting registrations."
            })

        # Rule 0b: Registration Window — open_at and close_at checks
        now = timezone.now()
        if event.registration_open_at and now < event.registration_open_at:
            raise ValidationError({
                "detail": "Event registration has not opened yet.",
                "message": "Event registration has not opened yet."
            })
        if event.registration_close_at and now > event.registration_close_at:
            raise ValidationError({
                "detail": "Event registration has expired.",
                "message": "Event registration has expired."
            })

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
        # Use get_or_create for atomicity — prevents race condition when
        # two tabs register the same email simultaneously (check-then-create → 500).
        # The DB unique_together(event, email) is the backstop; if two concurrent
        # inserts both pass the app-level lookup, the loser re-fetches the winner.
        try:
            with transaction.atomic():
                participant, created = Participant.objects.get_or_create(
                    event=event,
                    email=email,
                    defaults={
                        'name': name,
                        'started_at': timezone.now(),
                    },
                )
                return participant
        except IntegrityError:
            # True simultaneous insert: another request created the row first.
            return Participant.objects.get(event=event, email__iexact=email)
