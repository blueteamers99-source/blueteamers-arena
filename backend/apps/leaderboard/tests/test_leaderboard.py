from datetime import date
from django.test import TestCase
from django.urls import reverse
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
        # Unpassed participant — must never appear in rankings
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
        self.assertEqual(len(rankings), 3)
        self.assertEqual(rankings[0]["name"], "Student Two")  # 900 score -> Rank 1
        self.assertEqual(rankings[1]["name"], "Student Three")  # 700 score -> Rank 2
        self.assertEqual(rankings[2]["name"], "Student One")  # 600 score -> Rank 3
        self.assertNotEqual(rankings[0]["name"], "Student Four")
        self.assertNotIn("Student Four", [r["name"] for r in rankings])

    def test_current_event_leaderboard_for_student(self):
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token2)
        response = self.client.get(self.current_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["student_position"]["rank"], 1)
        self.assertEqual(len(response.data["data"]["top3_podium"]), 3)
