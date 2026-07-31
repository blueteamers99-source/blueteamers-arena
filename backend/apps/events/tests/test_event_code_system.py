from datetime import date, timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from apps.events.models.event import Event
from apps.events.services.event_service import EventService, normalize_event_code
from apps.accounts.models.user import User


class EventCodeSystemTestCase(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            email="admin_event_test@blueteamers.io",
            username="admin_event_test",
            password="AdminPassword123",
        )

        self.event = Event.objects.create(
            college_name="CBIT",
            workshop_name="SOC Defense Championship",
            event_code="CBIT-3154",
            event_date=date.today(),
            status=Event.StatusChoices.LIVE,
        )

    def test_code_normalization(self):
        self.assertEqual(normalize_event_code("cbit-3154"), "CBIT-3154")
        self.assertEqual(normalize_event_code("CBIT3154"), "CBIT-3154")
        self.assertEqual(normalize_event_code("CBIT 3154"), "CBIT-3154")
        self.assertEqual(normalize_event_code("  cbit - 3154  "), "CBIT-3154")

    def test_auto_code_generation(self):
        code = EventService.generate_event_code("Vasavi College")
        self.assertTrue(code.startswith("VASAVI-"))
        self.assertEqual(len(code.split("-")[1]), 4)

    def test_validate_code_api_success(self):
        url = "/api/v1/events/validate-code/"
        # Test lowercase & space variations
        variations = ["CBIT-3154", "cbit-3154", "CBIT3154", "CBIT 3154"]
        for code in variations:
            response = self.client.post(url, {"event_code": code}, format="json")
            self.assertEqual(response.status_code, status.HTTP_200_OK, f"Failed for code: {code}")
            self.assertTrue(response.data.get("success"))
            self.assertEqual(response.data["event"]["event_code"], "CBIT-3154")

    def test_validate_code_api_invalid_code(self):
        url = "/api/v1/events/validate-code/"
        response = self.client.post(url, {"event_code": "INVALID-9999"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data.get("success"))
        self.assertEqual(response.data.get("message"), "Invalid Event Code")

    def test_completed_event_rejection(self):
        self.event.status = Event.StatusChoices.COMPLETED
        self.event.save()

        url = "/api/v1/events/validate-code/"
        response = self.client.post(url, {"event_code": "CBIT-3154"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data.get("success"))

    def test_expired_registration_rejection(self):
        self.event.registration_close_at = timezone.now() - timedelta(days=1)
        self.event.save()

        url = "/api/v1/events/validate-code/"
        response = self.client.post(url, {"event_code": "CBIT-3154"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data.get("success"))

    def test_regenerate_event_code_admin_api(self):
        self.client.force_authenticate(user=self.admin_user)
        url = f"/api/v1/events/{self.event.id}/regenerate-code/"
        response = self.client.post(url, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get("success"))
        new_code = response.data.get("event_code")
        self.assertNotEqual(new_code, "CBIT-3154")
        self.assertTrue(new_code.startswith("CBIT-"))
