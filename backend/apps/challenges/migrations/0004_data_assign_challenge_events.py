# Data migration: assign existing challenges to events based on participant activity.
#
# Strategy:
#   1. For each challenge with event=NULL, look at submissions and progress records.
#   2. Find the distinct events of those participants.
#   3. If exactly one event → assign the challenge to that event.
#   4. If multiple events → assign to the event with the most participant activity.
#   5. If no submissions/progress at all → leave as NULL (admin must assign manually).

from django.db import migrations


def assign_challenge_events(apps, schema_editor):
    Challenge = apps.get_model("challenges", "Challenge")
    Submission = apps.get_model("submissions", "Submission")
    ParticipantProgress = apps.get_model("participants", "ParticipantProgress")

    unassigned = Challenge.objects.filter(event__isnull=True)

    for challenge in unassigned:
        # Collect event IDs from submissions
        submission_event_ids = (
            Submission.objects.filter(challenge=challenge)
            .values_list("participant__event_id", flat=True)
        )

        # Collect event IDs from progress records
        progress_event_ids = (
            ParticipantProgress.objects.filter(challenge=challenge)
            .values_list("participant__event_id", flat=True)
        )

        # Combine and count
        from collections import Counter
        all_event_ids = list(submission_event_ids) + list(progress_event_ids)

        if not all_event_ids:
            # No participant activity for this challenge — skip
            continue

        event_counts = Counter(all_event_ids)
        most_common_event_id = event_counts.most_common(1)[0][0]

        challenge.event_id = most_common_event_id
        challenge.save(update_fields=["event"])


def reverse_assignment(apps, schema_editor):
    """Reverse migration: set all challenge events back to NULL."""
    Challenge = apps.get_model("challenges", "Challenge")
    Challenge.objects.all().update(event=None)


class Migration(migrations.Migration):

    dependencies = [
        ("challenges", "0003_challenge_event"),
        ("submissions", "0001_initial"),
        ("participants", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(assign_challenge_events, reverse_assignment),
    ]
