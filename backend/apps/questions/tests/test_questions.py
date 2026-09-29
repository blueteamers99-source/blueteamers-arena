from datetime import date

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.challenges.models.challenge import Challenge
from apps.challenges.models.challenge_question import ChallengeQuestion
from apps.events.models.event import Event
from apps.participants.models.participant import Participant
from apps.participants.services.session_service import SessionService
from apps.questions.models.question import Question


class QuestionRouteSecurityTests(TestCase):
    """
    Contract for the two question routes after they were split into
    AdminQuestionViewSet and PublicQuestionViewSet.

    Before the split a single QuestionViewSet served both URLs: its
    get_permissions() opened list/retrieve to anonymous callers while its
    get_serializer_class() picked the answer-key serializer off the "admin"
    substring in the path. An unauthenticated GET /api/v1/admin/questions/
    therefore returned every question's correct_answer and
    correct_option_index. These tests pin the fixed behaviour.
    """

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="qadmin@blueteamers.io",
            password="AdminPassword123!",
            role=User.RoleChoices.ADMIN,
        )

        self.event = Event.objects.create(
            college_name="CBIT",
            workshop_name="AI with SOC",
            event_code="CBIT2026",
            event_date=date(2026, 7, 22),
            duration_minutes=60,
            status=Event.StatusChoices.LIVE,
        )
        self.other_event = Event.objects.create(
            college_name="VIT",
            workshop_name="AI with SOC",
            event_code="VIT2026",
            event_date=date(2026, 7, 23),
            duration_minutes=60,
            status=Event.StatusChoices.LIVE,
        )
        self.participant = Participant.objects.create(
            event=self.event,
            name="Student One",
            email="s1@cbit.ac.in",
        )
        self.token = SessionService.generate_participant_token(self.participant)

        self.challenge = Challenge.objects.create(
            challenge_number=1,
            slug="phishnet",
            name="Operation PhishNet",
            description="Phishing investigation scenario",
            brief="Analyze suspicious email headers",
            difficulty=Challenge.DifficultyChoices.EASY,
            duration_minutes=20,
            points=100,
            event=self.event,
        )
        self.other_challenge = Challenge.objects.create(
            challenge_number=2,
            slug="alert-storm",
            name="Alert Storm",
            description="SIEM investigation scenario",
            brief="Analyze SIEM alerts",
            difficulty=Challenge.DifficultyChoices.MEDIUM,
            duration_minutes=20,
            points=100,
            event=self.other_event,
        )

        self.question = Question.objects.create(
            category=Question.CategoryChoices.PHISHING,
            difficulty=Question.DifficultyChoices.EASY,
            kind=Question.QuestionKindChoices.MCQ,
            question_text="What is the spoofed sender domain?",
            options_json=["evil.com", "cbit.ac.in", "gmail.com"],
            correct_answer="evil.com",
            correct_option_index=0,
            explanation="Return-Path shows the envelope sender.",
            default_points=10,
        )
        ChallengeQuestion.objects.create(challenge=self.challenge, question=self.question, position=1)

        self.other_event_question = Question.objects.create(
            category=Question.CategoryChoices.SIEM,
            difficulty=Question.DifficultyChoices.MEDIUM,
            kind=Question.QuestionKindChoices.TEXT,
            question_text="Which alert fired first?",
            correct_answer="Rule 100",
            default_points=15,
        )
        ChallengeQuestion.objects.create(
            challenge=self.other_challenge, question=self.other_event_question, position=1,
        )

        self.admin_list_url = reverse("admin-questions-list")
        self.admin_detail_url = reverse("admin-questions-detail", kwargs={"pk": str(self.question.id)})
        self.public_list_url = reverse("question-list")
        self.public_detail_url = reverse("question-detail", kwargs={"pk": str(self.question.id)})

    # --- admin route: the answer key lives here, so every action is gated ---

    def test_admin_question_list_rejects_anonymous(self):
        response = self.client.get(self.admin_list_url)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_admin_question_detail_rejects_anonymous(self):
        response = self.client.get(self.admin_detail_url)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_admin_question_list_rejects_participant_token(self):
        # A student token must not authenticate against the admin route at all.
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token)
        response = self.client.get(self.admin_list_url)
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_admin_question_list_includes_answer_key_for_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.admin_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item = next(r for r in response.data["results"] if r["id"] == str(self.question.id))
        self.assertEqual(item["correct_answer"], "evil.com")
        self.assertEqual(item["correct_option_index"], 0)
        self.assertEqual(item["explanation"], "Return-Path shows the envelope sender.")

    def test_admin_question_detail_includes_answer_key_for_admin(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.admin_detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["correct_answer"], "evil.com")
        self.assertEqual(response.data["correct_option_index"], 0)

    def test_create_question_admin(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "category": "SIEM",
            "difficulty": "Medium",
            "kind": "mcq",
            "question_text": "What level alert is critical in Wazuh?",
            "options_json": ["Level 3", "Level 7", "Level 12", "Level 15"],
            "correct_option_index": 3,
            "explanation": "Level 15 is critical.",
            "default_points": 15,
        }
        response = self.client.post(self.admin_list_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Question.objects.filter(question_text=payload["question_text"]).exists())

    # --- public route: no answer key, no anonymous access, no writes ---

    def test_public_question_list_rejects_anonymous(self):
        response = self.client.get(self.public_list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_public_question_list_strips_answer_key(self):
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token)
        response = self.client.get(self.public_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item = next(r for r in response.data["results"] if r["id"] == str(self.question.id))
        self.assertIn("prompt", item)
        for leaked in ("correct_answer", "correct_option_index", "explanation"):
            self.assertNotIn(leaked, item)

    def test_public_question_detail_strips_answer_key(self):
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token)
        response = self.client.get(self.public_detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("prompt", response.data)
        for leaked in ("correct_answer", "correct_option_index", "explanation"):
            self.assertNotIn(leaked, response.data)

    def test_public_question_list_is_scoped_to_participant_event(self):
        # A participant must not be able to read questions that belong to a
        # different event's challenges.
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token)
        response = self.client.get(self.public_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in response.data["results"]}
        self.assertIn(str(self.question.id), ids)
        self.assertNotIn(str(self.other_event_question.id), ids)

    def test_public_question_route_exposes_no_write_actions(self):
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token)
        payload = {
            "category": "SIEM",
            "difficulty": "Medium",
            "kind": "mcq",
            "question_text": "Injected by an attacker",
            "options_json": ["a", "b"],
            "correct_option_index": 0,
        }
        for method, url in (
            ("post", self.public_list_url),
            ("put", self.public_detail_url),
            ("patch", self.public_detail_url),
            ("delete", self.public_detail_url),
        ):
            with self.subTest(method=method):
                response = getattr(self.client, method)(url, payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(Question.objects.filter(question_text="Injected by an attacker").count(), 0)

    def test_public_question_detail_outside_event_is_not_found(self):
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token)
        url = reverse("question-detail", kwargs={"pk": str(self.other_event_question.id)})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_can_still_browse_the_full_bank_on_the_public_route(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.public_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {r["id"] for r in response.data["results"]}
        self.assertIn(str(self.other_event_question.id), ids)
        # ...but still through the answer-key-free serializer.
        for row in response.data["results"]:
            self.assertNotIn("correct_answer", row)
