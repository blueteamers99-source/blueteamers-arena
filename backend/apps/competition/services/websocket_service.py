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
        """Send leaderboard update to the correct group.

        LeaderboardConsumer joins ``leaderboard_{event_code}`` and handles
        ``type: "leaderboard_update"`` — so we must target that group
        directly instead of using ``broadcast_to_event`` (which sends to
        ``event_{code}`` with ``type: "broadcast_event"``).
        """
        group_name = f"leaderboard_{event_code.lower()}"
        message = {
            "type": "leaderboard_update",
            "data": leaderboard_data,
        }
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync

            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(group_name, message)
        except Exception as e:
            logger.info(f"Leaderboard push to '{group_name}' skipped: {e}")

    @classmethod
    def notify_submission_event(cls, event_code: str, submission_data: Dict[str, Any]):
        cls.broadcast_to_event(event_code, "submission_event", submission_data)

    @classmethod
    def notify_competition_completed(cls, event_code: str, completion_data: Dict[str, Any]):
        cls.broadcast_to_event(event_code, "competition_completed", completion_data)

    @classmethod
    def notify_user_notification(cls, user_id: str, data: Dict[str, Any]):
        """
        Push a notification to the correct WebSocket group.

        - user_id="global"            → broadcast to all connected clients
        - user_id="<participant-uuid>" → private participant group
        - user_id="<user-uuid>"        → private user group
        """
        if user_id == "global":
            group_name = "global_notifications"
        else:
            # UUIDs contain hyphens; participants are sent as
            # "participant_<uuid>" by notification_service, but the
            # default path is a bare UUID (user).
            group_name = f"user_{user_id}"

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
