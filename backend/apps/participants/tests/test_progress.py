from datetime import date
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.events.models.event import Event
from apps.participants.models.participant import Participant
from apps.participants.services.session_service import SessionService
from apps.challenges.models.challenge import Challenge
from apps.questions.models.question import Question
from apps.challenges.models.challenge_question import ChallengeQuestion


class ProgressAPITests(TestCase):
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
        self.participant = Participant.objects.create(
            event=self.event,
            name="Rahul Sharma",
            email="rahul@cbit.ac.in",
        )
        self.token = SessionService.generate_participant_token(self.participant)

        self.challenge = Challenge.objects.create(
            challenge_number=1,
            slug="phishnet",
            name="Operation PhishNet",
            description="Phishing scenario",
            brief="Analyze suspicious email headers",
            difficulty=Challenge.DifficultyChoices.EASY,
            duration_minutes=20,
            points=100,
        )
        self.question = Question.objects.create(
            category=Question.CategoryChoices.PHISHING,
            difficulty=Question.DifficultyChoices.EASY,
            kind=Question.QuestionKindChoices.TEXT,
            question_text="What is the spoofed domain?",
            correct_answer="payroll-secure-verify.com",
            default_points=100,
        )
        ChallengeQuestion.objects.create(challenge=self.challenge, question=self.question, position=1)

        self.save_draft_url = reverse("student-progress-save-draft", kwargs={"challenge_slug": "phishnet"})
        self.submit_url = reverse("student-progress-submit", kwargs={"challenge_slug": "phishnet"})
        self.retrieve_url = reverse("student-progress-detail", kwargs={"challenge_slug": "phishnet"})

    def test_save_draft_and_retrieve_progress(self):
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token)
        payload = {
            "question_id": str(self.question.id),
            "answer_text": "payroll-secure-verify.com",
            "current_question_index": 0,
        }
        res_draft = self.client.post(self.save_draft_url, payload, format="json")
        self.assertEqual(res_draft.status_code, status.HTTP_200_OK)
        self.assertTrue(res_draft.data["success"])

        res_get = self.client.get(self.retrieve_url)
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertIn(str(self.question.id), res_get.data["data"]["draft_answers"])
        self.assertEqual(res_get.data["data"]["draft_answers"][str(self.question.id)]["answer_text"], "payroll-secure-verify.com")

    def test_submit_challenge(self):
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token)
        # 1. Save correct draft answer first
        self.client.post(self.save_draft_url, {
            "question_id": str(self.question.id),
            "answer_text": "payroll-secure-verify.com",
            "current_question_index": 0,
        }, format="json")

        # 2. Submit challenge
        res_sub = self.client.post(self.submit_url)

        self.assertEqual(res_sub.status_code, status.HTTP_200_OK)
        self.assertEqual(res_sub.data["data"]["score_earned"], 100)

        # Refresh participant
        self.participant.refresh_from_db()
        self.assertEqual(self.participant.score, 100)
        self.assertEqual(self.participant.completed, 1)
