"""
Shared student-import pipeline for populating the approved-student whitelist.

Used by two entry points that MUST behave identically:
  - POST /api/v1/events/{id}/upload-students/   (event_viewset.py)
  - python manage.py import_students            (management command)

Both feed raw rows (list of cell-lists, header row first) into
`extract_students()`, which handles header fuzzy-matching, row
validation, and in-file de-duplication. Persistence is left to the
caller via `import_roster()`.
"""

import csv
import io


class RosterImportError(Exception):
    """Raised for expected validation problems (bad type, bad headers, empty file)."""


def parse_roster_rows(file_obj, filename):
    """Dispatch on filename extension and return rows of cell-strings, header row first."""
    filename = (filename or "").lower()
    if filename.endswith(".xlsx"):
        return _rows_from_xlsx(file_obj)
    if filename.endswith(".csv"):
        return _rows_from_csv(file_obj)
    raise RosterImportError("Unsupported file type. Please upload a .csv or .xlsx file.")


def _rows_from_csv(file_obj):
    file_obj.seek(0)
    content = file_obj.read().decode("utf-8-sig", errors="ignore")
    return list(csv.reader(io.StringIO(content)))


def _rows_from_xlsx(file_obj):
    try:
        import openpyxl
    except ImportError as exc:
        raise RosterImportError(
            "Server is missing the openpyxl package; xlsx uploads are unavailable."
        ) from exc
    file_obj.seek(0)
    try:
        workbook = openpyxl.load_workbook(file_obj, read_only=True, data_only=True)
    except Exception as exc:
        raise RosterImportError(f"Failed to parse file: {exc}") from exc
    try:
        sheet = workbook.active
        return [
            [("" if cell is None else str(cell)) for cell in row]
            for row in sheet.iter_rows(values_only=True)
        ]
    finally:
        workbook.close()


def find_name_email_columns(headers):
    """Fuzzy-match the name and email columns. Last matching name-column wins
    (same semantics the upload endpoint has always used)."""
    name_idx = -1
    email_idx = -1
    for i, h in enumerate(headers):
        h = (h or "").strip().lower()
        if "name" in h or "user" in h or "student" in h:
            name_idx = i
        elif "email" in h:
            email_idx = i
    return name_idx, email_idx


def extract_students(rows):
    """
    Validate rows and return (students, skipped):
      - students: list of (name, email) tuples, de-duplicated by email
      - skipped:  list of (row_number, reason) — 1-based, header counts as row 1
    Raises RosterImportError for empty files or missing required columns.
    """
    if not rows:
        raise RosterImportError("The uploaded file is empty.")

    name_idx, email_idx = find_name_email_columns(rows[0])
    if name_idx == -1 or email_idx == -1:
        raise RosterImportError(
            "File header must contain 'Registered Name' and 'Registered Email' columns."
        )

    students = []
    skipped = []
    seen_emails = set()
    for row_number, row in enumerate(rows[1:], start=2):
        if not row or len(row) <= max(name_idx, email_idx):
            continue
        name_val = row[name_idx].strip()
        email_val = row[email_idx].strip().lower()
        if not name_val and not email_val:
            continue  # fully blank row
        if not name_val:
            skipped.append((row_number, "missing name"))
            continue
        if not email_val or "@" not in email_val:
            skipped.append((row_number, "missing or invalid email"))
            continue
        if email_val in seen_emails:
            skipped.append((row_number, "duplicate email in file"))
            continue
        seen_emails.add(email_val)
        students.append((name_val, email_val))
    return students, skipped


def import_roster(file_obj, filename, event, dry_run=False):
    """
    Full pipeline shared by the upload endpoint and the import_students command.
    Returns a dict summary; expected validation problems come back as
    {"success": False, "message": ...} instead of raising.
    """
    from apps.events.models.approved_student import ApprovedStudent

    try:
        rows = parse_roster_rows(file_obj, filename)
        students, skipped = extract_students(rows)
    except RosterImportError as exc:
        return {"success": False, "message": str(exc)}

    if dry_run:
        return {
            "success": True,
            "dry_run": True,
            "imported_count": len(students),
            "skipped": skipped,
            "event_code": event.event_code,
            "message": (
                f"Dry run: {len(students)} rows would be imported for {event.event_code} "
                f"({len(skipped)} skipped). No changes written."
            ),
        }

    if students:
        ApprovedStudent.objects.bulk_create(
            [
                ApprovedStudent(event=event, registered_name=name, registered_email=email)
                for name, email in students
            ],
            ignore_conflicts=True,
        )

    total_count = ApprovedStudent.objects.filter(event=event).count()
    message = f"Successfully imported {len(students)} approved students for {event.event_code}."
    if skipped:
        message += f" {len(skipped)} rows skipped."
    return {
        "success": True,
        "dry_run": False,
        "imported_count": len(students),
        "skipped": skipped,
        "total_approved_students": total_count,
        "event_code": event.event_code,
        "message": message,
    }
