from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response
from apps.accounts.permissions.is_admin import IsAdmin
from apps.events.selectors.event_selector import EventSelector
from apps.participants.models.participant import Participant
from apps.participants.selectors.participant_selector import ParticipantSelector
from apps.participants.services.participant_service import ParticipantService
from apps.participants.serializers.participant_serializer import ParticipantSerializer, RegisterStudentSerializer


class ParticipantViewSet(viewsets.ModelViewSet):
    queryset = Participant.objects.all()
    serializer_class = ParticipantSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve", "create", "register_student"]:
            return [AllowAny()]
        return [IsAdmin()]

    def get_queryset(self):
        event_id = self.request.query_params.get("event_id")
        search_query = self.request.query_params.get("search")
        return ParticipantSelector.filter_participants(event_id=event_id, query=search_query)

    def perform_create(self, serializer):
        if "event" not in serializer.validated_data or not serializer.validated_data.get("event"):
            from apps.events.models.event import Event
            event = Event.objects.filter(status="Live").first() or Event.objects.first()
            if not event:
                event = Event.objects.create(
                    college_name="CBIT",
                    workshop_name="SOC Cyber Defense",
                    event_code="CBIT2026",
                    event_date="2026-08-01",
                    status="Live",
                )
            serializer.save(event=event)
        else:
            serializer.save()

    @extend_schema(request=RegisterStudentSerializer, responses={201: ParticipantSerializer})
    @action(detail=False, methods=["post"], url_path="register-student", permission_classes=[AllowAny])
    def register_student(self, request):
        serializer = RegisterStudentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event = EventSelector.get_by_id(serializer.validated_data["event_id"])
        if not event:
            return success_response(message="Event not found", status_code=status.HTTP_404_NOT_FOUND)

        participant = ParticipantService.register_participant(
            event=event,
            name=serializer.validated_data["name"],
            email=serializer.validated_data["email"],
        )
        return success_response(
            data=ParticipantSerializer(participant).data,
            message="Student registered successfully.",
            status_code=status.HTTP_201_CREATED,
        )
