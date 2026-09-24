from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response
from apps.participants.auth.participant_auth import LeaderboardTokenAuthentication
from apps.participants.permissions.is_participant import IsParticipant
from apps.leaderboard.services.leaderboard_service import LeaderboardService
from apps.leaderboard.serializers.leaderboard_serializer import LeaderboardResponseSerializer


class LeaderboardViewSet(viewsets.ViewSet):
    """
    Event leaderboard — authentication REQUIRED, event scope derived from token.

    Security invariants:
    - No anonymous access (no AllowAny): a participant token is mandatory.
    - The event shown is ALWAYS the participant's own event (request.participant.event).
    - Client-supplied event_id / event_code / search-event params are IGNORED, so a
      participant of event A can never read event B's standings (cross-tenant isolation).
    - Uses LeaderboardTokenAuthentication so participants of COMPLETED events can
      still view final standings — but nothing else in the platform accepts those.
    """
    authentication_classes = [LeaderboardTokenAuthentication]
    permission_classes = [IsParticipant]

    @extend_schema(responses={200: LeaderboardResponseSerializer})
    def list(self, request):
        participant = getattr(request, "participant", None)
        if participant is None:
            participant = getattr(request.user, "participant", None)
        if participant is None:
            return Response(
                {"success": False, "message": "Participant authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            data = LeaderboardService.get_event_leaderboard(
                event=participant.event,
                search_query=request.query_params.get("search"),
                student_participant=participant,
            )
        except Exception:
            return Response(
                {"success": False, "message": "Event not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return success_response(data=data, message="Leaderboard retrieved successfully.")

    @extend_schema(responses={200: LeaderboardResponseSerializer})
    @action(detail=False, methods=["get"], url_path="current")
    def current(self, request):
        # Kept for backward compatibility of the client; identical semantics to
        # list() — the token's own event, always.
        return self.list(request)
