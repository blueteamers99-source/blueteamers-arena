from django.core.management.base import BaseCommand
from apps.challenges.models.challenge import Challenge


DEFAULT_TARGET_SLUGS = ["calc-check", "mix-flow", "mix-flow2"]


class Command(BaseCommand):
    help = (
        "Permanently deletes unused/non-canonical challenges "
        "(calc-check #99, mix-flow #9001, mix-flow2 #9002) together with all "
        "cascaded data (submissions, progress, drafts, question links, evidence)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--slug",
            action="append",
            dest="slugs",
            default=None,
            help="Challenge slug to delete. May be repeated. Defaults to the three unused challenges.",
        )

    def handle(self, *args, **options):
        slugs = options.get("slugs") or list(DEFAULT_TARGET_SLUGS)
        deleted = 0
        for slug in slugs:
            challenge = Challenge.objects.filter(slug=slug).first()
            if not challenge:
                self.stderr.write(self.style.WARNING(f"'{slug}' not found - skipping."))
                continue

            related = {
                "submissions": challenge.submissions.count(),
                "progress_rows": challenge.participant_progresses.count(),
                "drafts": challenge.participant_drafts.count(),
                "question_links": challenge.challenge_questions.count(),
                "evidence": challenge.evidence_files.count(),
            }
            self.stdout.write(
                f"Deleting '{slug}' (#{challenge.challenge_number}, {challenge.name}) - {related}"
            )
            challenge.delete()
            deleted += 1
            self.stdout.write(self.style.SUCCESS(f"  Deleted '{slug}'."))

        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} challenge(s)."))