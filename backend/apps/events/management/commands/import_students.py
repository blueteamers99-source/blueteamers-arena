"""
Import an approved-students roster (.csv or .xlsx) from the command line.

This is the backend-only path for populating a event's student whitelist —
no admin UI required. Students in the whitelist can then log into the arena
at /student with their name + email and the event code.

Examples:
    python manage.py import_students students.xlsx --event JNTU2026
    python manage.py import_students students.csv --event JNTU2026 --dry-run

Idempotent: rows whose (event, email) already exist are skipped, so re-running
the same file never errors and never duplicates.
"""

import os

from django.core.management.base import BaseCommand, CommandError

from apps.events.selectors.event_selector import EventSelector
from apps.events.services.student_import_service import import_roster


class Command(BaseCommand):
    help = (
        "Import an approved-students roster (.csv or .xlsx) into one event's "
        "whitelist so those students can log into the arena."
    )

    def add_arguments(self, parser):
        parser.add_argument("file", help="Path to the roster file (.csv or .xlsx)")
        parser.add_argument(
            "--event",
            required=True,
            help="Event code of the target event, e.g. JNTU2026",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate the file and report what would happen without writing to the database.",
        )

    def handle(self, *args, **options):
        path = options["file"]
        if not os.path.isfile(path):
            raise CommandError(f"File not found: {path}")

        event = EventSelector.get_by_code(options["event"])
        if event is None:
            raise CommandError(
                f"No event found for code '{options['event']}'. "
                "Check the code on the Events page or the events_event table."
            )

        with open(path, "rb") as fh:
            result = import_roster(
                fh,
                filename=os.path.basename(path),
                event=event,
                dry_run=options["dry_run"],
            )

        if not result["success"]:
            raise CommandError(result["message"])

        style = self.style.WARNING if result.get("dry_run") else self.style.SUCCESS
        self.stdout.write(style(result["message"]))

        skipped = result.get("skipped") or []
        for row_number, reason in skipped[:20]:
            self.stdout.write(f"  skipped row {row_number}: {reason}")
        if len(skipped) > 20:
            self.stdout.write(f"  ... and {len(skipped) - 20} more skipped rows")
