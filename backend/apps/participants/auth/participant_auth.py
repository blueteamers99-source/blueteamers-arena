import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from apps.participants.services.session_service import SessionService
from apps.participants.models.participant import Participant


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
    DRF Authentication Class for Student Participants using:
    - Authorization: Bearer <token>
    - Authorization: Participant <token>
    - X-Participant-Token: <token>
    """
    def authenticate_header(self, request):
        return 'Bearer realm="api"'

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization", "")
        token = request.headers.get("X-Participant-Token")

        if not token and auth_header:
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
            elif auth_header.startswith("Participant "):
                token = auth_header.split(" ")[1]

        if not token:
            return None

        # 1. Try TimestampSigner session token
        try:
            participant = SessionService.verify_participant_token(token)
            request.participant = participant
            return (ParticipantUserWrapper(participant), token)
        except Exception:
            pass

        # 2. Try JWT token (with participant_id claim)
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            p_id = payload.get("participant_id")
            if p_id:
                participant = Participant.objects.select_related("event").filter(id=p_id).first()
                if participant:
                    request.participant = participant
                    return (ParticipantUserWrapper(participant), token)
        except Exception:
            pass

        return None
