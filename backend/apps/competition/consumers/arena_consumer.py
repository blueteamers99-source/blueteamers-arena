import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from apps.competition.utils.ws_auth import resolve_ws_auth, resolve_token_from_message
from apps.events.models.event import Event


class ArenaConsumer(AsyncWebsocketConsumer):
    """
    WebSocket Consumer for real-time live competition events (Leaderboard updates, Submissions, Top 3 changes).
    URL: /ws/arena/<event_code>/
    
    Auth flow: Client connects, then sends { "token": "<jwt>" } as first message.
    """
    @database_sync_to_async
    def _verify_event_access(self, user, participant, event_code: str):
        if not user and not participant:
            return False, "Authentication required."

        # Verify event exists
        if event_code != "global":
            event_obj = Event.objects.filter(event_code__iexact=event_code).first()
            if not event_obj:
                return False, "Event does not exist."

            # If participant connecting, enforce event isolation
            if participant and participant.event.event_code.lower() != event_code.lower():
                # Allow only if admin role (role field is authoritative; is_staff alone is not sufficient)
                if not (user and user.role in ["ADMIN", "SUPER_ADMIN"]):
                    return False, "Forbidden. Participant cannot access another event arena stream."

        return True, None

    async def connect(self):
        self.event_code = self.scope["url_route"]["kwargs"].get("event_code", "global").lower()
        self._authenticated = False
        self._user = None
        self._participant = None

        # Try header-based auth (e.g., server-to-server)
        user, participant = resolve_ws_auth(self.scope)
        if user or participant:
            is_authorized, err_msg = await self._verify_event_access(user, participant, self.event_code)
            if not is_authorized:
                await self.close(code=4003)
                return
            self._authenticated = True
            self._user = user
            self._participant = participant

        # Accept connection — auth will be verified on first message if not already done
        self.group_name = f"event_{self.event_code}"
        await self.accept()

        if self._authenticated:
            await self._join_group()

    async def _join_group(self):
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.send(text_data=json.dumps({
            "event": "connected",
            "message": f"Connected to live arena stream for event '{self.event_code}'.",
        }))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name") and self._authenticated:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)

        # Handle first-message authentication
        if not self._authenticated:
            user, participant = resolve_token_from_message(data)
            is_authorized, err_msg = await self._verify_event_access(user, participant, self.event_code)
            if not is_authorized:
                await self.send(text_data=json.dumps({
                    "event": "error",
                    "message": err_msg or "Authentication failed.",
                }))
                await self.close(code=4003)
                return

            self._authenticated = True
            self._user = user
            self._participant = participant
            await self._join_group()
            return

        # Handle regular messages (only if authenticated)
        await self.send(text_data=json.dumps({
            "event": "ack",
            "payload": data,
        }))

    async def broadcast_event(self, event):
        if self._authenticated:
            await self.send(text_data=json.dumps({
                "event": event["event"],
                "data": event["data"],
            }))
