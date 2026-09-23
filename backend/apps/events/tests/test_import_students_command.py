import io
import os
import tempfile
from datetime import date

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from apps.events.models.approved_student import ApprovedStudent
from apps.events.models.event import Event


def _make_xlsx(rows):
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    return wb


class ImportStudentsCommandTests(TestCase):
    def setUp(self):
        self.event = Event.objects.create(
            college_name="JNTUH",
            workshop_name="SOC Workshop",
            event_code="JNTU2026",
            event_date=date(2026, 9, 30),
            status="Live",
        )
        self.tmpdir = tempfile.mkdtemp()

    def _write(self, filename, data):
        path = os.path.join(self.tmpdir, filename)
        with open(path, "wb") as fh:
            fh.write(data)
        return path

    def _csv(self, content, filename="students.csv"):
        return self._write(filename, content.encode("utf-8"))

    def _xlsx(self, rows, filename="students.xlsx"):
        buf = io.BytesIO()
        _make_xlsx(rows).save(buf)
        return self._write(filename, buf.getvalue())

    def test_csv_import_creates_approved_students(self):
        path = self._csv(
            "Registered Name,Registered Email\nBhavana K.,bhavana@jntuh.ac.in\nSrikanth M.,srikanth@vrsec.ac.in\n"
        )
        out = io.StringIO()
        call_command("import_students", path, "--event", "JNTU2026", stdout=out)
        self.assertEqual(ApprovedStudent.objects.filter(event=self.event).count(), 2)
        self.assertIn("Successfully imported 2", out.getvalue())

    def test_xlsx_import_creates_approved_students(self):
        path = self._xlsx([
            ["Registered Name", "Registered Email"],
            ["Bhavana K.", "bhavana@jntuh.ac.in"],
            ["Srikanth M.", "srikanth@vrsec.ac.in"],
        ])
        out = io.StringIO()
        call_command("import_students", path, "--event", "JNTU2026", stdout=out)
        self.assertEqual(ApprovedStudent.objects.filter(event=self.event).count(), 2)

    def test_dry_run_writes_nothing(self):
        path = self._csv(
            "Registered Name,Registered Email\nBhavana K.,bhavana@jntuh.ac.in\n"
        )
        out = io.StringIO()
        call_command("import_students", path, "--event", "JNTU2026", "--dry-run", stdout=out)
        self.assertEqual(ApprovedStudent.objects.count(), 0)
        self.assertIn("Dry run", out.getvalue())

    def test_rerun_is_idempotent(self):
        path = self._csv("Registered Name,Registered Email\nBhavana K.,bhavana@jntuh.ac.in\n")
        call_command("import_students", path, "--event", "JNTU2026", stdout=io.StringIO())
        call_command("import_students", path, "--event", "JNTU2026", stdout=io.StringIO())
        self.assertEqual(ApprovedStudent.objects.filter(event=self.event).count(), 1)

    def test_invalid_rows_are_reported_and_skipped(self):
        path = self._csv(
            "Registered Name,Registered Email\n"
            "Bhavana K.,bhavana@jntuh.ac.in\n"
            ",no-name@jntuh.ac.in\n"
            "NoEmail,not-an-email\n"
        )
        out = io.StringIO()
        call_command("import_students", path, "--event", "JNTU2026", stdout=out)
        self.assertEqual(ApprovedStudent.objects.count(), 1)
        self.assertIn("skipped row 3", out.getvalue())
        self.assertIn("skipped row 4", out.getvalue())

    def test_unknown_event_code_raises(self):
        path = self._csv("Registered Name,Registered Email\nX,x@y.com\n")
        with self.assertRaises(CommandError) as ctx:
            call_command("import_students", path, "--event", "NOPE2026", stdout=io.StringIO())
        self.assertIn("No event found", str(ctx.exception))

    def test_missing_file_raises(self):
        with self.assertRaises(CommandError) as ctx:
            call_command(
                "import_students",
                os.path.join(self.tmpdir, "does-not-exist.csv"),
                "--event",
                "JNTU2026",
                stdout=io.StringIO(),
            )
        self.assertIn("File not found", str(ctx.exception))

    def test_uses_lenient_event_code_matching(self):
        # EventSelector.get_by_code ignores case and hyphens, matching how the
        # student-facing validate-code endpoint resolves codes.
        path = self._csv("Registered Name,Registered Email\nBhavana K.,bhavana@jntuh.ac.in\n")
        out = io.StringIO()
        call_command("import_students", path, "--event", "jntu2026", stdout=out)
        self.assertEqual(ApprovedStudent.objects.filter(event=self.event).count(), 1)
