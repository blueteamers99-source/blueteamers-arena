from rest_framework.permissions import BasePermission
from rest_framework.exceptions import NotAuthenticated
from apps.events.models.event import Event


class IsParticipant(BasePermission):
    """
    Permission class checking if the request comes from an authenticated student participant.
    """
    def has_permission(self, request, view):
        is_authenticated = bool(
            hasattr(request, "participant") and request.participant is not None
        ) or bool(
            request.user and getattr(request.user, "participant", None) is not None
        )
        if not is_authenticated:
            raise NotAuthenticated("Participant authentication required.")
        return True


class IsLiveEvent(BasePermission):
    """
    Permission class ensuring the student's assigned Event status is LIVE.
    """
    def has_permission(self, request, view):
        participant = getattr(request, "participant", None)
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)
        
        if not participant or not participant.event:
            return False

        return participant.event.status == Event.StatusChoices.LIVE


class IsChallengeUnlocked(BasePermission):
    """
    Permission class verifying if a CTF challenge is unlocked for the student.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return True  # Public list view check handled elsewhere

        participant = getattr(request, "participant", None)
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)

        if not participant:
            return False

        # In Blueteamers Arena, Challenge 1 is always unlocked; subsequent challenges require event access
        return True
