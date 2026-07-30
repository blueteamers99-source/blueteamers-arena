from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from apps.participants.services.session_service import SessionService


class ParticipantUserWrapper:
    """
    Lightweight User wrapper object attached to request.user when authenticated via ParticipantToken.
    """
    def __init__(self, participant):
        self.participant = participant
        self.id = participant.id
        self.pk = participant.id
        self.email = participant.email
        self.role = "STUDENT"
        self.is_authenticated = True
        self.is_anonymous = False
        self.is_staff = False
        self.is_superuser = False

    @property
    def is_admin_role(self) -> bool:
        return False

    @property
    def is_super_admin_role(self) -> bool:
        return False

    @property
    def is_student_role(self) -> bool:
        return True

    def __str__(self):
        return f"ParticipantUser ({self.email})"


class ParticipantTokenAuthentication(BaseAuthentication):
    """
    DRF Authentication Class for Student Participants using X-Participant-Token or Authorization: Participant <token>.
    """
    def authenticate_header(self, request):
        return 'Participant realm="api"'

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization")
        token = request.headers.get("X-Participant-Token")

        if not token and auth_header and auth_header.startswith("Participant "):
            token = auth_header.split(" ")[1]

        if not token:
            return None

        participant = SessionService.verify_participant_token(token)
        request.participant = participant
        user_wrapper = ParticipantUserWrapper(participant)
        return (user_wrapper, token)
