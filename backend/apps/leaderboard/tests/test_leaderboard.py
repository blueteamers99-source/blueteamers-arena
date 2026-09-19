from datetime import date, timedelta
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from apps.events.models.event import Event
from apps.participants.models.participant import Participant
from apps.participants.services.session_service import SessionService
from apps.leaderboard.services.leaderboard_service import LeaderboardService


class LeaderboardAPITests(TestCase):
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

        self.token2 = SessionService.generate_participant_token(self.p2)
        self.list_url = reverse("leaderboard-list")
        self.current_url = reverse("leaderboard-current")

    def test_leaderboard_ranking_order(self):
        response = self.client.get(f"{self.list_url}?event_code=CBIT2026")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])

        rankings = response.data["data"]["rankings"]
        self.assertEqual(len(rankings), 4)
        self.assertEqual(rankings[0]["name"], "Student Two")  # 900 score -> Rank 1
        self.assertEqual(rankings[1]["name"], "Student Three")  # 700 score -> Rank 2
        self.assertEqual(rankings[2]["name"], "Student One")  # 600 score -> Rank 3
        self.assertEqual(rankings[3]["name"], "Student Four")  # 0 score -> Rank 4 (live, not finished)
        self.assertFalse(rankings[3]["is_finished"])
        self.assertTrue(rankings[0]["is_finished"])
        # Live event, nobody finished → not final, no winner yet
        self.assertFalse(response.data["data"]["is_final"])
        self.assertIsNone(response.data["data"]["winner"])
        # Live podium reflects the current top scorers of the board (in sync)
        self.assertEqual(len(response.data["data"]["top3_podium"]), 3)

    def test_winner_eligibility_requires_all_challenges_and_passing(self):
        # p4 finished every challenge but scored below the passing score — on
        # the live board they are visible, but must never surface as a winner.
        now = timezone.now()
        for p in [self.p1, self.p2, self.p3, self.p4]:
            Participant.objects.filter(pk=p.pk).update(
                started_at=now - timedelta(minutes=50),
                finished_at=now - timedelta(minutes=10),
            )
        Participant.objects.filter(pk=self.p4.pk).update(score=300, completed=5)
        for p in [self.p1, self.p2, self.p3]:
            Participant.objects.filter(pk=p.pk).update(score=600, completed=5)
        self.event.status = Event.StatusChoices.COMPLETED
        self.event.save()
        response = self.client.get(f"{self.list_url}?event_code=CBIT2026")
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
        response = self.client.get(f"{self.list_url}?event_code=CBIT2026")
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
        response = self.client.get(f"{self.list_url}?event_code=CBIT2026")
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
