import logging

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response
from apps.participants.auth.participant_auth import ParticipantTokenAuthentication
from apps.participants.permissions.is_participant import IsParticipant
from apps.participants.services.dashboard_service import DashboardService
from apps.participants.services.progress_service import ProgressService
from apps.participants.serializers.dashboard_serializer import DashboardSerializer

logger = logging.getLogger(__name__)


class DashboardViewSet(viewsets.ViewSet):
    authentication_classes = [ParticipantTokenAuthentication]
    permission_classes = [IsParticipant]

    def _resolve_participant(self, request):
        """
        Returns the authenticated participant via DRF auth.
        No manual JWT decode, no fallback chain.
        """
        return getattr(request, "participant", None)

    @extend_schema(responses={200: DashboardSerializer})
    def list(self, request):
        participant = self._resolve_participant(request)
        if not participant:
            return Response(
                {"success": False, "message": "Participant authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        dashboard_data = DashboardService.get_student_dashboard(participant)
        return Response(
            {
                "success": True,
                "name": participant.name,
                "email": participant.email,
                "score": dashboard_data["current_score"],
                "rank": dashboard_data["current_rank"],
                "completed": dashboard_data["completed_challenges"],
                "total": dashboard_data["current_event"]["total_challenges"],
                "progress": dashboard_data["completion_percentage"],
                "time_left": dashboard_data["time_remaining"].get("remaining_seconds", 9000),
                "event": dashboard_data["current_event"]["workshop_name"],
                "college": dashboard_data["current_event"]["college_name"],
                "data": dashboard_data,
                "message": "Dashboard metrics retrieved successfully.",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        return self.list(request)

    @extend_schema(responses={200: dict})
    @action(detail=False, methods=["post"], url_path="start-event-timer")
    def start_event_timer(self, request):
        """
        Explicit 'Start Challenge' click from the dashboard. Idempotently
        starts the single event-wide clock — ticking begins only now, never
        at registration or on dashboard load.
        """
        participant = self._resolve_participant(request)
        if not participant:
            return Response(
                {"success": False, "message": "Participant authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        already_running = participant.started_at is not None
        ProgressService.start_event_clock(participant)
        participant.refresh_from_db(fields=["started_at"])

        remaining = participant.get_event_remaining_seconds()
        return Response(
            {
                "success": True,
                "message": "Event timer already running." if already_running else "Event timer started.",
                "event_started_at": participant.started_at.isoformat() if participant.started_at else None,
                "event_remaining_time_seconds": remaining,
                "time_left": remaining,
            },
            status=status.HTTP_200_OK,
        )
