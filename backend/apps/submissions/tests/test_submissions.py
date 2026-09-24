from datetime import date
from django.utils import timezone
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
from apps.submissions.models.submission import Submission


class SubmissionsAPITests(TestCase):
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
            name="Submitting Student",
            email="submitting@cbit.ac.in",
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
            default_points=10,
        )
        ChallengeQuestion.objects.create(challenge=self.challenge, question=self.question, position=1)
        self.submit_url = reverse("challenge-submit", kwargs={"slug": "phishnet"})

    def test_submit_challenge_answers(self):
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token)
        # Real flow: the workspace click starts the event-wide clock before
        # any submission is accepted.
        self.participant.started_at = timezone.now()
        self.participant.save(update_fields=["started_at"])
        payload = {
            "answers": {
                str(self.question.id): "payroll-secure-verify.com"
            }
        }
        response = self.client.post(self.submit_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(Submission.objects.count(), 1)

        sub = Submission.objects.first()
        self.assertEqual(sub.score_earned, 10)
        self.assertEqual(sub.participant, self.participant)
