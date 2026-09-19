from datetime import date
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.events.models.event import Event
from apps.events.models.approved_student import ApprovedStudent
from apps.participants.models.participant import Participant


class ParticipantsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.event = Event.objects.create(
            college_name="CBIT",
            workshop_name="AI with SOC Workshop",
            event_code="CBIT2026",
            event_date=date(2026, 7, 22),
            duration_minutes=60,
            status=Event.StatusChoices.LIVE,
        )
        self.register_url = reverse("participant-register-student")

    def test_register_student_success(self):
        # Student must be pre-approved (hardcoded via CSV / admin) to register.
        ApprovedStudent.objects.create(
            event=self.event,
            registered_name="Rahul Sharma",
            registered_email="rahul.s@cbit.ac.in",
        )
        payload = {
            "event_id": str(self.event.id),
            "name": "Rahul Sharma",
            "email": "rahul.s@cbit.ac.in",
        }
        response = self.client.post(self.register_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        self.assertEqual(Participant.objects.count(), 1)

        participant = Participant.objects.first()
        self.assertEqual(participant.name, "Rahul Sharma")
        self.assertEqual(participant.email, "rahul.s@cbit.ac.in")
        self.assertEqual(participant.event, self.event)

    def test_register_rejected_without_approved_list(self):
        # No approved list uploaded for the event: even a valid event code
        # does NOT grant access. Open registration is gone.
        payload = {
            "event_id": str(self.event.id),
            "name": "Random Stranger",
            "email": "stranger@other.edu",
        }
        response = self.client.post(self.register_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["success"])
        self.assertEqual(Participant.objects.count(), 0)

    def test_register_rejected_when_email_not_on_list(self):
        # List exists, but this student never filled the Google Form.
        ApprovedStudent.objects.create(
            event=self.event,
            registered_name="Rahul Sharma",
            registered_email="rahul.s@cbit.ac.in",
        )
        payload = {
            "event_id": str(self.event.id),
            "name": "Someone Else",
            "email": "not.on@cbit.ac.in",
        }
        response = self.client.post(self.register_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Participant.objects.count(), 0)

    def test_register_rejected_when_name_mismatches(self):
        # Email is on the list but the name doesn't match the Google Form
        # entry — rejected with a precise hint.
        ApprovedStudent.objects.create(
            event=self.event,
            registered_name="Rahul Sharma",
            registered_email="rahul.s@cbit.ac.in",
        )
        payload = {
            "event_id": str(self.event.id),
            "name": "Rahul Verma",
            "email": "rahul.s@cbit.ac.in",
        }
        response = self.client.post(self.register_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name does not match", response.data["message"])
        self.assertEqual(Participant.objects.count(), 0)

    def test_register_case_insensitive_match(self):
        # Case differences in name/email must not reject genuine students.
        ApprovedStudent.objects.create(
            event=self.event,
            registered_name="Rahul Sharma",
            registered_email="rahul.s@cbit.ac.in",
        )
        payload = {
            "event_id": str(self.event.id),
            "name": "rahul SHARMA",
            "email": "Rahul.S@CBIT.AC.IN",
        }
        response = self.client.post(self.register_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Participant.objects.count(), 1)
