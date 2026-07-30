from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response
from apps.accounts.permissions.is_admin import IsAdmin
from apps.notifications.models.notification import Notification
from apps.notifications.services.notification_service import NotificationService
from apps.notifications.serializers.notification_serializer import (
    NotificationSerializer,
    BroadcastNotificationSerializer,
)


class NotificationViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    def get_user(self, request):
        return request.user if request.user and request.user.is_authenticated else None

    @extend_schema(responses={200: NotificationSerializer(many=True)})
    def list(self, request):
        user = self.get_user(request)
        unread_only = request.query_params.get("unread", "false").lower() == "true"
        notifications = NotificationService.get_user_notifications(user, unread_only=unread_only)
        serializer = NotificationSerializer(notifications, many=True)
        return success_response(
            data={
                "notifications": serializer.data,
                "unread_count": NotificationService.get_unread_count(user),
            },
            message="Notifications retrieved successfully.",
        )

    @extend_schema(responses={200: dict})
    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        user = self.get_user(request)
        count = NotificationService.get_unread_count(user)
        return success_response(data={"unread_count": count}, message="Unread count retrieved.")

    @extend_schema(methods=["post"])
    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        user = self.get_user(request)
        success = NotificationService.mark_as_read(pk, user)
        if not success:
            return success_response(message="Notification not found.", status_code=status.HTTP_404_NOT_FOUND)
        return success_response(message="Notification marked as read.")

    @extend_schema(methods=["post"])
    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        user = self.get_user(request)
        if not user:
            return success_response(message="Authentication required.", status_code=status.HTTP_401_UNAUTHORIZED)
        count = NotificationService.mark_all_as_read(user)
        return success_response(message=f"Marked {count} notifications as read.")

    @extend_schema(request=BroadcastNotificationSerializer)
    @action(detail=False, methods=["post"], url_path="broadcast", permission_classes=[IsAdmin])
    def broadcast(self, request):
        serializer = BroadcastNotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notif = NotificationService.broadcast_global(
            title=serializer.validated_data["title"],
            message=serializer.validated_data["message"],
            priority=serializer.validated_data.get("priority", Notification.PriorityChoices.HIGH),
            action_url=serializer.validated_data.get("action_url", ""),
        )
        return success_response(
            data=NotificationSerializer(notif).data,
            message="Broadcast notification sent successfully!",
        )
