from rest_framework.exceptions import NotAuthenticated
from rest_framework.permissions import BasePermission
from apps.accounts.models.user import User


class IsAdminOrParticipant(BasePermission):
    """
    Allows an authenticated staff user OR an authenticated student participant.

    Used by the public question browser so the question bank is never readable
    by an anonymous caller. Admins see the whole bank; participants are further
    narrowed to their own event by the viewset's get_queryset().

    Raises NotAuthenticated (401) rather than returning False so the response
    is an explicit "log in" instead of an ambiguous 403 — the question bank is
    gated on identity, not on authorisation of an already-known caller.
    """

    def has_permission(self, request, view):
        user = getattr(request, "user", None)

        # ParticipantTokenAuthentication sets role="STUDENT" on its wrapper, so a
        # participant can never satisfy the staff branch below.
        if user is not None and getattr(user, "is_authenticated", False):
            if getattr(user, "role", None) in [User.RoleChoices.ADMIN, User.RoleChoices.SUPER_ADMIN]:
                return True

        participant = getattr(request, "participant", None)
        if participant is None and user is not None:
            participant = getattr(user, "participant", None)
        if participant is not None:
            return True

        raise NotAuthenticated("Authentication required.")
