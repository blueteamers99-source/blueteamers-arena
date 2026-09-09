import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from apps.competition.utils.ws_auth import resolve_ws_auth, resolve_token_from_message
from apps.events.models.event import Event


class LeaderboardConsumer(AsyncWebsocketConsumer):
    """WebSocket Consumer for live score and rank updates.
    
    Auth flow: Client connects, then sends { "token": "<jwt>" } as first message.
    """
    @database_sync_to_async
    def _verify_event_access(self, user, participant, event_code: str):
        if not user and not participant:
            return False

        if event_code == "global":
            # Role field is authoritative; is_staff alone is not sufficient
            return bool(user and getattr(user, "role", "") in ["ADMIN", "SUPER_ADMIN"])

        try:
            event = Event.objects.get(event_code__iexact=event_code)
        except Event.DoesNotExist:
            return False

        if participant and participant.event_id != event.id:
            return False

        return True

    async def connect(self):
        self.event_code = self.scope["url_route"]["kwargs"].get("event_code", "global").lower()
        self._authenticated = False

        # Try header-based auth (e.g., server-to-server)
        user, participant = resolve_ws_auth(self.scope)
        if user or participant:
            if await self._verify_event_access(user, participant, self.event_code):
                self._authenticated = True

        self.group_name = f"leaderboard_{self.event_code}"
        await self.accept()

        if self._authenticated:
            await self._join_group()

    async def _join_group(self):
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.send(text_data=json.dumps({
            "type": "connected",
            "channel": "leaderboard",
            "event_code": self.event_code,
            "message": f"Subscribed to live leaderboard for '{self.event_code}'.",
        }))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name") and self._authenticated:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)

        if not self._authenticated:
            user, participant = resolve_token_from_message(data)
            if not await self._verify_event_access(user, participant, self.event_code):
                await self.send(text_data=json.dumps({
                    "type": "error",
                    "message": "Authentication failed.",
                }))
                await self.close(code=4003)
                return
            self._authenticated = True
            await self._join_group()
            return

        if data.get("action") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def leaderboard_update(self, event):
        if self._authenticated:
            await self.send(text_data=json.dumps(event["data"]))


class DashboardConsumer(AsyncWebsocketConsumer):
    """WebSocket Consumer for real-time admin/platform dashboard metrics (ADMIN ONLY).
    
    Auth flow: Client connects, then sends { "token": "<jwt>" } as first message.
    """
    @database_sync_to_async
    def _is_admin_user(self, user):
        # Role field is authoritative; is_staff alone is not sufficient
        return bool(user and user.role in ["ADMIN", "SUPER_ADMIN"])

    async def connect(self):
        self._authenticated = False

        # Try header-based auth
        user, _ = resolve_ws_auth(self.scope)
        if user and await self._is_admin_user(user):
            self._authenticated = True

        self.group_name = "admin_dashboard"
        await self.accept()

        if self._authenticated:
            await self._join_group()

    async def _join_group(self):
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.send(text_data=json.dumps({
            "type": "connected",
            "channel": "dashboard",
            "message": "Subscribed to real-time platform dashboard stream.",
        }))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name") and self._authenticated:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)

        if not self._authenticated:
            user, _ = resolve_token_from_message(data)
            if not await self._is_admin_user(user):
                await self.send(text_data=json.dumps({
                    "type": "error",
                    "message": "Admin access required.",
                }))
                await self.close(code=4003)
                return
            self._authenticated = True
            await self._join_group()
            return

        if data.get("action") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def dashboard_update(self, event):
        if self._authenticated:
            await self.send(text_data=json.dumps(event["data"]))


class NotificationsConsumer(AsyncWebsocketConsumer):
    """WebSocket Consumer for targeted private notifications.

    Auth flow: Client connects, then sends { "token": "<jwt>" } as first message.
    
    Joins two groups:
    - Private: user_{id} or participant_{id} — targeted notifications
    - Global:  global_notifications — broadcast notifications
    """
    async def connect(self):
        self._authenticated = False
        self._user = None
        self._participant = None

        # Try header-based auth
        user, participant = resolve_ws_auth(self.scope)
        if user or participant:
            self._authenticated = True
            self._user = user
            self._participant = participant

        await self.accept()

        if self._authenticated:
            await self._join_groups()

    async def _join_groups(self):
        if self._user:
            self.group_name = f"user_{self._user.id}"
        else:
            self.group_name = f"participant_{self._participant.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        self.global_group_name = "global_notifications"
        await self.channel_layer.group_add(self.global_group_name, self.channel_name)

        await self.send(text_data=json.dumps({
            "type": "connected",
            "channel": "notifications",
            "groups": [self.group_name, self.global_group_name],
            "message": "Subscribed to private + broadcast notifications.",
        }))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name") and self._authenticated:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        if hasattr(self, "global_group_name") and self._authenticated:
            await self.channel_layer.group_discard(self.global_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)

        if not self._authenticated:
            user, participant = resolve_token_from_message(data)
            if not user and not participant:
                await self.send(text_data=json.dumps({
                    "type": "error",
                    "message": "Authentication failed.",
                }))
                await self.close(code=4003)
                return
            self._authenticated = True
            self._user = user
            self._participant = participant
            await self._join_groups()
            return

        if data.get("action") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def notification_push(self, event):
        if self._authenticated:
            await self.send(text_data=json.dumps(event["data"]))
