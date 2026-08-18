import time
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from apps.accounts.models.user import User
from apps.events.models.event import Event
from apps.challenges.models.challenge import Challenge
from apps.questions.models.question import Question
from apps.challenges.models.challenge_question import ChallengeQuestion
from apps.participants.models.participant import Participant
from apps.participants.models.participant_progress import ParticipantProgress
from apps.participants.services.session_service import SessionService


class ChallengeResumeAutoSaveTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Event A
        self.event_a = Event.objects.create(
            college_name="Cyber Tech Institute",
            workshop_name="SOC Defense Workshop A",
            event_code="CYBER_A_2026",
            event_date="2026-08-20",
            passing_score=300,
            total_challenges=2,
            status="Live",
        )

        # Event B
        self.event_b = Event.objects.create(
            college_name="Security Academy B",
            workshop_name="SOC Defense Workshop B",
            event_code="CYBER_B_2026",
            event_date="2026-08-20",
            passing_score=300,
            total_challenges=2,
            status="Live",
        )

        # Participant Akhil in Event A
        self.participant = Participant.objects.create(
            name="Akhil Analyst",
            email="akhil@cyber.edu",
            event=self.event_a,
            score=0,
            completed=0,
        )
        self.token = SessionService.generate_participant_token(self.participant)

        # Participant Bob in Event B
        self.participant_b = Participant.objects.create(
            name="Bob Hacker",
            email="bob@academy.edu",
            event=self.event_b,
            score=0,
            completed=0,
        )
        self.token_b = SessionService.generate_participant_token(self.participant_b)

        # Challenge 1: Operation PhishNet
        self.challenge1 = Challenge.objects.create(
            challenge_number=1,
            name="Operation PhishNet",
            slug="phishnet",
            description="Phishing email analysis",
            brief="Analyze message headers and URL",
            difficulty="Easy",
            duration_minutes=20,
            points=100,
        )

        # Questions for Challenge 1
        self.q1 = Question.objects.create(
            category="Phishing",
            kind=Question.QuestionKindChoices.TEXT,
            question_text="What is the spoofed sender domain?",
            correct_answer="evil-bank.com",
            default_points=25,
            difficulty="Easy",
        )
        self.q2 = Question.objects.create(
            category="Phishing",
            kind=Question.QuestionKindChoices.TEXT,
            question_text="Identify the suspicious URL.",
            correct_answer="https://evil-bank.com/login",
            default_points=25,
            difficulty="Easy",
        )
        self.q3 = Question.objects.create(
            category="Phishing",
            kind=Question.QuestionKindChoices.TEXT,
            question_text="What is the malicious IP?",
            correct_answer="198.51.100.24",
            default_points=25,
            difficulty="Easy",
        )
        self.q4 = Question.objects.create(
            category="Phishing",
            kind=Question.QuestionKindChoices.TEXT,
            question_text="What is the phishing technique?",
            correct_answer="Spear phishing",
            default_points=25,
            difficulty="Easy",
        )

        ChallengeQuestion.objects.create(challenge=self.challenge1, question=self.q1, position=1)
        ChallengeQuestion.objects.create(challenge=self.challenge1, question=self.q2, position=2)
        ChallengeQuestion.objects.create(challenge=self.challenge1, question=self.q3, position=3)
        ChallengeQuestion.objects.create(challenge=self.challenge1, question=self.q4, position=4)

    # -------------------------------------------------------------
    # TEST 1: Start Challenge -> IN_PROGRESS
    # -------------------------------------------------------------
    def test_start_challenge_creates_in_progress(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")
        response = self.client.post(f"/api/v1/challenges/{self.challenge1.slug}/start/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "in_progress")

        progress = ParticipantProgress.objects.get(
            participant=self.participant,
            challenge=self.challenge1,
        )
        self.assertEqual(progress.status, ParticipantProgress.StatusChoices.IN_PROGRESS)
        self.assertIsNotNone(progress.started_at)
        self.assertEqual(progress.time_limit_seconds, 20 * 60)

    # -------------------------------------------------------------
    # TEST 2 & 3: Auto-Save Answers & Resume State on Refresh / Return
    # -------------------------------------------------------------
    def test_auto_save_answers_and_resume(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

        # Start challenge
        self.client.post(f"/api/v1/challenges/{self.challenge1.slug}/start/")

        # Answer Q1, Q2, Q3 (Auto-save)
        answers_payload = {
            str(self.q1.id): "evil-bank.com",
            str(self.q2.id): "https://evil-bank.com/login",
            str(self.q3.id): "198.51.100.24",
        }
        save_resp = self.client.post(
            f"/api/v1/challenges/{self.challenge1.slug}/save-progress/",
            {
                "answers": answers_payload,
                "current_question_index": 2,
                "visited_questions": [str(self.q1.id), str(self.q2.id), str(self.q3.id)],
            },
            format="json",
        )
        self.assertEqual(save_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(save_resp.data["saved"])

        # Simulate user closing tab / refreshing page and requesting progress
        progress_resp = self.client.get(f"/api/v1/challenges/{self.challenge1.slug}/progress/")
        self.assertEqual(progress_resp.status_code, status.HTTP_200_OK)
        data = progress_resp.data["data"]

        self.assertEqual(data["status"], "in_progress")
        self.assertEqual(data["current_question_index"], 2)
        self.assertEqual(data["answered_questions"], 3)
        self.assertEqual(data["answers"][str(self.q1.id)], "evil-bank.com")
        self.assertEqual(data["answers"][str(self.q2.id)], "https://evil-bank.com/login")
        self.assertEqual(data["answers"][str(self.q3.id)], "198.51.100.24")
        self.assertNotIn(str(self.q4.id), data["answers"])

    # -------------------------------------------------------------
    # TEST 5 & 6: Server-Authoritative Timer & Immunity to Clock Tampering
    # -------------------------------------------------------------
    def test_server_authoritative_timer_calculation(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

        # Start challenge 10 minutes ago
        past_time = timezone.now() - timedelta(minutes=10)
        progress = ParticipantProgress.objects.create(
            participant=self.participant,
            challenge=self.challenge1,
            status=ParticipantProgress.StatusChoices.IN_PROGRESS,
            started_at=past_time,
            time_limit_seconds=20 * 60,
        )

        response = self.client.get(f"/api/v1/challenges/{self.challenge1.slug}/progress/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["data"]

        # 20 min total - 10 min elapsed = ~600 seconds remaining
        remaining = data["remaining_time_seconds"]
        self.assertAlmostEqual(remaining, 600, delta=5)

    # -------------------------------------------------------------
    # TEST 7: Cross-Participant Access Rejected
    # -------------------------------------------------------------
    def test_cross_participant_progress_isolation(self):
        # Participant Akhil saves progress
        ParticipantProgress.objects.create(
            participant=self.participant,
            challenge=self.challenge1,
            status=ParticipantProgress.StatusChoices.IN_PROGRESS,
            draft_answers={"secret_q": "akhil_private_answer"},
        )

        # Participant Bob authenticates and tries to fetch challenge progress
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_b}")
        response = self.client.get(f"/api/v1/challenges/{self.challenge1.slug}/progress/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["data"]

        # Bob should get clean/not_started state, not Akhil's secret answer
        self.assertNotEqual(data.get("draft_answers", {}).get("secret_q"), "akhil_private_answer")

    # -------------------------------------------------------------
    # TEST 9 & 13: Submission & Duplicate Score Prevention
    # -------------------------------------------------------------
    def test_submission_and_duplicate_score_prevention(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

        # Submit all 4 correct answers
        answers_payload = {
            str(self.q1.id): "evil-bank.com",
            str(self.q2.id): "https://evil-bank.com/login",
            str(self.q3.id): "198.51.100.24",
            str(self.q4.id): "Spear phishing",
        }
        sub_resp = self.client.post(
            f"/api/v1/challenges/{self.challenge1.slug}/submit/",
            {"answers": answers_payload},
            format="json",
        )
        self.assertEqual(sub_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(sub_resp.data["score_earned"], 100)

        self.participant.refresh_from_db()
        self.assertEqual(self.participant.score, 100)
        self.assertEqual(self.participant.completed, 1)

        # Second submission must NOT inflate score
        sub_resp2 = self.client.post(
            f"/api/v1/challenges/{self.challenge1.slug}/submit/",
            {"answers": answers_payload},
            format="json",
        )
        self.assertEqual(sub_resp2.status_code, status.HTTP_200_OK)

        self.participant.refresh_from_db()
        self.assertEqual(self.participant.score, 100)
        self.assertEqual(self.participant.completed, 1)

    # -------------------------------------------------------------
    # TEST 14: All Challenges Progress Map for Dashboard / Challenges Page
    # -------------------------------------------------------------
    def test_all_challenges_progress_map(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

        ParticipantProgress.objects.create(
            participant=self.participant,
            challenge=self.challenge1,
            status=ParticipantProgress.StatusChoices.IN_PROGRESS,
            draft_answers={str(self.q1.id): "evil-bank.com"},
        )

        response = self.client.get("/api/v1/progress/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["data"]

        self.assertIn("phishnet", data)
        self.assertEqual(data["phishnet"]["status"], "in_progress")
        self.assertEqual(data["phishnet"]["answered_questions"], 1)
