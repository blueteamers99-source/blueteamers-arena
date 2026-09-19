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

        # Rule 1: Approved Student Check — HARD GATE.
        # Only students hardcoded into the backend (via CSV upload of the
        # Google Form responses, or Django admin) may register for the event.
        # There is NO open-registration fallback: if the student is not on the
        # approved list, registration is rejected even with a valid event code.
        # Match is case-insensitive on BOTH email and name, because students
        # often type their name differently in the arena than in the form.
        is_approved = ApprovedStudent.objects.filter(
            event=event,
            registered_email__iexact=email,
            registered_name__iexact=name,
        ).exists()

        if not is_approved:
            # Give a precise hint when the email is on the list but the name
            # does not match (most common real-world mixup).
            email_on_list = ApprovedStudent.objects.filter(
                event=event,
                registered_email__iexact=email,
            ).exists()
            if email_on_list:
                raise ValidationError(
                    {
                        "detail": "This email is registered for the event, but the name does not match your Google Form registration. Please enter your name exactly as submitted in the form, or contact the college admins for help.",
                        "message": "This email is registered for the event, but the name does not match your Google Form registration. Please enter your name exactly as submitted in the form, or contact the college admins for help.",
                    }
                )
            raise ValidationError(
                {
                    "detail": "You are not a registered user for this event. Only students who have registered can participate",
                    "message": "You are not a registered user for this event. Only students who have registered can participate",
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
                        # Event-wide timer intentionally NOT started here.
                        # The clock starts only when the student clicks
                        # 'Start Challenge' (ProgressService.start_challenge).
                    },
                )
                return participant
        except IntegrityError:
            # True simultaneous insert: another request created the row first.
            return Participant.objects.get(event=event, email__iexact=email)
