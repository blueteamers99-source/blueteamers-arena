from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response, error_response
from apps.accounts.permissions.is_admin import IsAdmin
from apps.accounts.services.admin_analytics_service import AdminAnalyticsService
from apps.accounts.services.report_service import ReportService
from apps.accounts.serializers.admin_platform_serializer import (
    BulkImportQuestionsSerializer,
    ExportReportRequestSerializer,
)


class AdminPlatformViewSet(viewsets.ViewSet):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in ["dashboard", "event_analytics", "question_analytics"]:
            return [AllowAny()]
        return [IsAdmin()]

    @extend_schema(responses={200: dict})
    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        stats = AdminAnalyticsService.get_platform_dashboard_stats()
        return success_response(data=stats, message="Admin dashboard analytics retrieved.")

    @extend_schema(responses={200: dict})
    @action(detail=False, methods=["get"], url_path="analytics/events")
    def event_analytics(self, request):
        event_id = request.query_params.get("event_id")
        data = AdminAnalyticsService.get_event_analytics(event_id=event_id)
        return success_response(data=data, message="Event analytics retrieved.")

    @extend_schema(responses={200: dict})
    @action(detail=False, methods=["get"], url_path="analytics/questions")
    def question_analytics(self, request):
        data = AdminAnalyticsService.get_question_analytics()
        return success_response(data=data, message="Question analytics retrieved.")

    @extend_schema(request=BulkImportQuestionsSerializer)
    @action(detail=False, methods=["post"], url_path="questions/bulk-import")
    def bulk_import_questions(self, request):
        if "questions" in request.data and isinstance(request.data["questions"], list):
            res = ReportService.import_questions_json(request.data["questions"])
            return success_response(
                data=res,
                message=f"Successfully processed {res['imported_count']} question bank items.",
                status_code=status.HTTP_201_CREATED,
            )
        serializer = BulkImportQuestionsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        res = ReportService.import_questions_json(serializer.validated_data["questions"])
        return success_response(
            data=res,
            message=f"Successfully imported {res['imported_count']} question bank items.",
            status_code=status.HTTP_201_CREATED,
        )

    @extend_schema(summary="File Import Questions (.csv, .xlsx, .json)")
    @action(detail=False, methods=["post"], url_path="questions/import", parser_classes=[MultiPartParser, FormParser, JSONParser])
    def file_import_questions(self, request):
        file_obj = request.FILES.get("file")
        if file_obj:
            res = ReportService.import_questions_file(file_obj)
            return success_response(
                data=res,
                message=f"Imported {res['imported_count']} questions, skipped {res['skipped_count']} duplicates.",
                status_code=status.HTTP_201_CREATED,
            )
        elif "questions" in request.data:
            res = ReportService.import_questions_json(request.data["questions"])
            return success_response(
                data=res,
                message=f"Imported {res['imported_count']} questions.",
                status_code=status.HTTP_201_CREATED,
            )
        return error_response(message="No file or questions list provided in payload.", status_code=status.HTTP_400_BAD_REQUEST)

    @extend_schema(responses={200: list})
    @action(detail=False, methods=["get"], url_path="questions/bulk-export")
    def bulk_export_questions(self, request):
        data = ReportService.export_questions_json()
        return success_response(data=data, message="Question bank exported successfully.")

    @extend_schema(request=ExportReportRequestSerializer)
    @action(detail=False, methods=["post"], url_path="reports/export")
    def export_reports(self, request):
        serializer = ExportReportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        fmt = serializer.validated_data.get("format", "csv")
        event_id = serializer.validated_data.get("event_id")

        if fmt == "csv":
            csv_data = ReportService.export_participants_csv(event_id=str(event_id) if event_id else None)
            response = HttpResponse(csv_data, content_type="text/csv")
            response["Content-Disposition"] = 'attachment; filename="blueteamers_participants_report.csv"'
            return response
        else:
            data = ReportService.export_questions_json()
            return success_response(data=data, message="Report exported successfully.")
