from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response
from apps.participants.models.participant import Participant
from apps.participants.auth.participant_auth import ParticipantTokenAuthentication
from apps.participants.permissions.is_participant import IsParticipant
from apps.participants.services.dashboard_service import DashboardService
from apps.participants.serializers.dashboard_serializer import DashboardSerializer


class DashboardViewSet(viewsets.ViewSet):
    authentication_classes = [ParticipantTokenAuthentication]
    permission_classes = [AllowAny]

    def _resolve_participant(self, request):
        # 1. From ParticipantTokenAuthentication / request.user
        participant = getattr(request, "participant", None)
        if not participant and hasattr(request, "user") and request.user:
            participant = getattr(request.user, "participant", None)
        if participant:
            return participant

        # 2. From JWT headers / Bearer token payload
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                import jwt
                from django.conf import settings
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                p_id = payload.get("participant_id")
                if p_id:
                    return Participant.objects.filter(id=p_id).first()
            except Exception:
                pass

        return None

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
                "time_left": dashboard_data["time_remaining"].get("seconds_remaining", 3600),
                "event": dashboard_data["current_event"]["workshop_name"],
                "college": dashboard_data["current_event"]["college_name"],
                "data": dashboard_data,
                "message": "Dashboard metrics retrieved successfully.",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="me", permission_classes=[AllowAny])
    def me(self, request):
        return self.list(request)
