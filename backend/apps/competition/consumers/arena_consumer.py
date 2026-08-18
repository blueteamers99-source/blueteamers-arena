import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from apps.competition.utils.ws_auth import resolve_ws_auth
from apps.events.models.event import Event


class ArenaConsumer(AsyncWebsocketConsumer):
    """
    WebSocket Consumer for real-time live competition events (Leaderboard updates, Submissions, Top 3 changes).
    URL: /ws/arena/<event_code>/
    """
    @database_sync_to_async
    def _verify_auth_and_event(self, event_code: str):
        user, participant = resolve_ws_auth(self.scope)
        if not user and not participant:
            return False, "Authentication required."

        # Verify event exists
        if event_code != "global":
            event_obj = Event.objects.filter(event_code__iexact=event_code).first()
            if not event_obj:
                return False, "Event does not exist."

            # If participant connecting, enforce event isolation
            if participant and participant.event.event_code.lower() != event_code.lower():
                # Allow only if staff/admin user
                if not (user and (user.is_staff or user.role in ["ADMIN", "SUPER_ADMIN"])):
                    return False, "Forbidden. Participant cannot access another event arena stream."

        return True, None

    async def connect(self):
        self.event_code = self.scope["url_route"]["kwargs"].get("event_code", "global").lower()
        
        is_authorized, err_msg = await self._verify_auth_and_event(self.event_code)
        if not is_authorized:
            await self.close(code=4003)
            return

        self.group_name = f"event_{self.event_code}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({
            "event": "connected",
            "message": f"Connected to live arena stream for event '{self.event_code}'.",
        }))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        await self.send(text_data=json.dumps({
            "event": "ack",
            "payload": data,
        }))

    async def broadcast_event(self, event):
        await self.send(text_data=json.dumps({
            "event": event["event"],
            "data": event["data"],
        }))
