import json
import uuid
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from apps.accounts.models.user import User
from apps.events.models.event import Event
from apps.challenges.models.challenge import Challenge
from apps.questions.models.question import Question
from apps.challenges.models.challenge_question import ChallengeQuestion
from apps.participants.models.participant import Participant
from apps.participants.models.participant_progress import ParticipantProgress
from apps.submissions.models.submission import Submission
from apps.participants.services.session_service import SessionService


class SecurityRemediationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Admin user
        self.admin_user = User.objects.create_user(
            username="admin_sec",
            email="admin_sec@blueteamers.io",
            password="AdminPassword123!",
            role=User.RoleChoices.ADMIN,
            is_staff=True,
        )

        # Student user
        self.student_user = User.objects.create_user(
            username="student_sec",
            email="student_sec@blueteamers.io",
            password="StudentPassword123!",
            role=User.RoleChoices.STUDENT,
        )

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

        # Participant in Event A
        self.participant_a = Participant.objects.create(
            name="Alice Defender",
            email="alice@cyber.edu",
            event=self.event_a,
            score=0,
            completed=0,
        )
        self.token_a = SessionService.generate_participant_token(self.participant_a)

        # Participant in Event B
        self.participant_b = Participant.objects.create(
            name="Bob Analyst",
            email="bob@academy.edu",
            event=self.event_b,
            score=0,
            completed=0,
        )
        self.token_b = SessionService.generate_participant_token(self.participant_b)

        # Challenge 1
        self.challenge_a1 = Challenge.objects.create(
            challenge_number=1,
            name="Phishing Attack Analysis",
            slug="phishing-attack-analysis",
            description="Investigate spear phishing incident",
            brief="Investigate the suspicious incoming email",
            difficulty="Easy",
            points=100,
        )

        # Question for Challenge 1
        self.question_q1 = Question.objects.create(
            category="Phishing",
            kind=Question.QuestionKindChoices.TEXT,
            question_text="What is the malicious sender email domain?",
            correct_answer="evil-attacker.com",
            default_points=100,
            difficulty="Easy",
        )
        ChallengeQuestion.objects.create(
            challenge=self.challenge_a1,
            question=self.question_q1,
            position=1,
        )

        # Challenge 2
        self.challenge_b1 = Challenge.objects.create(
            challenge_number=2,
            name="SIEM Log Investigation",
            slug="siem-log-investigation",
            description="Investigate Splunk alerts",
            brief="Examine authentication telemetry",
            difficulty="Medium",
            points=150,
        )

    # -------------------------------------------------------------
    # F-04: Admin API Security Tests
    # -------------------------------------------------------------
    def test_admin_dashboard_anonymous_rejected(self):
        """TEST 1: Anonymous request to admin dashboard returns 401/403."""
        response = self.client.get("/api/v1/admin/dashboard/")
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_admin_dashboard_student_token_forbidden(self):
        """TEST 2: Student user cannot access admin dashboard."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get("/api/v1/admin/dashboard/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_dashboard_admin_token_success(self):
        """TEST 3: Authenticated admin can access admin dashboard."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get("/api/v1/admin/dashboard/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @staticmethod
    def _start_event_clock(participant):
        """Mirror the real flow: opening a workspace starts the event clock."""
        from django.utils import timezone as tz
        participant.started_at = tz.now()
        participant.save(update_fields=["started_at"])

    # -------------------------------------------------------------
    # F-01: Google OAuth Server-side Verification
    # -------------------------------------------------------------
    def test_fake_google_credential_rejected(self):
        """TEST 4: Fake Google credential with admin email fails server-side verification."""
        response = self.client.post(
            "/api/v1/auth/google/",
            {"credential": "fake_invalid_token_12345", "email": "admin@blueteamers.io"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # -------------------------------------------------------------
    # F-02: Participant Dashboard IDOR Protection
    # -------------------------------------------------------------
    def test_dashboard_idor_prevented(self):
        """TEST 5: Querying dashboard with another user's email without auth returns 401."""
        response = self.client.get(f"/api/v1/participants/dashboard/?email={self.participant_a.email}")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # -------------------------------------------------------------
    # F-05: Server-side Answer Evaluation & Grading Tests
    # -------------------------------------------------------------
    def test_empty_challenge_submission_no_full_score(self):
        """TEST 6: Empty challenge submission awards 0 points."""
        self._start_event_clock(self.participant_a)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_a}")
        response = self.client.post(
            f"/api/v1/challenges/{self.challenge_a1.slug}/submit/",
            {"answers": {}},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.participant_a.refresh_from_db()
        self.assertEqual(self.participant_a.score, 0)

    def test_correct_answer_awards_points(self):
        """TEST 7: Submitting ground-truth answer calculates and awards points."""
        self._start_event_clock(self.participant_a)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_a}")
        response = self.client.post(
            f"/api/v1/challenges/{self.challenge_a1.slug}/submit/",
            {"answers": {str(self.question_q1.id): "evil-attacker.com"}},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.participant_a.refresh_from_db()
        self.assertEqual(self.participant_a.score, 100)

    def test_wrong_answer_awards_zero_points(self):
        """TEST 8: Submitting wrong answer gives 0 points."""
        self._start_event_clock(self.participant_a)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_a}")
        response = self.client.post(
            f"/api/v1/challenges/{self.challenge_a1.slug}/submit/",
            {"answers": {str(self.question_q1.id): "legitimate-domain.org"}},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.participant_a.refresh_from_db()
        self.assertEqual(self.participant_a.score, 0)

    def test_duplicate_submission_does_not_inflate_score(self):
        """TEST 9: Submitting the same correct challenge twice does not double score."""
        self._start_event_clock(self.participant_a)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_a}")
        # Submission 1
        self.client.post(
            f"/api/v1/challenges/{self.challenge_a1.slug}/submit/",
            {"answers": {str(self.question_q1.id): "evil-attacker.com"}},
            format="json",
        )
        self.participant_a.refresh_from_db()
        first_score = self.participant_a.score
        self.assertEqual(first_score, 100)

        # Submission 2 (re-submit)
        self.client.post(
            f"/api/v1/challenges/{self.challenge_a1.slug}/submit/",
            {"answers": {str(self.question_q1.id): "evil-attacker.com"}},
            format="json",
        )
        self.participant_a.refresh_from_db()
        self.assertEqual(self.participant_a.score, 100)

    # -------------------------------------------------------------
    # F-06 / F-07: Cross-Event Challenge Isolation
    # -------------------------------------------------------------
    def test_cross_event_challenge_access_denied(self):
        """TEST 10: Participant A cannot submit answers to Challenge B (Event B)."""
        self.challenge_b1.event = self.event_b
        self.challenge_b1.save()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_a}")
        response = self.client.post(
            f"/api/v1/challenges/{self.challenge_b1.slug}/submit/",
            {"answers": {}},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------
    # F-03: Certificate Security & Server Eligibility
    # -------------------------------------------------------------
    def test_anonymous_certificate_list_rejected(self):
        """TEST 11: Anonymous certificate list request returns 401."""
        response = self.client.get("/api/v1/certificate/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_certificate_locked_before_passing_score(self):
        """TEST 12: Certificate is locked when participant score < passing_score."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_a}")
        self.participant_a.score = 100  # passing score is 300
        self.participant_a.save()

        response = self.client.get("/api/v1/certificate/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data.get("unlocked"))
        self.assertEqual(response.data.get("status"), "LOCKED")

    def test_fake_certificate_verification_id_invalid(self):
        """TEST 13: Unauthenticated certificate verify request returns 401 (participant auth required)."""
        response = self.client.get("/api/v1/certificate/verify/CERT-BLUETEAM-FAKE9999/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # -------------------------------------------------------------
    # F-10: Approved Students CSV Authorization
    # -------------------------------------------------------------
    def test_anonymous_csv_upload_forbidden(self):
        """TEST 14: Anonymous user cannot upload student CSV."""
        response = self.client.post(f"/api/v1/events/{self.event_a.id}/upload-students/")
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_student_csv_upload_forbidden(self):
        """TEST 15: Student cannot upload student CSV."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.post(f"/api/v1/events/{self.event_a.id}/upload-students/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------
    # F-12: Challenge & Question Creation Authorization
    # -------------------------------------------------------------
    def test_anonymous_challenge_creation_forbidden(self):
        """TEST 16: Anonymous user cannot create challenges."""
        response = self.client.post(
            "/api/v1/challenges/",
            {"name": "Hacker Challenge", "points": 500},
            format="json",
        )
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_student_challenge_creation_forbidden(self):
        """TEST 17: Student cannot create challenges."""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.post(
            "/api/v1/challenges/",
            {"name": "Student Exploit Challenge", "points": 500},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_question_creation_forbidden(self):
        """TEST 18: Anonymous user cannot create questions."""
        response = self.client.post(
            "/api/v1/questions/",
            {"question_text": "Exploit question", "correct_answer": "secret"},
            format="json",
        )
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    # -------------------------------------------------------------
    # Finding #1: Cross-Event Evidence IDOR Remediation
    # -------------------------------------------------------------
    def test_cross_event_evidence_access_denied(self):
        """Participant A (Event A) cannot read evidence from a challenge in Event B."""
        from apps.challenges.models.evidence import Evidence

        self.challenge_b1.event = self.event_b
        self.challenge_b1.save()
        Evidence.objects.create(
            challenge=self.challenge_b1,
            artifact_key="auth-log",
            label="Auth Log Dump",
            filename="auth.log",
            content_text="SENSITIVE-EVENT-B-LOG-CONTENT",
        )

        # Participant A (Event A) — must be denied
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_a}")
        response = self.client.get(f"/api/v1/challenges/{self.challenge_b1.slug}/evidence/auth-log/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Participant B (Event B, owner) — must succeed
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_b}")
        response = self.client.get(f"/api/v1/challenges/{self.challenge_b1.slug}/evidence/auth-log/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get("data", {}).get("content_text"), "SENSITIVE-EVENT-B-LOG-CONTENT")

    def test_same_event_evidence_access_allowed(self):
        """Participant A can read evidence for a challenge in their own event."""
        from apps.challenges.models.evidence import Evidence

        self.challenge_a1.event = self.event_a
        self.challenge_a1.save()
        Evidence.objects.create(
            challenge=self.challenge_a1,
            artifact_key="phishing-email",
            label="Phishing Email",
            filename="email.txt",
            content_text="Suspicious email body",
        )

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_a}")
        response = self.client.get(f"/api/v1/challenges/{self.challenge_a1.slug}/evidence/phishing-email/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_anonymous_evidence_access_denied(self):
        """Anonymous requests to evidence are rejected."""
        response = self.client.get(f"/api/v1/challenges/{self.challenge_a1.slug}/evidence/any-key/")
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    # -------------------------------------------------------------
    # Finding #2: Certificate Verify/Download Require Participant Auth
    # -------------------------------------------------------------
    def test_certificate_verify_requires_authentication(self):
        """Unauthenticated verify requests return 401 — no public PII disclosure."""
        cert_id = f"CERT-BLUETEAM-{self.participant_a.id}"
        response = self.client.get(f"/api/v1/certificate/verify/{cert_id}/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_certificate_verify_ownership_enforced(self):
        """Participant A cannot verify Participant B's certificate."""
        cert_id = f"CERT-BLUETEAM-{self.participant_b.id}"
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_a}")
        response = self.client.get(f"/api/v1/certificate/verify/{cert_id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_certificate_download_requires_authentication(self):
        """Unauthenticated PDF download returns 401."""
        cert_id = f"CERT-BLUETEAM-{self.participant_a.id}"
        response = self.client.get(f"/api/v1/certificate/download/{cert_id}/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_certificate_download_ownership_enforced(self):
        """Participant A cannot download Participant B's certificate PDF."""
        cert_id = f"CERT-BLUETEAM-{self.participant_b.id}"
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token_a}")
        response = self.client.get(f"/api/v1/certificate/download/{cert_id}/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------
    # Finding #3: Seed Endpoint Must Not Accept GET
    # -------------------------------------------------------------
    def test_seed_data_get_method_not_allowed(self):
        """GET on seed-data returns 405 — destructive seeding is POST-only."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get("/api/v1/admin/seed-data/")
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    # -------------------------------------------------------------
    # Finding #4: is_staff Alone Must Not Grant Admin Access
    # -------------------------------------------------------------
    def test_staff_only_user_denied_admin_api(self):
        """A user with is_staff=True but role=STUDENT is NOT an admin."""
        staff_only = User.objects.create_user(
            username="staff_only_sec",
            email="staff_only_sec@blueteamers.io",
            password="StaffPassword123!",
            role=User.RoleChoices.STUDENT,
            is_staff=True,
        )
        self.assertFalse(staff_only.is_admin_role)
        self.client.force_authenticate(user=staff_only)
        response = self.client.get("/api/v1/admin/dashboard/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
