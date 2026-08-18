from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models.user import User


class AuthenticationSystemTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Admin user
        self.admin_user = User.objects.create_user(
            email="admin@blueteamers.io",
            username="admin",
            password="AdminPassword123!",
            role=User.RoleChoices.ADMIN,
            is_staff=True,
        )

        # Create Existing Student user
        self.student_user = User.objects.create_user(
            email="student@cbit.ac.in",
            username="student_cbit",
            password="StudentPassword123!",
            role=User.RoleChoices.STUDENT,
            college="CBIT",
            department="CSE",
        )

    def test_student_signup_success(self):
        payload = {
            "full_name": "Anita Verma",
            "username": "anita_v",
            "email": "anita@vnr.ac.in",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "college": "VNR",
            "department": "IT",
            "phone_number": "+91 9988776655",
        }
        response = self.client.post("/api/v1/auth/signup/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["data"]["user"]["role"], "STUDENT")
        self.assertIn("access", response.data["data"]["tokens"])

    def test_student_signup_duplicate_username_fails(self):
        payload = {
            "full_name": "Duplicate User",
            "username": "student_cbit",  # Existing username
            "email": "unique@cbit.ac.in",
            "password": "Password123!",
            "confirm_password": "Password123!",
        }
        response = self.client.post("/api/v1/auth/signup/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_student_login_via_email(self):
        payload = {
            "identifier": "student@cbit.ac.in",
            "password": "StudentPassword123!",
        }
        response = self.client.post("/api/v1/auth/login/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertIn("access", response.data["data"]["tokens"])

    def test_student_login_via_username(self):
        payload = {
            "identifier": "student_cbit",
            "password": "StudentPassword123!",
        }
        response = self.client.post("/api/v1/auth/login/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])

    @patch("apps.accounts.services.google_auth_service.GoogleAuthService.verify_google_id_token")
    def test_google_auth_student_auto_creation(self, mock_verify):
        mock_verify.return_value = {
            "iss": "accounts.google.com",
            "email": "new.google.student@college.edu",
            "name": "New Google Student",
            "email_verified": True,
        }
        payload = {
            "credential": "valid-mock-google-id-token",
        }
        response = self.client.post("/api/v1/auth/google/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["data"]["user"]["role"], "STUDENT")

    def test_admin_login_success_for_staff(self):
        payload = {
            "username_or_email": "admin@blueteamers.io",
            "password": "AdminPassword123!",
        }
        response = self.client.post("/api/v1/admin/login/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertIn("access", response.data["data"]["tokens"])

    def test_admin_login_rejection_for_student_account(self):
        payload = {
            "username_or_email": "student@cbit.ac.in",  # Student trying admin login
            "password": "StudentPassword123!",
        }
        response = self.client.post("/api/v1/admin/login/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data["success"])
