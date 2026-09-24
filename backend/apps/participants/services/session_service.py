from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from rest_framework.exceptions import AuthenticationFailed
from apps.participants.models.participant import Participant
from apps.events.models.event import Event


class SessionService:
    signer = TimestampSigner(salt="blueteamers.participant.session")

    @classmethod
    def generate_participant_token(cls, participant: Participant) -> str:
        data = f"{participant.id}:{participant.event_id}"
        return cls.signer.sign(data)

    @classmethod
    def verify_participant_token(
        cls,
        token: str,
        max_age_seconds: int = 86400,
        allowed_statuses=None,
    ) -> Participant:
        if not token:
            raise AuthenticationFailed("Participant authentication token missing.")

        try:
            unsigned = cls.signer.unsign(token, max_age=max_age_seconds)
            participant_id, event_id = unsigned.split(":")
        except (BadSignature, SignatureExpired, ValueError):
            raise AuthenticationFailed("Invalid or expired participant token. Please re-enter event code.")

        try:
            participant = Participant.objects.select_related("event").get(
                id=participant_id,
                event_id=event_id,
            )
        except Participant.DoesNotExist:
            raise AuthenticationFailed("Participant account not found.")

        # Validate Event Status. Default policy: LIVE only — challenge,
        # progress and certificate endpoints must die with the event. The
        # leaderboard widens this to Completed events so final standings stay
        # viewable after the run ends (see LeaderboardTokenAuthentication).
        if allowed_statuses is None:
            allowed_statuses = [Event.StatusChoices.LIVE]
        if participant.event.status not in allowed_statuses:
            raise AuthenticationFailed(f"Event '{participant.event.college_name}' is currently {participant.event.status.lower()}.")

        return participant
