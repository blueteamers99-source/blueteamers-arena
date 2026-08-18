import urllib.parse
import jwt
from typing import Tuple, Optional, Any
from django.conf import settings
from apps.accounts.models.user import User
from apps.participants.models.participant import Participant


def resolve_ws_auth(scope: dict) -> Tuple[Optional[User], Optional[Participant]]:
    """
    Extracts and verifies JWT token from WebSocket connection scope.
    Supports query parameter `?token=<jwt>` or `Authorization` header.
    Returns (user, participant).
    """
    # 1. Check query string: ?token=...
    query_string = scope.get("query_string", b"").decode("utf-8")
    query_params = urllib.parse.parse_qs(query_string)
    token = None
    if "token" in query_params:
        token = query_params["token"][0]

    # 2. Check headers: Authorization: Bearer <token>
    if not token:
        headers = dict(scope.get("headers", []))
        auth_header = headers.get(b"authorization", b"").decode("utf-8")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    # 3. Check existing scope user
    scope_user = scope.get("user")
    if scope_user and scope_user.is_authenticated:
        participant = getattr(scope_user, "participant", None)
        return scope_user, participant

    if not token:
        return None, None

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
