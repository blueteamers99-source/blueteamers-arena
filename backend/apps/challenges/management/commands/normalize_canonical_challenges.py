from django.core.management.base import BaseCommand
from apps.challenges.models.challenge import Challenge
from apps.challenges.models.challenge_question import ChallengeQuestion
from apps.questions.models.question import Question
from apps.challenges.management.commands.seed_existing_challenges import (
    EXISTING_FIVE_CHALLENGES as CANONICAL_CHALLENGES,
)


class Command(BaseCommand):
    help = (
        "Restores the five canonical challenges to their authoritative question sets "
        "(challenge.points = 100/150/100/250/400) and backfills Submission.max_possible_score "
        "and ParticipantProgress.max_possible_score so every user sees the same per-challenge maximum."
    )

    def handle(self, *args, **options):
        # 1. Relink each canonical challenge to exactly its canonical question set.
        for item in CANONICAL_CHALLENGES:
            ch = Challenge.objects.filter(slug=item["slug"]).first()
            if not ch:
                self.stderr.write(self.style.WARNING(f"Skipping '{item['slug']}' - challenge does not exist."))
                continue

            canonical_questions = []
            for pos, q_item in enumerate(item.get("questions", []), start=1):
                kind = q_item.get("kind", "text")
                q, _ = Question.objects.update_or_create(
                    question_text=q_item.get("prompt", ""),
                    defaults={
                        "kind": kind,
                        "correct_answer": q_item.get("correct_answer", ""),
                        "correct_option_index": q_item.get("correct_option_index"),
                        "default_points": q_item.get("points", 25),
                        "status": Question.StatusChoices.PUBLISHED,
                    },
                )
                canonical_questions.append((pos, q))
                ChallengeQuestion.objects.update_or_create(
                    challenge=ch,
                    question=q,
                    defaults={"position": pos},
                )

            # 2. Drop any stale ChallengeQuestion links that pollute the max (e.g. the
            #    170-point PhishNet caused by seeders that appended questions).
            canonical_q_ids = {q.id for _, q in canonical_questions}
            stale_links = ChallengeQuestion.objects.filter(challenge=ch).exclude(question_id__in=canonical_q_ids)
            stale_count = stale_links.count()
            stale_links.delete()
            if stale_count:
                self.stdout.write(self.style.WARNING(f"  '{ch.slug}': removed {stale_count} stale question link(s)."))

        # 3. Backfill max_possible_score + is_passing for every submission and progress
        #    row, keyed to the challenge's authoritative points value.
        from django.db.models import Case, When, Value, BooleanField
        from apps.submissions.models.submission import Submission
        from apps.participants.models.participant_progress import ParticipantProgress

        submissions_updated = 0
        for challenge in Challenge.objects.all():
            max_possible = challenge.points or 0
            passing_pct = challenge.passing_percentage or 60
            threshold = int(max_possible * (passing_pct / 100))

            is_passing_expr = Case(
                When(score_earned__gte=threshold, then=Value(True)),
                default=Value(False),
                output_field=BooleanField(),
            )

            updated = Submission.objects.filter(challenge=challenge).update(
                max_possible_score=max_possible,
                is_passing=is_passing_expr,
            )
            submissions_updated += updated
            ParticipantProgress.objects.filter(challenge=challenge).update(max_possible_score=max_possible)

        self.stdout.write(self.style.SUCCESS(
            f"Backfilled Submission.max_possible_score (is_passing recomputed) for {submissions_updated} row(s); "
            "ParticipantProgress.max_possible_score aligned to challenge.points."
        ))
        self.stdout.write(self.style.SUCCESS("Normalization complete."))