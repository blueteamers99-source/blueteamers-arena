from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date
from apps.accounts.models.user import User
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

    def test_anonymous_list_is_401(self):
        """No token — no challenge content. The pre-auth funnel is
        enter-code -> register -> play, so anonymous browsing was removed."""
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonymous_detail_is_401(self):
        """Anonymous callers must not read questions/evidence content."""
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_participant_list_is_scoped_to_their_event(self):
        """A participant of event A must not see event B's challenges in the
        list — closes the cross-event list leak."""
        event_a = Event.objects.create(
            college_name="CBIT", workshop_name="SOC A", event_code="EVA2026",
            event_date=date(2026, 9, 1), status=Event.StatusChoices.LIVE,
        )
        event_b = Event.objects.create(
            college_name="OTHER", workshop_name="SOC B", event_code="EVB2026",
            event_date=date(2026, 9, 1), status=Event.StatusChoices.LIVE,
        )
        ch_a = Challenge.objects.create(
            challenge_number=101, slug="ev-a-challenge", name="Challenge A",
            description="d", brief="b", difficulty=Challenge.DifficultyChoices.EASY,
            duration_minutes=10, points=50, event=event_a,
        )
        Challenge.objects.create(
            challenge_number=102, slug="ev-b-secret", name="PROBE SECRET CHALLENGE B",
            description="d", brief="b", difficulty=Challenge.DifficultyChoices.EASY,
            duration_minutes=10, points=50, event=event_b,
        )
        participant = Participant.objects.create(event=event_a, name="P A", email="pa@cbit.ac.in")
        token = SessionService.generate_participant_token(participant)

        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=token)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = {c["name"] for c in response.data["results"]}
        self.assertIn("Challenge A", names)
        self.assertNotIn("PROBE SECRET CHALLENGE B", names)
        self.assertTrue(all(c["slug"] != "ev-b-secret" for c in response.data["results"]))
        self.assertIsNotNone(ch_a)

    def test_participant_detail_cross_event_is_403(self):
        """Direct slug access to another event's challenge is forbidden."""
        event_b = Event.objects.create(
            college_name="OTHER", workshop_name="SOC B", event_code="EVB2026",
            event_date=date(2026, 9, 1), status=Event.StatusChoices.LIVE,
        )
        Challenge.objects.create(
            challenge_number=103, slug="ev-b-secret", name="PROBE SECRET CHALLENGE B",
            description="d", brief="b", difficulty=Challenge.DifficultyChoices.EASY,
            duration_minutes=10, points=50, event=event_b,
        )
        event_a = Event.objects.create(
            college_name="CBIT", workshop_name="SOC A", event_code="EVA2026",
            event_date=date(2026, 9, 1), status=Event.StatusChoices.LIVE,
        )
        participant = Participant.objects.create(event=event_a, name="P A", email="pa@cbit.ac.in")
        token = SessionService.generate_participant_token(participant)

        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=token)
        response = self.client.get(reverse("challenge-detail", kwargs={"slug": "ev-b-secret"}))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_participant_sees_eventless_challenges_when_event_has_none(self):
        """Fallback parity with the review endpoints: an event with no linked
        challenges still shows the global event-less set."""
        event_a = Event.objects.create(
            college_name="CBIT", workshop_name="SOC A", event_code="EVA2026",
            event_date=date(2026, 9, 1), status=Event.StatusChoices.LIVE,
        )
        Participant.objects.create(event=event_a, name="P A", email="pa@cbit.ac.in")
        token = SessionService.generate_participant_token(
            Participant.objects.get(email="pa@cbit.ac.in")
        )

        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=token)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = {c["name"] for c in response.data["results"]}
        self.assertIn("Operation PhishNet", names)  # the event-less setUp challenge

    def test_admin_can_list_and_retrieve(self):
        """Admin JWTs authenticate on this viewset and see all challenges
        (this was silently broken before — the auth override hid JWT users)."""
        admin = User.objects.create_user(email="admin@cbit.ac.in", role=User.RoleChoices.ADMIN)
        admin.set_password("S3curePass!123")
        admin.save()
        from rest_framework_simplejwt.tokens import RefreshToken
        jwt = str(RefreshToken.for_user(admin).access_token)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {jwt}")
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

        detail = self.client.get(self.detail_url)
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["slug"], "phishnet")

    def test_user_token_student_without_participant_is_401(self):
        """A plain user-token student (no participant record) gets 401 — the
        strict posture agreed for this endpoint."""
        student = User.objects.create_user(email="stu@cbit.ac.in", role=User.RoleChoices.STUDENT)
        student.set_password("S3curePass!123")
        student.save()
        from rest_framework_simplejwt.tokens import RefreshToken
        jwt = str(RefreshToken.for_user(student).access_token)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {jwt}")
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


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


