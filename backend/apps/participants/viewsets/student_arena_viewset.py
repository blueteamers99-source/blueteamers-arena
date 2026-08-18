from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response
from apps.common.throttling import VerifyCodeRateThrottle
from apps.events.services.event_service import EventService
from apps.events.selectors.event_selector import EventSelector
from apps.events.serializers.event_serializer import EventSerializer
from apps.participants.services.participant_service import ParticipantService
from apps.participants.services.session_service import SessionService
from apps.participants.serializers.student_arena_serializer import (
    VerifyEventRequestSerializer,
    RegisterStudentRequestSerializer,
)


class StudentArenaViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    @extend_schema(request=VerifyEventRequestSerializer)
    @action(detail=False, methods=["post"], url_path="verify-code", throttle_classes=[VerifyCodeRateThrottle])
    def verify_code(self, request):
        serializer = VerifyEventRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        event = EventService.verify_event_code(serializer.validated_data["code"])
        event_data = EventSerializer(event).data
        event_data["remaining_slots"] = 100

        return success_response(
            data=event_data,
            message="Event code verified successfully.",
        )

    @extend_schema(request=RegisterStudentRequestSerializer)
    @action(detail=False, methods=["post"], url_path="register")
    def register(self, request):
        serializer = RegisterStudentRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        event = EventSelector.get_by_id(serializer.validated_data["event_id"])
        if not event:
            return success_response(message="Event not found.", status_code=status.HTTP_404_NOT_FOUND)

        participant = ParticipantService.register_participant(
            event=event,
            name=serializer.validated_data["name"],
            email=serializer.validated_data["email"],
        )
        token = SessionService.generate_participant_token(participant)

        return success_response(
            data={
                "participant_token": token,
                "participant": {
                    "id": str(participant.id),
                    "name": participant.name,
                    "email": participant.email,
                    "score": participant.score,
                    "completed": participant.completed,
                },
                "event": EventSerializer(event).data,
            },
            message="Student registered successfully for event.",
            status_code=status.HTTP_201_CREATED,
        )
