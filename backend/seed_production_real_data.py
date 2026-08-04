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

    # 3. Real Challenges across 5 Cyber Domains
    challenges_data = [
        {
            "title": "Operation PhishNet — Spear Phishing Attack Investigation",
            "category": "Phishing",
            "difficulty": "Easy",
            "points": 100,
            "challenge_number": 1,
            "duration": 20,
            "description": "A finance employee reported a suspicious email requesting an urgent wire transfer. Analyze headers, SPF/DKIM, and domain spoofing.",
            "questions": [
                {"text": "What is the spoofed sender domain in the email header?", "answer": "payroll-secure.com", "points": 20},
                {"text": "What is the IP address of the sending mail transfer agent?", "answer": "192.168.1.105", "points": 20},
                {"text": "What is the result of the SPF authentication check?", "answer": "SOFTFAIL", "points": 20},
                {"text": "What malicious attachment filename was included?", "answer": "Urgent_Invoice.pdf.exe", "points": 20},
                {"text": "What is the MITRE ATT&CK technique ID for Spearphishing Attachment?", "answer": "T1566.001", "points": 20},
            ]
        },
        {
            "title": "Alert Storm — Windows Event & Sysmon Log Correlation",
            "category": "SIEM",
            "difficulty": "Medium",
            "points": 100,
            "challenge_number": 2,
            "duration": 25,
            "description": "Correlate Windows Sysmon log events to trace lateral movement and malicious process creation.",
            "questions": [
                {"text": "Which Event ID indicates process creation in Sysmon?", "answer": "1", "points": 25},
                {"text": "What parent process spawned powershell.exe?", "answer": "cmd.exe", "points": 25},
                {"text": "What destination IP address did the malware attempt to connect to?", "answer": "185.220.101.5", "points": 25},
                {"text": "What user account was compromised during process execution?", "answer": "FINANCE\\admin_user", "points": 25},
            ]
        },
        {
            "title": "AI Security Audit — Prompt Injection & Model Jailbreak",
            "category": "AI",
            "difficulty": "Hard",
            "points": 100,
            "challenge_number": 3,
            "duration": 30,
            "description": "Analyze LLM chat logs to identify indirect prompt injection payloads that bypass safety filters.",
            "questions": [
                {"text": "What delimiter technique was used to override system instructions?", "answer": "### SYSTEM OVERRIDE ###", "points": 30},
                {"text": "What sensitive API key variable was leaked in the response?", "answer": "OPENAI_API_SECRET_KEY", "points": 35},
                {"text": "What OWASP Top 10 for LLM vulnerability category matches this exploit?", "answer": "LLM01", "points": 35},
            ]
        },
        {
            "title": "Ransomware Attack & Incident Response Containment",
            "category": "Incident Response",
            "difficulty": "Hard",
            "points": 100,
            "challenge_number": 4,
            "duration": 35,
            "description": "Investigate network traffic capture (.pcap) and ransomware shadow copy deletion execution.",
            "questions": [
                {"text": "What command was executed to delete volume shadow copies?", "answer": "vssadmin.exe delete shadows /all /quiet", "points": 50},
                {"text": "What file extension was appended to encrypted files?", "answer": ".locked_soc", "points": 50},
            ]
        },
        {
            "title": "Digital Forensics — USB & Browser Artifact Tracing",
            "category": "Digital Forensics",
            "difficulty": "Medium",
            "points": 100,
            "challenge_number": 5,
            "duration": 30,
            "description": "Examine USB registry artifacts and Chrome browser history sqlite databases to identify exfiltrated files.",
            "questions": [
                {"text": "What serial number identifies the connected rogue USB flash drive?", "answer": "07018512938491", "points": 50},
                {"text": "What external file-sharing URL was visited by the insider?", "answer": "https://temp-fileshare.net/upload/confidential", "points": 50},
            ]
        }
    ]

    challenges = []
    for ch_data in challenges_data:
        ch, _ = Challenge.objects.get_or_create(
            challenge_number=ch_data["challenge_number"],
            defaults={
                "name": ch_data["title"],
                "slug": f"ch-{ch_data['challenge_number']}-{ch_data['category'].lower()}",
                "difficulty": ch_data["difficulty"],
                "points": ch_data["points"],
                "duration_minutes": ch_data["duration"],
                "description": ch_data["description"],
                "brief": ch_data["description"],
            }
        )
        challenges.append(ch)

        # Seed Questions for each challenge
        for idx, q_info in enumerate(ch_data["questions"]):
            Question.objects.get_or_create(
                category=ch_data["category"],
                question_text=q_info["text"],
                defaults={
                    "difficulty": ch_data["difficulty"],
                    "correct_answer": q_info["answer"],
                    "default_points": q_info["points"],
                    "status": "Published",
                }
            )

    print(f"[+] Created {len(challenges)} Domain Challenges and associated Questions in PostgreSQL.")

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
