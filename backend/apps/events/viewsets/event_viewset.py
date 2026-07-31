from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema

from apps.common.utils.response import success_response, error_response
from apps.accounts.permissions.is_admin import IsAdmin
from apps.events.models.event import Event
from apps.events.selectors.event_selector import EventSelector
from apps.events.services.event_service import EventService
from apps.events.serializers.event_serializer import EventSerializer, VerifyEventCodeSerializer


class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve", "validate_code", "verify_code"]:
            return [AllowAny()]
        return [IsAdmin()]

    def get_queryset(self):
        status_filter = self.request.query_params.get("status")
        search_query = self.request.query_params.get("search")
        return EventSelector.filter_events(status=status_filter, query=search_query)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user if request.user.is_authenticated else None
        event = EventService.create_event(serializer.validated_data, user=user)
        output_serializer = EventSerializer(event)
        
        return Response(
            {
                "success": True,
                "event_code": event.event_code,
                "data": output_serializer.data,
                "message": "Event created successfully.",
            },
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=VerifyEventCodeSerializer)
    @action(detail=False, methods=["post"], url_path="validate-code", permission_classes=[AllowAny])
    def validate_code(self, request):
        serializer = VerifyEventCodeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "message": "Invalid Event Code"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        code_input = serializer.validated_data["event_code"]
        is_valid, message, event = EventService.validate_code(code_input)

        if not is_valid or not event:
            return Response(
                {"success": False, "message": message or "Invalid Event Code"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_data = EventSerializer(event).data
        return Response(
            {
                "success": True,
                "message": message,
                "event": event_data,
                "data": event_data,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(request=VerifyEventCodeSerializer)
    @action(detail=False, methods=["post"], url_path="verify-code", permission_classes=[AllowAny])
    def verify_code(self, request):
        return self.validate_code(request)

    @action(detail=True, methods=["post"], url_path="regenerate-code", permission_classes=[IsAdmin])
    def regenerate_code(self, request, pk=None):
        new_code = EventService.regenerate_event_code(pk)
        return Response(
            {
                "success": True,
                "event_code": new_code,
                "message": f"Event code successfully regenerated: {new_code}",
            },
            status=status.HTTP_200_OK,
        )
