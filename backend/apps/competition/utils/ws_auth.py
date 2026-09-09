import jwt
from typing import Tuple, Optional
from django.conf import settings
from apps.accounts.models.user import User
from apps.participants.models.participant import Participant


def resolve_ws_auth(scope: dict) -> Tuple[Optional[User], Optional[Participant]]:
    """
    Extracts and verifies JWT token from WebSocket connection scope.
    Supports `Authorization` header only.
    Returns (user, participant).
    """
    # Check headers: Authorization: Bearer <token>
    headers = dict(scope.get("headers", []))
    auth_header = headers.get(b"authorization", b"").decode("utf-8")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]

    # Check existing scope user
    scope_user = scope.get("user")
    if scope_user and scope_user.is_authenticated:
        participant = getattr(scope_user, "participant", None)
        return scope_user, participant

    if not token:
        return None, None

    return _decode_token(token)


def resolve_token_from_message(data: dict) -> Tuple[Optional[User], Optional[Participant]]:
    """
    Extracts and verifies JWT token from a WebSocket message payload.
    Expected format: { "token": "<jwt>" }
    Returns (user, participant).
    """
    token = data.get("token")
    if not token:
        return None, None
    return _decode_token(token)


def _decode_token(token: str) -> Tuple[Optional[User], Optional[Participant]]:
    """
    Decode and verify a JWT token. Returns (user, participant).
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])

        # Check participant token payload
        participant_id = payload.get("participant_id")
        if participant_id:
            p = Participant.objects.select_related("event").filter(id=participant_id).first()
            if p:
                return None, p

        # Check user token payload
        user_id = payload.get("user_id") or payload.get("sub")
        if user_id:
            u = User.objects.filter(id=user_id).first()
            if u:
                participant = Participant.objects.select_related("event").filter(email__iexact=u.email).first()
                return u, participant

    except Exception:
        pass

    return None, None
