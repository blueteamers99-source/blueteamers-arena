"""
Defence-in-depth tests for the question answer key.

The route-level permissions are covered in test_questions.py. These tests pin
the serializer's own guard, which is what stops a future mis-wiring from
re-opening the leak: AdminQuestionSerializer.to_representation() refuses to
serialise the key unless the request carries genuine staff credentials.
"""

from django.test import RequestFactory, TestCase
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIRequestFactory

from apps.accounts.models.user import User
from apps.participants.models.participant import Participant
from apps.participants.auth.participant_auth import ParticipantUserWrapper
from apps.questions.models.question import Question
from apps.questions.serializers.question_serializer import (
    AdminQuestionSerializer,
    PublicQuestionSerializer,
)


class AdminSerializerGuardTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.question = Question.objects.create(
            category=Question.CategoryChoices.PHISHING,
            difficulty=Question.DifficultyChoices.EASY,
            kind=Question.QuestionKindChoices.MCQ,
            question_text="What is the severity level of the highest alert?",
            options_json=["Low", "Medium", "High", "Critical"],
            correct_answer="Critical",
            correct_option_index=3,
            explanation="Highest severity is critical.",
            default_points=70,
        )

    def _serialize(self, request):
        # .data is what triggers to_representation — and therefore the guard.
        return AdminQuestionSerializer(self.question, context={"request": request}).data

    def test_guard_blocks_anonymous_request(self):
        request = self.factory.get("/api/v1/admin/questions/")
        request.user = None
        with self.assertRaises(PermissionDenied):
            self._serialize(request)

    def test_guard_blocks_request_with_no_request_in_context(self):
        # e.g. the serializer is reused from a management command or a report
        # builder without request context. Must fail closed, not open.
        with self.assertRaises(PermissionDenied):
            AdminQuestionSerializer(self.question).data

    def test_guard_blocks_participant_wrapper(self):
        from datetime import date
        from apps.events.models.event import Event

        event = Event.objects.create(
            college_name="CBIT",
            workshop_name="AI with SOC",
            event_code="GUARD1",
            event_date=date(2026, 7, 22),
            status=Event.StatusChoices.LIVE,
        )
        participant = Participant.objects.create(event=event, name="S", email="s@x.com")

        request = self.factory.get("/api/v1/admin/questions/")
        request.user = ParticipantUserWrapper(participant)
        with self.assertRaises(PermissionDenied):
            self._serialize(request)

    def test_guard_allows_admin(self):
        admin = User.objects.create_user(
            email="guard-admin@blueteamers.io",
            password="AdminPassword123!",
            role=User.RoleChoices.ADMIN,
        )
        request = self.factory.get("/api/v1/admin/questions/")
        request.user = admin
        data = self._serialize(request)
        self.assertEqual(data["correct_answer"], "Critical")
        self.assertEqual(data["correct_option_index"], 3)

    def test_guard_allows_super_admin(self):
        admin = User.objects.create_user(
            email="guard-super@blueteamers.io",
            password="AdminPassword123!",
            role=User.RoleChoices.SUPER_ADMIN,
        )
        request = self.factory.get("/api/v1/admin/questions/")
        request.user = admin
        self.assertEqual(self._serialize(request)["correct_answer"], "Critical")

    def test_public_serializer_never_carries_the_key(self):
        # No guard needed — the fields simply are not in the allowlist.
        data = PublicQuestionSerializer(self.question, context={}).data
        for leaked in ("correct_answer", "correct_option_index", "explanation"):
            self.assertNotIn(leaked, data)
        self.assertIn("prompt", data)
        self.assertIn("options", data)
