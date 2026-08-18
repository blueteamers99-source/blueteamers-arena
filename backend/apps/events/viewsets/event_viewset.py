from django.db import models
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema

from apps.common.utils.response import success_response, error_response
from apps.common.throttling import VerifyCodeRateThrottle
from apps.accounts.permissions.is_admin import IsAdmin
from apps.events.models.event import Event
from apps.events.selectors.event_selector import EventSelector
from apps.events.services.event_service import EventService
from apps.events.serializers.event_serializer import EventSerializer, VerifyEventCodeSerializer


class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

    permission_classes = [IsAdmin]

    def get_permissions(self):
        if self.action in ["validate_code", "verify_code"]:
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
    @action(detail=False, methods=["post"], url_path="validate-code", permission_classes=[AllowAny], throttle_classes=[VerifyCodeRateThrottle])
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
    @action(detail=False, methods=["post"], url_path="verify-code", permission_classes=[AllowAny], throttle_classes=[VerifyCodeRateThrottle])
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

    @action(detail=True, methods=["post"], url_path="upload-students", permission_classes=[IsAdmin])
    def upload_students(self, request, pk=None):
        import csv
        import io
        event = self.get_object()
        file_obj = request.FILES.get("file") or request.FILES.get("students")
        if not file_obj:
            return Response(
                {"success": False, "message": "No CSV file uploaded. Please attach a students.csv file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            content = file_obj.read().decode("utf-8-sig", errors="ignore")
            stream = io.StringIO(content)
            reader = csv.reader(stream)
            headers = [h.strip().lower() for h in next(reader, [])]

            name_idx = -1
            email_idx = -1
            for i, h in enumerate(headers):
                if "name" in h:
                    name_idx = i
                elif "email" in h:
                    email_idx = i

            if name_idx == -1 or email_idx == -1:
                return Response(
                    {
                        "success": False,
                        "message": "CSV header must contain 'Registered Name' and 'Registered Email' columns.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            from apps.events.models.approved_student import ApprovedStudent
            created_objects = []
            seen_emails = set()

            for row in reader:
                if not row or len(row) <= max(name_idx, email_idx):
                    continue
                name_val = row[name_idx].strip()
                email_val = row[email_idx].strip().lower()

                if name_val and email_val and "@" in email_val and email_val not in seen_emails:
                    seen_emails.add(email_val)
                    created_objects.append(
                        ApprovedStudent(
                            event=event,
                            registered_name=name_val,
                            registered_email=email_val,
                        )
                    )

            if created_objects:
                ApprovedStudent.objects.bulk_create(
                    created_objects,
                    ignore_conflicts=True,
                )

            total_count = ApprovedStudent.objects.filter(event=event).count()
            return Response(
                {
                    "success": True,
                    "imported_count": len(created_objects),
                    "total_approved_students": total_count,
                    "event_code": event.event_code,
                    "message": f"Successfully imported {len(created_objects)} approved students for {event.event_code}.",
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"success": False, "message": f"Failed to parse CSV file: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["get", "delete"], url_path="approved-students", permission_classes=[AllowAny])
    def approved_students(self, request, pk=None):
        from apps.events.models.approved_student import ApprovedStudent
        from apps.participants.models.participant import Participant
        event = self.get_object()

        if request.method == "DELETE":
            student_id = request.query_params.get("student_id") or request.data.get("student_id")
            if student_id:
                ApprovedStudent.objects.filter(event=event, id=student_id).delete()
            else:
                ApprovedStudent.objects.filter(event=event).delete()
            return Response({"success": True, "message": "Approved students cleared."}, status=status.HTTP_200_OK)

        q = request.query_params.get("search", "").strip().lower()
        students_qs = ApprovedStudent.objects.filter(event=event)
        if q:
            students_qs = students_qs.filter(models.Q(registered_name__icontains=q) | models.Q(registered_email__icontains=q))

        joined_emails = set(Participant.objects.filter(event=event).values_list("email", flat=True))

        data = []
        for s in students_qs:
            has_joined = s.registered_email in joined_emails
            data.append({
                "id": str(s.id),
                "registered_name": s.registered_name,
                "registered_email": s.registered_email,
                "created_at": s.created_at,
                "has_joined": has_joined,
                "status": "Joined" if has_joined else "Pending",
            })

        return Response(
            {
                "success": True,
                "event_code": event.event_code,
                "csv_uploaded_count": ApprovedStudent.objects.filter(event=event).count(),
                "arena_joined_count": len(joined_emails),
                "pending_count": max(0, ApprovedStudent.objects.filter(event=event).count() - len(joined_emails)),
                "results": data,
                "data": data,
            },
            status=status.HTTP_200_OK,
        )
