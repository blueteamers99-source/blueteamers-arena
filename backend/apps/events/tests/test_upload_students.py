import io
from datetime import date

from django.urls import reverse
from openpyxl import Workbook
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models.user import User
from apps.events.models.approved_student import ApprovedStudent
from apps.events.models.event import Event


def _xlsx_bytes(rows):
    """Build an in-memory xlsx file from a list of row-lists (header first)."""
    wb = Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    buf.name = "students.xlsx"
    return buf


class UploadStudentsAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_up",
            email="admin_up@blueteamers.io",
            password="AdminPass123!",
            role=User.RoleChoices.ADMIN,
            is_staff=True,
        )
        self.student_user = User.objects.create_user(
            username="student_up",
            email="student_up@blueteamers.io",
            password="StudentPass123!",
            role=User.RoleChoices.STUDENT,
        )
        self.event = Event.objects.create(
            college_name="JNTUH",
            workshop_name="SOC Workshop",
            event_code="JNTU2026",
            event_date=date(2026, 9, 30),
            status="Live",
        )
        self.url = reverse("event-upload-students", args=[self.event.id])

    def _auth_admin(self):
        self.client.force_authenticate(user=self.admin)

    # ---------------- permissions ----------------

    def test_anonymous_upload_forbidden(self):
        res = self.client.post(self.url)
        self.assertIn(res.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_student_upload_forbidden(self):
        self.client.force_authenticate(user=self.student_user)
        res = self.client.post(self.url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # ---------------- csv ----------------

    def test_csv_upload_imports_students(self):
        self._auth_admin()
        csv_content = "Registered Name,Registered Email\nBhavana K.,bhavana@jntuh.ac.in\nSrikanth M.,srikanth@vrsec.ac.in\n"
        res = self.client.post(
            self.url,
            {"file": self._named_csv(csv_content)},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])
        self.assertEqual(res.data["imported_count"], 2)
        self.assertEqual(ApprovedStudent.objects.filter(event=self.event).count(), 2)

    def _named_csv(self, content):
        from django.core.files.uploadedfile import SimpleUploadedFile

        return SimpleUploadedFile("students.csv", content.encode("utf-8"), content_type="text/csv")

    def test_csv_reupload_skips_existing(self):
        self._auth_admin()
        csv_content = "Registered Name,Registered Email\nBhavana K.,bhavana@jntuh.ac.in\n"
        self.client.post(self.url, {"file": self._named_csv(csv_content)}, format="multipart")
        # Re-upload same file: no error, imported_count still counts in-file rows,
        # but DB count stays at 1 (ignore_conflicts skipped the duplicate).
        res = self.client.post(self.url, {"file": self._named_csv(csv_content)}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(ApprovedStudent.objects.filter(event=self.event).count(), 1)

    def test_csv_bad_header_rejected(self):
        self._auth_admin()
        csv_content = "Foo,Bar\nBhavana,bhavana@jntuh.ac.in\n"
        res = self.client.post(self.url, {"file": self._named_csv(csv_content)}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res.data["success"])

    def test_csv_skips_invalid_rows_and_in_file_dupes(self):
        self._auth_admin()
        csv_content = (
            "Registered Name,Registered Email\n"
            "Bhavana K.,bhavana@jntuh.ac.in\n"          # valid
            ",missingname@jntuh.ac.in\n"                 # empty name -> skipped
            "NoEmail,not-an-email\n"                     # no @ -> skipped
            "Dupe,bhavana@jntuh.ac.in\n"                 # in-file dupe -> skipped
            "\n"                                          # blank row -> skipped
        )
        res = self.client.post(self.url, {"file": self._named_csv(csv_content)}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["imported_count"], 1)
        self.assertEqual(ApprovedStudent.objects.filter(event=self.event).count(), 1)

    # ---------------- xlsx ----------------

    def test_xlsx_upload_imports_students(self):
        self._auth_admin()
        f = _xlsx_bytes([
            ["Registered Name", "Registered Email"],
            ["Bhavana K.", "bhavana@jntuh.ac.in"],
            ["Srikanth M.", "srikanth@vrsec.ac.in"],
        ])
        res = self.client.post(self.url, {"file": f}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["success"])
        self.assertEqual(res.data["imported_count"], 2)
        self.assertEqual(ApprovedStudent.objects.filter(event=self.event).count(), 2)

    def test_xlsx_reupload_skips_existing(self):
        self._auth_admin()
        rows = [
            ["Registered Name", "Registered Email"],
            ["Bhavana K.", "bhavana@jntuh.ac.in"],
        ]
        res = self.client.post(self.url, {"file": _xlsx_bytes(rows)}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        res = self.client.post(self.url, {"file": _xlsx_bytes(rows)}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(ApprovedStudent.objects.filter(event=self.event).count(), 1)

    def test_xlsx_bad_header_rejected(self):
        self._auth_admin()
        f = _xlsx_bytes([["Foo", "Bar"], ["Bhavana", "bhavana@jntuh.ac.in"]])
        res = self.client.post(self.url, {"file": f}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res.data["success"])

    def test_xlsx_empty_file_rejected(self):
        self._auth_admin()
        f = _xlsx_bytes([])
        res = self.client.post(self.url, {"file": f}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_fuzzy_headers_accepted(self):
        self._auth_admin()
        # Headers containing 'user' and 'email' should still map correctly.
        f = _xlsx_bytes([
            ["Registered User", "Registered Email"],
            ["Bhavana K.", "bhavana@jntuh.ac.in"],
        ])
        res = self.client.post(self.url, {"file": f}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["imported_count"], 1)
        student = ApprovedStudent.objects.get(event=self.event)
        self.assertEqual(student.registered_name, "Bhavana K.")
        self.assertEqual(student.registered_email, "bhavana@jntuh.ac.in")

    def test_unsupported_extension_rejected(self):
        self._auth_admin()
        f = _xlsx_bytes([["Registered Name", "Registered Email"], ["X", "x@y.com"]])
        f.name = "students.xls"
        res = self.client.post(self.url, {"file": f}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res.data["success"])

    def test_imported_emails_are_lowercased(self):
        self._auth_admin()
        csv_content = "Registered Name,Registered Email\nBhavana K.,BHavana@JNTUH.ac.in\n"
        res = self.client.post(self.url, {"file": self._named_csv(csv_content)}, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        student = ApprovedStudent.objects.get(event=self.event)
        self.assertEqual(student.registered_email, "bhavana@jntuh.ac.in")
