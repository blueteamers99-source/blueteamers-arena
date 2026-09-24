from datetime import date, timedelta
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
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

    def _start_clock(self):
        """Mirror the real flow: the workspace click starts the event clock."""
        self.participant.started_at = timezone.now()
        self.participant.save(update_fields=["started_at"])

    def test_save_draft_and_retrieve_progress(self):
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token)
        self._start_clock()
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
        self._start_clock()
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

    def test_submit_rejected_when_event_timer_expired(self):
        """The 2:30:00 window is a hard server-side wall: once the event-wide
        clock runs out, submit must be rejected even though the event is
        still marked Live and the UI timer now shows --:--:--."""
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token)
        # Clock started 61 minutes ago on a 60-minute event → expired.
        self.participant.started_at = timezone.now() - timedelta(minutes=61)
        self.participant.save(update_fields=["started_at"])

        self.client.post(self.save_draft_url, {
            "question_id": str(self.question.id),
            "answer_text": "payroll-secure-verify.com",
            "current_question_index": 0,
        }, format="json")

        res_sub = self.client.post(self.submit_url)
        self.assertEqual(res_sub.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("expired", str(res_sub.data["message"]).lower())

        # Nothing was graded or scored after the deadline.
        self.participant.refresh_from_db()
        self.assertEqual(self.participant.score, 0)
        self.assertEqual(self.participant.completed, 0)

    def test_draft_save_is_noop_after_expiry(self):
        """Auto-save after expiry must not write any new answers."""
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token)
        self._start_clock()
        # Save one answer BEFORE expiry
        self.client.post(self.save_draft_url, {
            "question_id": str(self.question.id),
            "answer_text": "before-deadline.com",
            "current_question_index": 0,
        }, format="json")

        # Expire the clock, then attempt another save
        self.participant.started_at = timezone.now() - timedelta(minutes=61)
        self.participant.save(update_fields=["started_at"])
        res = self.client.post(self.save_draft_url, {
            "question_id": str(self.question.id),
            "answer_text": "after-deadline.com",
            "current_question_index": 0,
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        res_get = self.client.get(self.retrieve_url)
        saved = res_get.data["data"]["draft_answers"][str(self.question.id)]["answer_text"]
        self.assertEqual(saved, "before-deadline.com")

    def test_start_challenge_rejects_completed_event(self):
        """The clock can never start on a non-LIVE event (no free 2:30 window
        after the event has been closed)."""
        self.event.status = Event.StatusChoices.COMPLETED
        self.event.save()
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token)
        response = self.client.post(reverse("student-progress-start", kwargs={"challenge_slug": "phishnet"}))
        # 401 because session-token auth itself requires a LIVE event;
        # the server refuses both layers — auth and the clock start.
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
        self.participant.refresh_from_db()
        self.assertIsNone(self.participant.started_at)
