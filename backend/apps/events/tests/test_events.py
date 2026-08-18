from datetime import date
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models.user import User
from apps.events.models.event import Event


class EventsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="eventadmin@blueteamers.io",
            password="AdminPassword123!",
            role=User.RoleChoices.ADMIN,
        )
        self.event = Event.objects.create(
            college_name="CBIT",
            workshop_name="AI with SOC Workshop",
            event_code="CBIT2026",
            event_date=date(2026, 7, 22),
            duration_minutes=60,
            status=Event.StatusChoices.LIVE,
        )
        self.list_url = reverse("event-list")
        self.detail_url = reverse("event-detail", kwargs={"pk": str(self.event.id)})
        self.verify_url = reverse("event-verify-code")

    def test_list_events_admin_required(self):
        # Unauthenticated request returns 401
        response_unauth = self.client.get(self.list_url)
        self.assertEqual(response_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

        # Authenticated Admin request returns 200
        self.client.force_authenticate(user=self.admin)
        response_auth = self.client.get(self.list_url)
        self.assertEqual(response_auth.status_code, status.HTTP_200_OK)

    def test_verify_event_code_success(self):
        response = self.client.post(
            self.verify_url,
            {"code": "cbit2026"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["data"]["event_code"], "CBIT2026")

    def test_create_event_admin_required(self):
        payload = {
            "college_name": "VNR",
            "workshop_name": "Cyber Workshop",
            "event_code": "VNR2026",
            "event_date": "2026-07-25",
            "duration_minutes": 60,
        }
        # Unauthenticated request should fail
        res_unauth = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(res_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

        # Authenticated Admin request should succeed
        self.client.force_authenticate(user=self.admin)
        res_auth = self.client.post(self.list_url, payload, format="json")
        self.assertEqual(res_auth.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Event.objects.count(), 2)
