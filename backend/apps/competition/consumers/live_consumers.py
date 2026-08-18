import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from apps.competition.utils.ws_auth import resolve_ws_auth
from apps.events.models.event import Event


class EventsConsumer(AsyncWebsocketConsumer):
    """WebSocket Consumer for live event state transitions and status updates."""
    @database_sync_to_async
    def _is_authenticated(self):
        user, participant = resolve_ws_auth(self.scope)
        return bool(user or participant)

    async def connect(self):
        if not await self._is_authenticated():
            await self.close(code=4003)
            return

        self.group_name = "live_events"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({
            "type": "connected",
            "channel": "events",
            "message": "Subscribed to live event updates stream.",
        }))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get("action") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def event_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))


class LeaderboardConsumer(AsyncWebsocketConsumer):
    """WebSocket Consumer for live score and rank updates."""
    @database_sync_to_async
    def _verify_auth_and_event(self, event_code: str):
        user, participant = resolve_ws_auth(self.scope)
        if not user and not participant:
            return False

        if event_code != "global":
            exists = Event.objects.filter(event_code__iexact=event_code).exists()
            if not exists:
                return False
        return True

    async def connect(self):
        self.event_code = self.scope["url_route"]["kwargs"].get("event_code", "global").lower()
        if not await self._verify_auth_and_event(self.event_code):
            await self.close(code=4003)
            return

        self.group_name = f"leaderboard_{self.event_code}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({
            "type": "connected",
            "channel": "leaderboard",
            "event_code": self.event_code,
            "message": f"Subscribed to live leaderboard for '{self.event_code}'.",
        }))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get("action") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def leaderboard_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))


class DashboardConsumer(AsyncWebsocketConsumer):
    """WebSocket Consumer for real-time admin/platform dashboard metrics (ADMIN ONLY)."""
    @database_sync_to_async
    def _is_admin(self):
        user, _ = resolve_ws_auth(self.scope)
        if user and (user.is_staff or user.role in ["ADMIN", "SUPER_ADMIN"]):
            return True
        return False

    async def connect(self):
        if not await self._is_admin():
            await self.close(code=4003)
            return

        self.group_name = "admin_dashboard"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({
            "type": "connected",
            "channel": "dashboard",
            "message": "Subscribed to real-time platform dashboard stream.",
        }))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get("action") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def dashboard_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))


class NotificationsConsumer(AsyncWebsocketConsumer):
    """WebSocket Consumer for targeted private notifications (F-09)."""
    @database_sync_to_async
    def _resolve_user_or_participant(self):
        return resolve_ws_auth(self.scope)

    async def connect(self):
        user, participant = await self._resolve_user_or_participant()
        if not user and not participant:
            await self.close(code=4003)
            return

        # Target private user / participant notification channel
        if user:
            self.group_name = f"user_{user.id}"
        else:
            self.group_name = f"participant_{participant.id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({
            "type": "connected",
            "channel": "notifications",
            "message": "Subscribed to private notifications stream.",
        }))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get("action") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def notification_push(self, event):
        await self.send(text_data=json.dumps(event["data"]))


class ChallengesConsumer(AsyncWebsocketConsumer):
    """WebSocket Consumer for real-time challenge activity & submission logs."""
    @database_sync_to_async
    def _is_authenticated(self):
        user, participant = resolve_ws_auth(self.scope)
        return bool(user or participant)

    async def connect(self):
        if not await self._is_authenticated():
            await self.close(code=4003)
            return

        self.group_name = "live_challenges"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({
            "type": "connected",
            "channel": "challenges",
            "message": "Subscribed to live challenge activity stream.",
        }))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get("action") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def challenge_activity(self, event):
        await self.send(text_data=json.dumps(event["data"]))
