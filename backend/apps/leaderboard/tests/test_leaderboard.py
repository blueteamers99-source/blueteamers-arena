from datetime import date, timedelta
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from apps.events.models.event import Event
from apps.participants.models.participant import Participant
from apps.participants.services.participant_service import ParticipantService
from apps.participants.services.session_service import SessionService
from apps.leaderboard.services.leaderboard_service import LeaderboardService


class LeaderboardAPITests(TestCase):
    """
    Security contract for the leaderboard API:
    - Authentication is REQUIRED (no anonymous access).
    - The returned board is ALWAYS the token holder's own event — client
      supplied event_id / event_code parameters are ignored, so a participant
      of event A can never read event B's standings (cross-tenant isolation).
    - Rows are PII-minimal: no email (masked or otherwise), no participant_id,
      no per-row college_name / event_code.
    - Search matches NAMES only (no email oracle).
    - Participants of COMPLETED events may still view final standings — but
      ONLY from the leaderboard.
    """

    def setUp(self):
        self.client = APIClient()
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
            event=self.event, name="Student One", email="p1@cbit.ac.in", score=600, completed=5,
        )
        self.p2 = Participant.objects.create(
            event=self.event, name="Student Two", email="p2@cbit.ac.in", score=900, completed=5,
        )
        self.p3 = Participant.objects.create(
            event=self.event, name="Student Three", email="p3@cbit.ac.in", score=700, completed=5,
        )
        # Unfinished participant — still appears on the LIVE leaderboard so the
        # leaderboard stays alive during the run, but flagged as not finished.
        self.p4 = Participant.objects.create(
            event=self.event, name="Student Four", email="p4@cbit.ac.in", score=0, completed=0,
        )
        # Outsider — a participant of the OTHER event. Their token must never
        # be able to pull the CBIT board, no matter what query params are sent.
        self.outsider = Participant.objects.create(
            event=self.other_event, name="Outsider One", email="o1@jntu.ac.in", score=100, completed=1,
        )

        self.token2 = SessionService.generate_participant_token(self.p2)
        self.outsider_token = SessionService.generate_participant_token(self.outsider)
        self.list_url = reverse("leaderboard-list")
        self.current_url = reverse("leaderboard-current")

    # ── Authentication ────────────────────────────────────────────────────

    def test_leaderboard_requires_authentication(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.get(f"{self.list_url}?event_code=CBIT2026")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── Ranking behaviour (authenticated) ─────────────────────────────────

    def test_leaderboard_ranking_order(self):
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token2)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])

        data = response.data["data"]
        self.assertEqual(data["event_code"], "CBIT2026")
        rankings = data["rankings"]
        self.assertEqual(len(rankings), 4)
        self.assertEqual(rankings[0]["name"], "Student Two")  # 900 score -> Rank 1
        self.assertEqual(rankings[1]["name"], "Student Three")  # 700 score -> Rank 2
        self.assertEqual(rankings[2]["name"], "Student One")  # 600 score -> Rank 3
        self.assertEqual(rankings[3]["name"], "Student Four")  # 0 score -> Rank 4 (live, not finished)
        self.assertFalse(rankings[3]["is_finished"])
        self.assertTrue(rankings[0]["is_finished"])
        # Live event, still running → not final, no winner yet
        self.assertFalse(data["is_final"])
        self.assertIsNone(data["winner"])
        # Live podium reflects the current top scorers of the board (in sync)
        self.assertEqual(len(data["top3_podium"]), 3)
        # The requester sees their own position highlighted
        self.assertTrue(rankings[0]["is_current_user"])
        self.assertEqual(data["student_position"]["rank"], 1)

    # ── Cross-tenant isolation ────────────────────────────────────────────

    def test_event_code_param_cannot_cross_events(self):
        """A JNTU participant asking for ?event_code=CBIT2026 gets ONLY their
        own event's board — the query param is ignored entirely."""
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.outsider_token)
        response = self.client.get(f"{self.list_url}?event_code=CBIT2026")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data["data"]
        self.assertEqual(data["event_code"], "JNTU2026")
        self.assertEqual(data["college_name"], "JNTUH")
        names = [r["name"] for r in data["rankings"]]
        self.assertEqual(names, ["Outsider One"])
        self.assertNotIn("Student One", names)
        self.assertNotIn("Student Two", names)

        # Same via event_id — also ignored
        response = self.client.get(f"{self.list_url}?event_id={self.event.id}")
        self.assertEqual(response.data["data"]["event_code"], "JNTU2026")

    # ── PII minimality ────────────────────────────────────────────────────

    def test_rows_contain_no_pii(self):
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token2)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data["data"]
        allowed_keys = {"rank", "name", "score", "completed", "time_taken", "is_current_user", "is_finished"}
        row_lists = [data["rankings"], data["top3_podium"], data["winners"], data["nearby_rankings"]]
        for rows in row_lists:
            for row in rows:
                self.assertEqual(set(row.keys()), allowed_keys)
        for key in ("student_position", "winner"):
            if data[key] is not None:
                self.assertEqual(set(data[key].keys()), allowed_keys)
        # No email or participant_id anywhere in the payload rows
        raw = str(response.content)
        self.assertNotIn("participant_id", raw)
        self.assertNotIn("@cbit.ac.in", raw)

    def test_search_matches_name_only(self):
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token2)
        # Email fragment must NOT match anyone (no email oracle): name-only
        # filtering means an email fragment matches zero rows — participation
        # can never be confirmed via an email address.
        response = self.client.get(f"{self.list_url}?search=p2@cbit")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["data"]["rankings"]), 0)

        # Name fragment DOES filter
        response = self.client.get(f"{self.list_url}?search=Student Two")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [r["name"] for r in response.data["data"]["rankings"]]
        self.assertEqual(names, ["Student Two"])

    # ── Completed-event visibility (leaderboard only) ─────────────────────

    def test_completed_event_board_still_viewable(self):
        self.event.status = Event.StatusChoices.COMPLETED
        self.event.save()
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token2)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["data"]["is_final"])

    def test_completed_event_jwt_token_still_viewable(self):
        tokens = ParticipantService.generate_tokens_for_participant(self.p2)
        self.event.status = Event.StatusChoices.COMPLETED
        self.event.save()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["event_code"], "CBIT2026")

    # ── Final results ─────────────────────────────────────────────────────

    def test_winner_eligibility_requires_all_challenges_and_passing(self):
        # p4 finished every challenge but scored below the passing score — on
        # the live board they are visible, but must never surface as a winner.
        # Distinct finish times make tie-breaking deterministic: among equal
        # scores, the earlier finisher ranks higher.
        now = timezone.now()
        finish_times = {
            self.p1.pk: now - timedelta(minutes=30),
            self.p2.pk: now - timedelta(minutes=20),
            self.p3.pk: now - timedelta(minutes=10),
            self.p4.pk: now - timedelta(minutes=5),
        }
        for p in [self.p1, self.p2, self.p3, self.p4]:
            Participant.objects.filter(pk=p.pk).update(
                started_at=finish_times[p.pk] - timedelta(minutes=40),
                finished_at=finish_times[p.pk],
            )
        Participant.objects.filter(pk=self.p4.pk).update(score=300, completed=5)
        for p in [self.p1, self.p2, self.p3]:
            Participant.objects.filter(pk=p.pk).update(score=600, completed=5)
        self.event.status = Event.StatusChoices.COMPLETED
        self.event.save()
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token2)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["data"]
        self.assertTrue(data["is_final"])
        # p4 is below passing — excluded from the winners announcement even
        # though they are (and always were) visible on the live board.
        winner_names = [w["name"] for w in data["winners"]]
        self.assertNotIn("Student Four", winner_names)
        self.assertEqual(data["winner"]["name"], "Student One")

    def test_final_results_all_finished(self):
        # Give p1–p3 realistic started_at / finished_at so the system detects
        # that every active participant has finished before the clock expired.
        now = timezone.now()
        for p in [self.p1, self.p2, self.p3]:
            Participant.objects.filter(pk=p.pk).update(
                started_at=now - timedelta(minutes=50),
                finished_at=now - timedelta(minutes=10),
            )
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token2)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["data"]
        self.assertTrue(data["is_final"])
        self.assertEqual(data["final_reason"], "all_finished")
        self.assertEqual(data["winner"]["name"], "Student Two")
        # Announced winners = the top-3 eligible, ordered exactly as they
        # appeared on the live board (in sync).
        self.assertEqual([w["name"] for w in data["winners"]], ["Student Two", "Student Three", "Student One"])
        self.assertEqual([w["name"] for w in data["top3_podium"]], ["Student Two", "Student Three", "Student One"])

    def test_final_results_time_up(self):
        # Event completed (clock ran out) → results lock by time even though
        # not everyone finished
        now = timezone.now()
        Participant.objects.filter(pk=self.p1.pk).update(
            started_at=now - timedelta(minutes=50),
            finished_at=now - timedelta(minutes=10),
        )
        self.event.status = Event.StatusChoices.COMPLETED
        self.event.save()
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token2)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["data"]
        self.assertTrue(data["is_final"])
        self.assertEqual(data["final_reason"], "time_up")
        self.assertEqual(data["winner"]["name"], "Student Two")
        self.assertEqual([w["name"] for w in data["winners"]], ["Student Two", "Student Three", "Student One"])

    def test_current_event_leaderboard_for_student(self):
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token2)
        response = self.client.get(self.current_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["student_position"]["rank"], 1)
        self.assertEqual(len(response.data["data"]["top3_podium"]), 3)

    def test_current_requires_authentication(self):
        response = self.client.get(self.current_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