class ReviewAnswerKeyGatingTests(TestCase):
    """
    The review endpoints return the answer key, so they must not hand a student
    the key to a question they can still go and attempt elsewhere.

    ChallengeQuestion is many-to-many, so the same Question row can sit in two
    challenges. A student who submits challenge 1 could otherwise read the key
    off the review page and paste it into challenge 3 without attempting it.
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
        # Attempted by the student.
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
        # Not attempted — still playable.
        self.ch3 = Challenge.objects.create(
            challenge_number=3,
            slug="final-hunt",
            name="Final Hunt",
            description="Correlation scenario",
            brief="Correlate every artefact",
            difficulty=Challenge.DifficultyChoices.HARD,
            duration_minutes=20,
            points=100,
            event=self.event,
        )

        # Shared between the submitted challenge and an unattempted one.
        self.shared_question = Question.objects.create(
            kind=Question.QuestionKindChoices.TEXT,
            question_text="Which domain?",
            correct_answer="evil.com",
            explanation="Return-Path shows it.",
            default_points=20,
        )
        # Only in the submitted challenge.
        self.unique_question = Question.objects.create(
            kind=Question.QuestionKindChoices.MCQ,
            question_text="Highest severity?",
            options_json=["Low", "Critical"],
            correct_answer="Critical",
            correct_option_index=1,
            default_points=20,
        )
        ChallengeQuestion.objects.create(challenge=self.ch1, question=self.shared_question, position=1)
        ChallengeQuestion.objects.create(challenge=self.ch3, question=self.shared_question, position=1)
        ChallengeQuestion.objects.create(challenge=self.ch1, question=self.unique_question, position=2)

        self.participant = Participant.objects.create(
            event=self.event,
            name="Student One",
            email="s1@cbit.ac.in",
        )
        self.token = SessionService.generate_participant_token(self.participant)
        Submission.objects.create(
            participant=self.participant,
            challenge=self.ch1,
            answers_json={
                str(self.shared_question.id): "evil.com",
                str(self.unique_question.id): "Critical",
            },
            score_earned=40,
            max_possible_score=40,
            is_passing=True,
            evaluation_results=[],
        )

    def _review_payload(self):
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token)
        response = self.client.get(reverse("challenge-review", kwargs={"slug": "phishnet"}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return {q["question_id"]: q for q in response.data["data"]["questions"]}

    def test_withholds_key_for_question_reused_by_an_unattempted_challenge(self):
        payload = self._review_payload()
        row = payload[str(self.shared_question.id)]
        self.assertFalse(row["answer_key_released"])
        self.assertIsNone(row["correct_answer"])
        self.assertIsNone(row["explanation"])
        # The student must still see their own attempt and the score impact.
        self.assertEqual(row["student_answer"], "evil.com")

    def test_releases_key_for_question_unique_to_the_submitted_challenge(self):
        payload = self._review_payload()
        row = payload[str(self.unique_question.id)]
        self.assertTrue(row["answer_key_released"])
        self.assertEqual(row["correct_answer"], "Critical")
        self.assertEqual(row["correct_option_index"], 1)

    def test_reviews_collection_applies_the_same_gating(self):
        self.client.credentials(HTTP_X_PARTICIPANT_TOKEN=self.token)
        response = self.client.get(reverse("challenge-reviews"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        by_slug = {c["challenge_slug"]: c for c in response.data["data"]["challenges"]}
        rows = {q["question_id"]: q for q in by_slug["phishnet"]["questions"]}
        self.assertFalse(rows[str(self.shared_question.id)]["answer_key_released"])
        self.assertIsNone(rows[str(self.shared_question.id)]["correct_answer"])
        self.assertTrue(rows[str(self.unique_question.id)]["answer_key_released"])

    def test_key_is_released_once_the_event_is_over(self):
        # Post-mortem review is the whole point of the page — once the event
        # closes, nothing is withheld.
        self.event.status = Event.StatusChoices.COMPLETED
        self.event.save(update_fields=["status"])

        # A participant token is refused for non-Live events, so authenticate
        # as a staff-side user carrying the participant relation.
        user = User.objects.create_user(email="reviewer@cbit.ac.in", role=User.RoleChoices.ADMIN)
        user.participant = self.participant
        self.client.force_authenticate(user=user)

        response = self.client.get(reverse("challenge-review", kwargs={"slug": "phishnet"}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = {q["question_id"]: q for q in response.data["data"]["questions"]}
        shared = rows[str(self.shared_question.id)]
        self.assertTrue(shared["answer_key_released"])
        self.assertEqual(shared["correct_answer"], "evil.com")
        self.assertEqual(shared["explanation"], "Return-Path shows it.")
