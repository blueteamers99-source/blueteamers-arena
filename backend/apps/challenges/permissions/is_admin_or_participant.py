from rest_framework.permissions import BasePermission
from rest_framework.exceptions import NotAuthenticated
from apps.accounts.models.user import User


class IsAdminOrParticipant(BasePermission):
    """
    Permission for challenge list/retrieve — the only content-bearing endpoints
    that previously allowed anonymous access.

    Access rules:
    - ADMIN / SUPER_ADMIN (valid JWT user)  -> allowed, unrestricted visibility.
    - Authenticated participant (X-Participant-Token / Bearer participant JWT)
      -> allowed, but the viewset scopes the queryset to their own event.
    - Everyone else (no token, garbage token, expired refresh chain, or a plain
      user-token student with no participant record) -> NotAuthenticated, i.e.
      401. There is deliberately no anonymous browsing of challenge content.

    NOTE ON ORDERING: this class must be evaluated BEFORE any permission that
    raises NotAuthenticated (e.g. IsParticipant) if they were ever composed
    with `|`, because DRF short-circuits OR on the first pass. Here it is
    self-contained: admins pass immediately; participants pass via the
    participant check; all failures raise 401.
    """

    def has_permission(self, request, view) -> bool:
        # 1. Admin via standard user JWT (role field is authoritative).
        user = request.user
        if user and getattr(user, "is_authenticated", False) and getattr(user, "role", None) in (
            User.RoleChoices.ADMIN,
            User.RoleChoices.SUPER_ADMIN,
        ):
            return True

        # 2. Participant via ParticipantTokenAuthentication (request.participant)
        #    or a user object carrying a participant relation (e.g. staff-side
        #    force_authenticate in tests / admin panel relations).
        participant = getattr(request, "participant", None)
        if participant is None and user is not None:
            participant = getattr(user, "participant", None)
        if participant is not None:
            return True

        raise NotAuthenticated(
            "Authentication required. Join an event to view challenges."
        )
