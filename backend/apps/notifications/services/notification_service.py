from typing import Dict, Any, List, Optional
from django.db.models import Q
from apps.notifications.models.notification import Notification
from apps.notifications.models.notification_read import NotificationRead
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
    def get_user_notifications(user: Optional[User]) -> List[Notification]:
        if not user:
            qs = Notification.objects.filter(recipient__isnull=True)
        else:
            # Get IDs of notifications this user has read via the junction table
            read_ids = NotificationRead.objects.filter(
                user=user
            ).values_list("notification_id", flat=True)

            # Personal notifications + broadcasts not yet read by this user
            qs = Notification.objects.filter(
                Q(recipient=user) | Q(recipient__isnull=True)
            ).exclude(id__in=read_ids)

        # NOTE: unread state is fully determined by the per-user
        # NotificationRead junction table. We deliberately do NOT filter on
        # the shared Notification.is_read flag here: that flag lives on a
        # single row shared by every user for broadcast (recipient=None)
        # notifications, so filtering on it would leak one user's read state
        # to all other users (M-04).
        return list(qs.order_by("-created_at")[:50])

    @staticmethod
    def mark_as_read(notification_id: str, user: Optional[User] = None) -> bool:
        # Read state is always tracked per-user via the NotificationRead
        # junction table. Without a user we must not mutate the shared
        # Notification.is_read flag, since broadcast notifications
        # (recipient=None) are one shared row across all users (M-04).
        if not user:
            return False
        try:
            notification = Notification.objects.get(id=notification_id)
            NotificationRead.objects.get_or_create(
                notification=notification,
                user=user,
            )
            return True
        except Notification.DoesNotExist:
            return False
        except Exception:
            return False

    @staticmethod
    def mark_all_as_read(user: User) -> int:
        # Find notifications visible to this user that they haven't read yet
        read_ids = NotificationRead.objects.filter(
            user=user
        ).values_list("notification_id", flat=True)

        unread_notifications = Notification.objects.filter(
            Q(recipient=user) | Q(recipient__isnull=True),
        ).exclude(id__in=read_ids)

        # Create read records for each (per-user tracking)
        read_entries = [
            NotificationRead(notification=notif, user=user)
            for notif in unread_notifications
        ]
        NotificationRead.objects.bulk_create(read_entries, ignore_conflicts=True)

        return len(read_entries)

    @staticmethod
    def get_unread_count(user: Optional[User]) -> int:
        if not user:
            return 0

        # Get IDs of notifications this user has read via the junction table
        read_ids = NotificationRead.objects.filter(
            user=user
        ).values_list("notification_id", flat=True)

        return Notification.objects.filter(
            Q(recipient=user) | Q(recipient__isnull=True),
        ).exclude(id__in=read_ids).count()
