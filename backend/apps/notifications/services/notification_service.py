from typing import Dict, Any, List, Optional
from django.utils import timezone
from django.db.models import Q
from apps.notifications.models.notification import Notification
from apps.accounts.models.user import User
from apps.competition.services.websocket_service import WebSocketService


class NotificationService:
    @staticmethod
    def send_notification(
        recipient: Optional[User],
        title: str,
        message: str,
        notification_type: str = Notification.TypeChoices.IN_APP,
        priority: str = Notification.PriorityChoices.NORMAL,
        action_url: str = "",
    ) -> Notification:
        notif = Notification.objects.create(
            recipient=recipient,
            title=title,
            message=message,
            notification_type=notification_type,
            priority=priority,
            action_url=action_url,
        )

        # Real-time WebSocket push notification
        WebSocketService.notify_user_notification(
            user_id=str(recipient.id) if recipient else "global",
            data={
                "id": str(notif.id),
                "title": notif.title,
                "message": notif.message,
                "type": notif.notification_type,
                "priority": notif.priority,
                "action_url": notif.action_url,
                "created_at": notif.created_at.isoformat(),
            },
        )
        return notif

    @staticmethod
    def broadcast_global(
        title: str,
        message: str,
        priority: str = Notification.PriorityChoices.HIGH,
        action_url: str = "",
    ) -> Notification:
        return NotificationService.send_notification(
            recipient=None,
            title=title,
            message=message,
            notification_type=Notification.TypeChoices.BROADCAST,
            priority=priority,
            action_url=action_url,
        )

    @staticmethod
    def get_user_notifications(user: Optional[User], unread_only: bool = False) -> List[Notification]:
        if not user:
            qs = Notification.objects.filter(recipient__isnull=True)
        else:
            qs = Notification.objects.filter(Q(recipient=user) | Q(recipient__isnull=True))

        if unread_only:
            qs = qs.filter(is_read=False)

        return list(qs.order_by("-created_at")[:50])

    @staticmethod
    def mark_as_read(notification_id: str, user: Optional[User] = None) -> bool:
        try:
            qs = Notification.objects.filter(id=notification_id)
            if user:
                qs = qs.filter(Q(recipient=user) | Q(recipient__isnull=True))
            count = qs.update(is_read=True, read_at=timezone.now())
            return count > 0
        except Exception:
            return False

    @staticmethod
    def mark_all_as_read(user: User) -> int:
        return Notification.objects.filter(
            Q(recipient=user) | Q(recipient__isnull=True),
            is_read=False,
        ).update(is_read=True, read_at=timezone.now())

    @staticmethod
    def get_unread_count(user: Optional[User]) -> int:
        if not user:
            return Notification.objects.filter(recipient__isnull=True, is_read=False).count()
        return Notification.objects.filter(
            Q(recipient=user) | Q(recipient__isnull=True),
            is_read=False,
        ).count()
