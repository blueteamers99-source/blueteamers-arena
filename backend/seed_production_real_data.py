import os
import sys

# Setup Django environment
# NOTE: config.settings.base has no DATABASES config — DB settings live in
# development.py / production.py. Default to development so the script can
# actually run locally; an env var can still override the target settings.
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

import django

django.setup()

from django.db import transaction
from django.utils import timezone

from apps.events.models.event import Event
from apps.events.models.approved_student import ApprovedStudent
from apps.participants.models.participant import Participant
from apps.participants.models.participant_progress import ParticipantProgress
from apps.challenges.models.challenge import Challenge
from apps.submissions.models.submission import Submission

# Demo dataset: scores are internally consistent — participant.score is the
# exact sum of the per-challenge score_earned values generated below.
students_list = [
    {"name": "Akhil Krishna", "email": "akhil@vrsec.ac.in", "college": "VRSEC", "score": 470, "completed": 5},
    {"name": "Rahul Kumar", "email": "rahul@cbit.ac.in", "college": "CBIT", "score": 450, "completed": 5},
    {"name": "Sai Teja", "email": "saiteja@jntuh.ac.in", "college": "JNTUH", "score": 430, "completed": 4},
    {"name": "Divya Sharma", "email": "divya@iitm.ac.in", "college": "IITM", "score": 410, "completed": 4},
    {"name": "Jaswanth Naik", "email": "jaswanth@vrsec.ac.in", "college": "VRSEC", "score": 390, "completed": 4},
    {"name": "Anusha Reddy", "email": "anusha@nitw.ac.in", "college": "NITW", "score": 350, "completed": 3},
    {"name": "Karthik Varma", "email": "karthik@vrsec.ac.in", "college": "VRSEC", "score": 320, "completed": 3},
    {"name": "Sneha Rao", "email": "sneha@cbit.ac.in", "college": "CBIT", "score": 280, "completed": 2},
    {"name": "Bhavana K.", "email": "bhavana@jntuh.ac.in", "college": "JNTUH", "score": 240, "completed": 2},
    {"name": "Srikanth M.", "email": "srikanth@vrsec.ac.in", "college": "VRSEC", "score": 180, "completed": 1},
]

# Duration of the (already finished) event, used to fabricate coherent
# started_at / finished_at timestamps for rank "time taken" display.
EVENT_DURATION_MINUTES = 240


def distribute_score(total_score: int, completed: int) -> list:
    """
    Split `total_score` into `completed` per-challenge parts as evenly as
    possible; the remainder goes to the earliest challenges.
    Guarantees sum(parts) == total_score.
    """
    if completed <= 0:
        return []
    base = total_score // completed
    remainder = total_score % completed
    return [base + (1 if i < remainder else 0) for i in range(completed)]


def seed_real_data(reset_scores: bool = False):
    print("[+] Starting PostgreSQL Real Production Data Seeding...")
    if reset_scores:
        print("[!] --reset flag active: existing participant scores WILL be overwritten with demo values.")

    now = timezone.now()
    event_start = now - timezone.timedelta(minutes=EVENT_DURATION_MINUTES)

    # Main Active Event
    event, _ = Event.objects.get_or_create(
        event_code="VRSEC-2026",
        defaults={
            "workshop_name": "VRSEC National SOC Blue Team Championship 2026",
            "college_name": "VRSEC",
            "event_date": now.date(),
            "passing_score": 600,
            "total_challenges": 5,
            "status": "Completed",
        }
    )
    print(f"[+] Event: {event.workshop_name} (Code: {event.event_code})")

    # Real Challenges across 5 Cyber Domains
    from django.core.management import call_command
    call_command("seed_existing_challenges")
    challenges = list(Challenge.objects.order_by("challenge_number"))

    created_participants = 0
    created_progress = 0
    created_submissions = 0

    with transaction.atomic():
        for s_info in students_list:
            # Approve student email
            ApprovedStudent.objects.get_or_create(
                registered_email=s_info["email"],
                event=event,
                defaults={"registered_name": s_info["name"]}
            )

            # Participant keyed on (email, event) — matches DB unique_together.
            # `defaults` apply only on CREATE, so re-running the seed never
            # clobbers real scores. Overwriting requires the explicit --reset flag.
            participant_defaults = {
                "name": s_info["name"],
                "score": s_info["score"],
                "completed": s_info["completed"],
                "started_at": event_start,
                "finished_at": now,
            }
            p, created = Participant.objects.get_or_create(
                email=s_info["email"],
                event=event,
                defaults=participant_defaults,
            )
            if created:
                created_participants += 1
            elif reset_scores:
                for field, value in participant_defaults.items():
                    setattr(p, field, value)
                p.save()
                print(f"    [reset] {p.email}: score/completed overwritten with demo values.")

            # Coherent per-challenge earnings: sum(parts) == participant.score
            earned_parts = distribute_score(s_info["score"], s_info["completed"])

            # Create Participant Progress + matching Submission records so
            # review pages and per-challenge history work for seeded users.
            for i in range(s_info["completed"]):
                ch = challenges[i]
                earned = earned_parts[i]
                completed_at = event_start + timezone.timedelta(
                    minutes=EVENT_DURATION_MINUTES * (i + 1) // (s_info["completed"] + 1)
                )

                _, prog_created = ParticipantProgress.objects.get_or_create(
                    participant=p,
                    challenge=ch,
                    defaults={
                        "status": "COMPLETED",
                        "score_earned": earned,
                        "completed_at": completed_at,
                    }
                )
                if prog_created:
                    created_progress += 1

                _, sub_created = Submission.objects.get_or_create(
                    participant=p,
                    challenge=ch,
                    defaults={
                        "answers_json": {},
                        "score_earned": earned,
                        "max_possible_score": ch.points or 100,
                        "is_passing": earned >= (ch.points or 100) * (ch.passing_percentage / 100),
                        "evaluation_results": [],
                    }
                )
                if sub_created:
                    created_submissions += 1

    print(f"[+] Participants created: {created_participants} "
          f"(skipped {len(students_list) - created_participants} existing; use --reset to overwrite scores)")
    print(f"[+] Progress records created: {created_progress}")
    print(f"[+] Submission records created: {created_submissions}")
    print(f"[+] Successfully seeded {len(students_list)} Real Student Records in PostgreSQL.")
    print("[+] Seeding Complete! Real-time data is stored in PostgreSQL and ready for live testing!")


if __name__ == "__main__":
    seed_real_data(reset_scores="--reset" in sys.argv)
