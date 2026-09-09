from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date
from apps.challenges.models.challenge import Challenge
from apps.challenges.models.challenge_question import ChallengeQuestion
from apps.challenges.models.evidence import Evidence
from apps.events.models.event import Event
from apps.participants.models.participant import Participant
from apps.participants.services.session_service import SessionService
from apps.questions.models.question import Question
from apps.submissions.models.submission import Submission


class ChallengesAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.challenge = Challenge.objects.create(
            challenge_number=1,
            slug="phishnet",
            name="Operation PhishNet",
            description="Phishing investigation scenario",
            brief="Analyze suspicious email headers",
            difficulty=Challenge.DifficultyChoices.EASY,
            duration_minutes=20,
            points=100,
        )
        self.evidence = Evidence.objects.create(
            challenge=self.challenge,
            artifact_key="headers",
            label="Email Headers",
            filename="email-headers.txt",
            file_format=Evidence.FormatChoices.TXT,
            content_text="Return-Path: <spoofed@domain.com>",
        )
        self.list_url = reverse("challenge-list")
        self.detail_url = reverse("challenge-detail", kwargs={"slug": "phishnet"})

    def test_list_challenges(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["name"], "Operation PhishNet")

    def test_get_challenge_detail_with_evidence(self):
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["slug"], "phishnet")
        self.assertEqual(len(response.data["evidence"]), 1)
        self.assertEqual(response.data["evidence"][0]["artifact_key"], "headers")


class AllReviewsAPITests(TestCase):
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
        self.ch1 = Challenge.objects.create(
            challenge_number=1,
            slug="phishnet",
            name="Operation PhishNet",
            description="Phishing scenario",
            brief="Analyze email headers",
            difficulty=Challenge.DifficultyChoices.EASY,
            duration_minutes=20,
            points=100,
            event=self.event,
        )
        self.ch2 = Challenge.objects.create(
            challenge_number=2,
            slug="alert-storm",
            name="Alert Storm",
            description="SIEM scenario",
            brief="Analyze SIEM alerts",
            difficulty=Challenge.DifficultyChoices.MEDIUM,
            duration_minutes=20,
            points=100,
            event=self.event,
        )
        self.participant = Participant.objects.create(
            event=self.event,
            name="Student One",
            email="s1@cbit.ac.in",
            score=40,
            completed=1,
        )
        self.token = SessionService.generate_participant_token(self.participant)

        self.q1 = Question.objects.create(
            question_text="Domain used?",
            kind=Question.QuestionKindChoices.TEXT,
            correct_answer="evil.com",
            default_points=40,
        )
        ChallengeQuestion.objects.create(
            challenge=self.ch1, question=self.q1, position=1,
        )

        submission = Submission.objects.create(
            participant=self.participant,
            challenge=self.ch1,
            answers_json={str(self.q1.id): "evil.com"},
            score_earned=40,
            max_possible_score=40,
            is_passing=True,
            evaluation_results=[
                {
                    "question_id": str(self.q1.id),
                    "position": 1,
                    "points_earned": 40,
                    "is_correct": True,
                    "feedback_note": "Correct",
                }
            ],
        )

    def test_reviews_returns_all_event_challenges(self):
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token)
        url = reverse("challenge-reviews")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        challenges = response.data["data"]["challenges"]
        self.assertEqual(len(challenges), 2)
        names = {c["challenge_name"] for c in challenges}
        self.assertEqual(names, {"Operation PhishNet", "Alert Storm"})

        by_slug = {c["challenge_slug"]: c for c in challenges}
        self.assertEqual(by_slug["phishnet"]["status"], "completed")
        self.assertEqual(by_slug["phishnet"]["score_earned"], 40)
        self.assertEqual(len(by_slug["phishnet"]["questions"]), 1)
        self.assertTrue(by_slug["phishnet"]["questions"][0]["is_correct"])

        # Unsubmitted challenge is included but marked not_completed
        self.assertEqual(by_slug["alert-storm"]["status"], "not_completed")
        self.assertEqual(by_slug["alert-storm"]["questions"], [])

    def test_reviews_requires_auth(self):
        response = self.client.get(reverse("challenge-reviews"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
