from rest_framework import viewsets, status
from rest_framework.response import Response
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

    permission_classes = [IsAdmin]

    def get_permissions(self):
        if self.action == "register_student":
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
        if not serializer.is_valid():
            return Response(
                {"success": False, "message": "Invalid registration data."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.events.models.event import Event
        event_code = serializer.validated_data.get("event_code") or serializer.validated_data.get("event_id")
        event = Event.objects.filter(event_code__iexact=str(event_code)).first() or EventSelector.get_by_id(event_code)
        if not event:
            return Response({"success": False, "message": "Event not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            participant = ParticipantService.register_participant(
                event=event,
                name=serializer.validated_data["name"],
                email=serializer.validated_data["email"],
            )
            tokens = ParticipantService.generate_tokens_for_participant(participant)
            return Response(
                {
                    "success": True,
                    "tokens": tokens,
                    "access": tokens["access"],
                    "refresh": tokens["refresh"],
                    "data": ParticipantSerializer(participant).data,
                    "participant": ParticipantSerializer(participant).data,
                    "message": "Student registered successfully.",
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            msg = getattr(e, "detail", str(e))
            if isinstance(msg, dict):
                msg = msg.get("message") or msg.get("detail") or str(msg)
            elif isinstance(msg, list) and msg:
                msg = str(msg[0])
            return Response(
                {"success": False, "message": str(msg)},
                status=status.HTTP_400_BAD_REQUEST,
            )
