import logging

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response
from apps.participants.auth.participant_auth import ParticipantTokenAuthentication
from apps.participants.permissions.is_participant import IsParticipant
from apps.participants.services.dashboard_service import DashboardService
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
                "time_left": dashboard_data["time_remaining"].get("remaining_seconds", 3600),
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
