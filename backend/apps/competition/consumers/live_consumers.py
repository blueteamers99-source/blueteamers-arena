import json
from channels.generic.websocket import AsyncWebsocketConsumer


class EventsConsumer(AsyncWebsocketConsumer):
    """WebSocket Consumer for live event state transitions and status updates."""
    async def connect(self):
        self.group_name = "live_events"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({
            "type": "connected",
            "channel": "events",
            "message": "Subscribed to live event updates stream.",
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get("action") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def event_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))


class LeaderboardConsumer(AsyncWebsocketConsumer):
    """WebSocket Consumer for live score and rank updates."""
    async def connect(self):
        self.event_code = self.scope["url_route"]["kwargs"].get("event_code", "global").lower()
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
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get("action") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def leaderboard_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))


class DashboardConsumer(AsyncWebsocketConsumer):
    """WebSocket Consumer for real-time admin/platform dashboard metrics."""
    async def connect(self):
        self.group_name = "admin_dashboard"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({
            "type": "connected",
            "channel": "dashboard",
            "message": "Subscribed to real-time platform dashboard stream.",
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get("action") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def dashboard_update(self, event):
        await self.send(text_data=json.dumps(event["data"]))


class NotificationsConsumer(AsyncWebsocketConsumer):
    """WebSocket Consumer for real-time in-app & broadcast notifications."""
    async def connect(self):
        self.group_name = "global_notifications"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({
            "type": "connected",
            "channel": "notifications",
            "message": "Subscribed to real-time notifications stream.",
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get("action") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def notification_push(self, event):
        await self.send(text_data=json.dumps(event["data"]))


class ChallengesConsumer(AsyncWebsocketConsumer):
    """WebSocket Consumer for real-time challenge activity & submission logs."""
    async def connect(self):
        self.group_name = "live_challenges"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({
            "type": "connected",
            "channel": "challenges",
            "message": "Subscribed to live challenge activity stream.",
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get("action") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def challenge_activity(self, event):
        await self.send(text_data=json.dumps(event["data"]))
