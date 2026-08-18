from datetime import date
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.accounts.models.user import User
from apps.events.models.event import Event
from apps.events.models.event_question import EventQuestion
from apps.questions.models.question import Question
from apps.challenges.models.challenge import Challenge
from apps.challenges.models.evidence import Evidence
from apps.challenges.models.challenge_question import ChallengeQuestion


class Command(BaseCommand):
    help = "Seeds initial demo events, CTF challenges, evidence files, questions, and admin users for Blueteamers Arena."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Starting Blueteamers Arena demo seeding..."))

        # 1. Create Admins
        admin_password = os.getenv("DJANGO_SUPERUSER_PASSWORD", os.getenv("ADMIN_PASSWORD"))
        admin_user, created = User.objects.get_or_create(
            email="admin@blueteamers.io",
            defaults={
                "username": "admin@blueteamers.io",
                "first_name": "Event",
                "last_name": "Admin",
                "role": User.RoleChoices.ADMIN,
                "is_staff": True,
            },
        )
        if created:
            if admin_password:
                admin_user.set_password(admin_password)
            admin_user.save()
            self.stdout.write(self.style.SUCCESS("Created admin user: admin@blueteamers.io"))

        # 2. Create Events
        events_data = [
            {"college_name": "CBIT", "workshop_name": "AI with SOC Workshop", "event_code": "CBIT2026", "date": date(2026, 7, 22), "accent": "blue", "status": Event.StatusChoices.LIVE},
            {"college_name": "VNR", "workshop_name": "AI with SOC Workshop", "event_code": "VNR2026", "date": date(2026, 7, 22), "accent": "green", "status": Event.StatusChoices.LIVE},
            {"college_name": "MGIT", "workshop_name": "AI with Cybersecurity", "event_code": "MGIT2026", "date": date(2026, 7, 22), "accent": "purple", "status": Event.StatusChoices.UPCOMING},
            {"college_name": "JNTU", "workshop_name": "AI with SOC", "event_code": "JNTU2026", "date": date(2026, 7, 22), "accent": "orange", "status": Event.StatusChoices.LIVE},
        ]

        created_events = []
        for ed in events_data:
            ev, _ = Event.objects.update_or_create(
                event_code=ed["event_code"],
                defaults={
                    "college_name": ed["college_name"],
                    "workshop_name": ed["workshop_name"],
                    "event_date": ed["date"],
                    "duration_minutes": 60,
                    "passing_score": 600,
                    "total_challenges": 5,
                    "accent_color": ed["accent"],
                    "status": ed["status"],
                    "created_by": admin_user,
                },
            )
            created_events.append(ev)
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(created_events)} events."))

        # 3. Create Challenges & Evidence
        challenges_data = [
            {
                "num": 1,
                "slug": "phishnet",
                "name": "Operation PhishNet",
                "desc": "Investigate a suspicious phishing email and identify malicious indicators.",
                "brief": "A finance employee reported a suspicious email requesting an urgent wire transfer. Analyze the message headers, embedded links, and attachments to determine whether this is a phishing attempt and identify the indicators of compromise.",
                "diff": Challenge.DifficultyChoices.EASY,
                "duration": 20,
                "points": 100,
                "skills": ["Email Forensics", "Header Analysis", "URL Reputation"],
                "objectives": [
                    "Identify the spoofed sender domain",
                    "Extract malicious URLs from the email body",
                    "Determine the phishing technique used",
                ],
                "evidence": [
                    {
                        "key": "headers",
                        "label": "Email Headers",
                        "filename": "email-headers.txt",
                        "format": Evidence.FormatChoices.TXT,
                        "content": (
                            "Return-Path: <payroll-noreply@payroll-secure-verify.com>\n"
                            "Received: from mx-inbound.corp.local (10.24.8.12) by mail.corp.local\n"
                            "        with Microsoft SMTP Server id 15.2.986.9; Tue, 04 Feb 2026 09:14:22 -0600\n"
                            "Authentication-Results: mx-inbound.corp.local;\n"
                            "        spf=fail (sender IP is 185.216.71.42) smtp.mailfrom=payroll-secure-verify.com;\n"
                            "        dkim=none (message not signed);\n"
                            "        dmarc=fail action=quarantine header.from=corp-payroll.com\n"
                            "From: \"Corporate Payroll\" <no-reply@corp-payroll.com>\n"
                            "Reply-To: hr-verify@payroll-secure-verify.com\n"
                            "To: employee@corp.local\n"
                            "Subject: [ACTION REQUIRED] Verify Your Payroll Information\n"
                        ),
                    },
                    {
                        "key": "email-screenshot",
                        "label": "Email Screenshot",
                        "filename": "email-screenshot.png",
                        "format": Evidence.FormatChoices.PNG,
                        "image_url": "/assets/evidence-email.png",
                    },
                ],
                "questions": [
                    {"text": "What is the spoofed sender domain?", "cat": "Phishing", "diff": "Easy", "kind": "text", "pts": 30, "ans": "payroll-secure-verify.com"},
                    {"text": "Identify the suspicious IP address of the originating mail server.", "cat": "Phishing", "diff": "Easy", "kind": "text", "pts": 30, "ans": "185.216.71.42"},
                    {"text": "What authentication check failed in the email headers?", "cat": "Phishing", "diff": "Easy", "kind": "mcq", "opts": ["DKIM Only", "SPF and DMARC", "TLS Encryption", "DNSSEC"], "correct_idx": 1, "pts": 40, "ans": "SPF and DMARC"},
                ],
            },
            {
                "num": 2,
                "slug": "alert-storm",
                "name": "Alert Storm",
                "desc": "Analyze SIEM / Wazuh alerts and identify the security incident.",
                "brief": "Multiple security alerts were triggered in the environment within a short window. Analyze the Wazuh alerts, system logs, and network captures to correlate the events and answer the questions below.",
                "diff": Challenge.DifficultyChoices.MEDIUM,
                "duration": 30,
                "points": 150,
                "skills": ["SIEM Analysis", "Wazuh", "Log Correlation"],
                "objectives": [
                    "Correlate related alerts across sources",
                    "Identify the attacker source IP",
                    "Rate the severity of the incident",
                ],
                "evidence": [
                    {
                        "key": "wazuh-alerts",
                        "label": "Wazuh Alerts",
                        "filename": "wazuh-alerts.json",
                        "format": Evidence.FormatChoices.JSON,
                        "content": '{\n  "alerts": [\n    {"id": 101, "level": 12, "rule": "SSH Brute Force", "src_ip": "198.51.100.44", "user": "root"},\n    {"id": 102, "level": 15, "rule": "Web Shell Upload", "src_ip": "198.51.100.44", "target": "/var/www/html/shell.php"}\n  ]\n}',
                    },
                ],
                "questions": [
                    {"text": "What type of attack was detected?", "cat": "SIEM", "diff": "Medium", "kind": "text", "pts": 40, "ans": "SSH Brute Force / Web Shell Upload"},
                    {"text": "What is the source IP address of the attacker?", "cat": "SIEM", "diff": "Medium", "kind": "text", "pts": 40, "ans": "198.51.100.44"},
                    {"text": "What is the severity level of the highest alert?", "cat": "SIEM", "diff": "Medium", "kind": "mcq", "opts": ["Low", "Medium", "High", "Critical"], "correct_idx": 3, "pts": 70, "ans": "Critical"},
                ],
            },
            {
                "num": 3,
                "slug": "ai-defender",
                "name": "AI Defender",
                "desc": "Use AI to investigate a security scenario and produce the best response.",
                "brief": "An AI-powered SOC Assistant has flagged suspicious activity on an internal workstation. Review both the AI summary and raw host telemetry to validate whether the AI's conclusions are accurate.",
                "diff": Challenge.DifficultyChoices.MEDIUM,
                "duration": 25,
                "points": 100,
                "skills": ["AI Tooling", "Threat Analysis", "Response Playbooks"],
                "objectives": [
                    "Validate the AI findings against raw evidence",
                    "Identify the suspicious process chain",
                    "Determine the malicious destination IP",
                ],
                "evidence": [
                    {
                        "key": "ai-summary",
                        "label": "AI Summary",
                        "filename": "ai-summary.txt",
                        "format": Evidence.FormatChoices.TXT,
                        "content": "AI SOC ASSISTANT SUMMARY\nHost: WKST-FIN-014\nChain: WINWORD.EXE -> powershell.exe -> rundll32.exe\nBeaconing IP: 45.147.230.19\n",
                    },
                    {
                        "key": "host-telemetry",
                        "label": "Host Telemetry",
                        "filename": "host-telemetry.json",
                        "format": Evidence.FormatChoices.JSON,
                        "content": '{\n  "events": [\n    {"ts": "14:02:50", "type": "process_start", "name": "powershell.exe", "ppid": 4820},\n    {"ts": "14:02:55", "type": "network_connect", "dst_ip": "45.147.230.19", "dst_port": 443}\n  ]\n}',
                    },
                ],
                "questions": [
                    {"text": "What suspicious process execution was detected on the endpoint?", "cat": "AI", "diff": "Medium", "kind": "text", "pts": 50, "ans": "powershell.exe"},
                    {"text": "Which external IP address did the compromised host communicate with?", "cat": "AI", "diff": "Medium", "kind": "text", "pts": 50, "ans": "45.147.230.19"},
                ],
            },
            {
                "num": 4,
                "slug": "incident-zero",
                "name": "Incident Zero",
                "desc": "Respond to a real-world security incident using incident response methodology.",
                "brief": "A critical alert indicates lateral movement across the network. Follow the incident response lifecycle to triage, contain, and document the incident.",
                "diff": Challenge.DifficultyChoices.HARD,
                "duration": 35,
                "points": 250,
                "skills": ["Incident Response", "Triage", "Containment"],
                "objectives": [
                    "Classify the incident type",
                    "Identify patient zero",
                    "Choose the correct IR phase to execute next",
                ],
                "evidence": [
                    {
                        "key": "ir-runbook",
                        "label": "IR Runbook",
                        "filename": "ir-runbook.txt",
                        "format": Evidence.FormatChoices.TXT,
                        "content": "INCIDENT RESPONSE RUNBOOK\nPatient Zero: HR-LT-032\nCompromised Account: svc-backup\nC2 IP: 194.180.48.71\n",
                    },
                ],
                "questions": [
                    {"text": "Which endpoint is patient zero?", "cat": "Incident Response", "diff": "Hard", "kind": "text", "pts": 100, "ans": "HR-LT-032"},
                    {"text": "Which IR phase should be executed next?", "cat": "Incident Response", "diff": "Hard", "kind": "mcq", "opts": ["Identification", "Containment", "Eradication", "Recovery"], "correct_idx": 1, "pts": 150, "ans": "Containment"},
                ],
            },
            {
                "num": 5,
                "slug": "final-hunt",
                "name": "Final Hunt",
                "desc": "Perform digital forensics and build the complete attack timeline.",
                "brief": "You have full forensic artifacts from a completed intrusion. Analyze the evidence and reconstruct the attacker's timeline from initial access to actions on objectives.",
                "diff": Challenge.DifficultyChoices.HARD,
                "duration": 40,
                "points": 400,
                "skills": ["Digital Forensics", "Timeline Analysis", "Threat Hunting"],
                "objectives": [
                    "Reconstruct the attack timeline",
                    "Identify the initial access vector",
                    "Determine the total dwell time",
                ],
                "evidence": [
                    {
                        "key": "timeline",
                        "label": "Timeline",
                        "filename": "timeline.csv",
                        "format": Evidence.FormatChoices.CSV,
                        "content": "timestamp,host,action\n2026-02-06T07:12:03Z,HR-LT-032,initial_access\n2026-02-06T07:31:44Z,DC-01,dcsync\n",
                    },
                ],
                "questions": [
                    {"text": "What suspicious file was downloaded and executed during the initial stage of the intrusion?", "cat": "Digital Forensics", "diff": "Hard", "kind": "text", "pts": 80, "ans": "update.ps1"},
                    {"text": "At what time was the incident detected?", "cat": "Digital Forensics", "diff": "Hard", "kind": "text", "pts": 80, "ans": "09:10:22 UTC|09:10:22"},
                    {"text": "Which persistence technique was used by the attacker?", "cat": "Digital Forensics", "diff": "Hard", "kind": "text", "pts": 80, "ans": "Registry Run Key persistence.|Registry Run Key"},
                    {"text": "Which external IP address was repeatedly contacted by the compromised workstation?", "cat": "Digital Forensics", "diff": "Hard", "kind": "text", "pts": 80, "ans": "185.220.101.32"},
                    {"text": "Which file was prepared and attempted to be transferred from the compromised workstation?", "cat": "Digital Forensics", "diff": "Hard", "kind": "text", "pts": 80, "ans": "backup.zip|backup.zip — containing Finance, HR, and Passwords.xlsx data."},
                ],
            },
        ]

        for cd in challenges_data:
            ch, _ = Challenge.objects.update_or_create(
                slug=cd["slug"],
                defaults={
                    "challenge_number": cd["num"],
                    "name": cd["name"],
                    "description": cd["desc"],
                    "brief": cd["brief"],
                    "difficulty": cd["diff"],
                    "duration_minutes": cd["duration"],
                    "points": cd["points"],
                    "skills": cd["skills"],
                    "objectives": cd["objectives"],
                },
            )

            # Add Evidence
            for ev_data in cd["evidence"]:
                Evidence.objects.update_or_create(
                    challenge=ch,
                    artifact_key=ev_data["key"],
                    defaults={
                        "label": ev_data["label"],
                        "filename": ev_data["filename"],
                        "file_format": ev_data["format"],
                        "content_text": ev_data.get("content"),
                        "image_url": ev_data.get("image_url"),
                    },
                )

            # Add Questions & Links
            for pos, q_data in enumerate(cd["questions"], start=1):
                q, _ = Question.objects.get_or_create(
                    question_text=q_data["text"],
                    defaults={
                        "category": q_data["cat"],
                        "difficulty": q_data["diff"],
                        "kind": q_data["kind"],
                        "options_json": q_data.get("opts", []),
                        "correct_option_index": q_data.get("correct_idx", 0),
                        "correct_answer": q_data["ans"],
                        "default_points": q_data["pts"],
                        "status": Question.StatusChoices.PUBLISHED,
                    },
                )
                ChallengeQuestion.objects.get_or_create(
                    challenge=ch,
                    question=q,
                    defaults={"position": pos},
                )

                # Assign to all live events
                for ev in created_events:
                    EventQuestion.objects.get_or_create(
                        event=ev,
                        question_id=q.id,
                        defaults={"position": pos},
                    )

        self.stdout.write(self.style.SUCCESS("Successfully seeded 5 CTF challenges, evidence files, and questions!"))
