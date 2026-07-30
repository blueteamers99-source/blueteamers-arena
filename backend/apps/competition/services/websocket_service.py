import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class WebSocketService:
    """
    Helper service to dispatch real-time events over Django Channels WebSockets to event groups.
    """
    @staticmethod
    def broadcast_to_event(event_code: str, event_type: str, payload: Dict[str, Any]):
        group_name = f"event_{event_code.lower()}"
        message = {
            "type": "broadcast_event",
            "event": event_type,
            "data": payload,
        }

        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync

            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(group_name, message)
        except Exception as e:
            logger.info(f"WebSocket broadcast to group '{group_name}' skipped (Channel layer offline): {e}")

    @classmethod
    def notify_leaderboard_update(cls, event_code: str, leaderboard_data: Dict[str, Any]):
        cls.broadcast_to_event(event_code, "leaderboard_update", leaderboard_data)

    @classmethod
    def notify_submission_event(cls, event_code: str, submission_data: Dict[str, Any]):
        cls.broadcast_to_event(event_code, "submission_event", submission_data)

    @classmethod
    def notify_competition_completed(cls, event_code: str, completion_data: Dict[str, Any]):
        cls.broadcast_to_event(event_code, "competition_completed", completion_data)

    @classmethod
    def notify_user_notification(cls, user_id: str, data: Dict[str, Any]):
        group_name = "global_notifications"
        message = {
            "type": "notification_push",
            "data": data,
        }
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync

            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(group_name, message)
        except Exception as e:
            logger.info(f"Notification push skipped: {e}")
