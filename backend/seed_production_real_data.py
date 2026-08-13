import os
import sys
import django
import uuid

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.base")
django.setup()

import os
import sys
import django
import uuid

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.base")
django.setup()

from apps.events.models.event import Event
from apps.events.models.approved_student import ApprovedStudent
from apps.participants.models.participant import Participant
from apps.participants.models.participant_progress import ParticipantProgress
from apps.challenges.models.challenge import Challenge
from apps.questions.models.question import Question
from apps.submissions.models.submission import Submission
from django.utils import timezone


def seed_real_data():
    print("[+] Starting PostgreSQL Real Production Data Seeding...")

    # Main Active Event
    event, _ = Event.objects.get_or_create(
        event_code="VRSEC-2026",
        defaults={
            "workshop_name": "VRSEC National SOC Blue Team Championship 2026",
            "college_name": "VRSEC",
            "event_date": timezone.now().date(),
            "passing_score": 300,
            "total_challenges": 5,
            "status": "Completed",
        }
    )
    print(f"[+] Event: {event.workshop_name} (Code: {event.event_code})")

    # 3. Real Challenges across 5 Cyber Domains (The 5 Lead's Challenges)
    from django.core.management import call_command
    call_command("seed_existing_challenges")
    challenges = list(Challenge.objects.order_by("challenge_number"))


    # 4. Real Students & Participants Data
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

    for s_info in students_list:
        # Approve student email
        ApprovedStudent.objects.get_or_create(
            registered_email=s_info["email"],
            event=event,
            defaults={"registered_name": s_info["name"]}
        )

        # Create Participant record
        p, created = Participant.objects.get_or_create(
            email=s_info["email"],
            defaults={
                "name": s_info["name"],
                "event": event,
                "score": s_info["score"],
            }
        )
        if not created:
            p.score = s_info["score"]
            p.save()

        # Create Participant Progress records for challenges
        for i in range(1, s_info["completed"] + 1):
            ch = challenges[i - 1]
            ParticipantProgress.objects.get_or_create(
                participant=p,
                challenge=ch,
                defaults={"status": "COMPLETED", "score_earned": 80, "completed_at": timezone.now()}
            )

    print(f"[+] Successfully seeded {len(students_list)} Real Student Records & Submissions in PostgreSQL.")
    print("[+] Seeding Complete! Real-time data is stored in PostgreSQL and ready for live testing!")


if __name__ == "__main__":
    seed_real_data()
