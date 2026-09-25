import asyncio
import json
from datetime import date

from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase

from config.asgi import application
from apps.events.models.event import Event
from apps.participants.models.participant import Participant
from apps.participants.services.participant_service import ParticipantService
from apps.participants.services.session_service import SessionService
from apps.leaderboard.services.leaderboard_service import LeaderboardService
from apps.competition.services.websocket_service import WebSocketService


class LeaderboardConsumerTests(TransactionTestCase):
    """
    Security contract for the live leaderboard WebSocket:

    - The FIRST message must be {"token": "<jwt>"}; anything else is rejected
      with an error frame and close code 4003.
    - Only JWT participant tokens authenticate (signed session tokens are NOT
      valid here — different credential system).
    - A participant may only join THEIR OWN event's room: a participant of
      event B connecting to ws/leaderboard/<A>/ is rejected (WS BOLA guard,
      mirrors the REST cross-tenant isolation).
    - Broadcasts are event-wide leaderboard payloads with NO student context:
      is_current_user is false on every row and rows stay PII-minimal.
    """

    ROOM_PATH = "/ws/leaderboard/CBIT2026/"

    def setUp(self):
        self.event = Event.objects.create(
            college_name="CBIT",
            workshop_name="AI with SOC",
            event_code="CBIT2026",
            event_date=date(2026, 7, 22),
            duration_minutes=60,
            status=Event.StatusChoices.LIVE,
        )
        self.other_event = Event.objects.create(
            college_name="JNTUH",
            workshop_name="AI with SOC — JNTUH",
            event_code="JNTU2026",
            event_date=date(2026, 7, 22),
            duration_minutes=60,
            status=Event.StatusChoices.LIVE,
        )
        self.p1 = Participant.objects.create(
            event=self.event, name="Student One", email="p1@cbit.ac.in", score=900, completed=5,
        )
        self.p2 = Participant.objects.create(
            event=self.event, name="Student Two", email="p2@cbit.ac.in", score=700, completed=5,
        )
        self.outsider = Participant.objects.create(
            event=self.other_event, name="Outsider One", email="o1@jntu.ac.in", score=100, completed=1,
        )
        self.jwt1 = ParticipantService.generate_tokens_for_participant(self.p1)["access"]
        self.outsider_jwt = ParticipantService.generate_tokens_for_participant(self.outsider)["access"]

    # ── Authentication handshake ──────────────────────────────────────────

    async def test_first_message_must_be_token(self):
        communicator = WebsocketCommunicator(application, self.ROOM_PATH)
        try:
            connected, _ = await communicator.connect()
            self.assertTrue(connected)  # socket accepted, but NOT in the group yet

            await communicator.send_to(text_data=json.dumps({"hello": "world"}))
            response = await communicator.receive_json_from(timeout=2)
            self.assertEqual(response["type"], "error")
            self.assertEqual(response["message"], "Authentication failed.")

            out = await communicator.receive_output(timeout=2)
            self.assertEqual(out["type"], "websocket.close")
            self.assertEqual(out["code"], 4003)
        finally:
            await communicator.disconnect()

    async def test_valid_token_joins_group(self):
        communicator = WebsocketCommunicator(application, self.ROOM_PATH)
        try:
            connected, _ = await communicator.connect()
            self.assertTrue(connected)

            await communicator.send_to(text_data=json.dumps({"token": self.jwt1}))
            response = await communicator.receive_json_from(timeout=2)
            self.assertEqual(response["type"], "connected")
            self.assertEqual(response["channel"], "leaderboard")
            self.assertEqual(response["event_code"], "cbit2026")
        finally:
            await communicator.disconnect()

    async def test_signed_session_token_is_rejected(self):
        """The WS consumer only accepts JWTs — the signed session token used
        by the REST endpoints is a different credential system and must fail."""
        communicator = WebsocketCommunicator(application, self.ROOM_PATH)
        try:
            await communicator.connect()
            await communicator.send_to(text_data=json.dumps({
                "token": SessionService.generate_participant_token(self.p1),
            }))
            response = await communicator.receive_json_from(timeout=2)
            self.assertEqual(response["type"], "error")
            out = await communicator.receive_output(timeout=2)
            self.assertEqual(out["code"], 4003)
        finally:
            await communicator.disconnect()

    # ── Cross-event isolation (WS BOLA guard) ─────────────────────────────

    async def test_cross_event_participant_rejected(self):
        """A JNTU participant must not subscribe to the CBIT room — mirrors
        the REST cross-tenant isolation contract on the WebSocket surface."""
        communicator = WebsocketCommunicator(application, self.ROOM_PATH)
        try:
            await communicator.connect()
            await communicator.send_to(text_data=json.dumps({"token": self.outsider_jwt}))
            response = await communicator.receive_json_from(timeout=2)
            self.assertEqual(response["type"], "error")
            self.assertEqual(response["message"], "Authentication failed.")
            out = await communicator.receive_output(timeout=2)
            self.assertEqual(out["type"], "websocket.close")
            self.assertEqual(out["code"], 4003)
        finally:
            await communicator.disconnect()

    # ── Broadcast delivery ────────────────────────────────────────────────

    async def test_leaderboard_update_is_delivered_to_authenticated_socket(self):
        communicator = WebsocketCommunicator(application, self.ROOM_PATH)
        try:
            await communicator.connect()
            await communicator.send_to(text_data=json.dumps({"token": self.jwt1}))
            await communicator.receive_json_from(timeout=2)  # "connected"

            def broadcast():
                WebSocketService.notify_leaderboard_update(
                    "CBIT2026",
                    LeaderboardService.get_event_leaderboard(event=self.event),
                )

            # notify_leaderboard_update uses async_to_sync internally, so it
            # must run off the event loop thread (same as Celery/prod callers).
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, broadcast)

            payload = await communicator.receive_json_from(timeout=2)
            # The consumer sends the BARE leaderboard payload (no envelope).
            self.assertIn("rankings", payload)
            names = [row["name"] for row in payload["rankings"]]
            self.assertIn("Student One", names)

            # Event-wide payload: no student context — is_current_user is
            # false on every row (clients overlay their own row client-side).
            for row in payload["rankings"]:
                self.assertFalse(row["is_current_user"])

            # PII minimality holds on the WS surface too.
            allowed_keys = {"rank", "name", "score", "completed", "time_taken", "is_current_user", "is_finished"}
            for row in payload["rankings"]:
                self.assertEqual(set(row.keys()), allowed_keys)
            self.assertNotIn("@cbit.ac.in", json.dumps(payload))
        finally:
            await communicator.disconnect()

    async def test_ping_pong_after_auth(self):
        communicator = WebsocketCommunicator(application, self.ROOM_PATH)
        try:
            await communicator.connect()
            await communicator.send_to(text_data=json.dumps({"token": self.jwt1}))
            await communicator.receive_json_from(timeout=2)  # "connected"

            await communicator.send_to(text_data=json.dumps({"action": "ping"}))
            response = await communicator.receive_json_from(timeout=2)
            self.assertEqual(response, {"type": "pong"})
        finally:
            await communicator.disconnect()
