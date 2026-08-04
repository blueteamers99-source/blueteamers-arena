from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response
from apps.participants.auth.participant_auth import ParticipantTokenAuthentication
from apps.leaderboard.services.leaderboard_service import LeaderboardService
from apps.leaderboard.serializers.leaderboard_serializer import LeaderboardResponseSerializer


class LeaderboardViewSet(viewsets.ViewSet):
    authentication_classes = [ParticipantTokenAuthentication]
    permission_classes = [AllowAny]

    def _resolve_participant(self, request):
        participant = getattr(request, "participant", None)
        if not participant and hasattr(request, "user") and request.user:
            participant = getattr(request.user, "participant", None)
        if participant:
            return participant

        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                import jwt
                from django.conf import settings
                from apps.participants.models.participant import Participant
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                p_id = payload.get("participant_id")
                if p_id:
                    return Participant.objects.filter(id=p_id).first()
            except Exception:
                pass

        from apps.participants.models.participant import Participant
        email = request.query_params.get("email") or request.data.get("email")
        if email:
            p = Participant.objects.filter(email__iexact=str(email).strip().lower()).first()
            if p:
                return p

        return None

    @extend_schema(responses={200: LeaderboardResponseSerializer})
    def list(self, request):
        event_id = request.query_params.get("event_id")
        event_code = request.query_params.get("event_code")
        search_query = request.query_params.get("search")

        student_participant = self._resolve_participant(request)
        if student_participant and not event_id and not event_code:
            event_id = str(student_participant.event.id)

        data = LeaderboardService.get_event_leaderboard(
            event_id=event_id,
            event_code=event_code,
            search_query=search_query,
            student_participant=student_participant,
        )
        return success_response(data=data, message="Leaderboard retrieved successfully.")

    @extend_schema(responses={200: LeaderboardResponseSerializer})
    @action(detail=False, methods=["get"], url_path="current")
    def current(self, request):
        student_participant = self._resolve_participant(request)
        if student_participant:
            data = LeaderboardService.get_event_leaderboard(
                event=student_participant.event,
                student_participant=student_participant,
            )
            return success_response(data=data, message="Current event leaderboard retrieved successfully.")
        return self.list(request)
