export type Difficulty = "Easy" | "Medium" | "Hard";
export type ChallengeStatus = "not_started" | "in_progress" | "completed";

export type Challenge = {
  id: string;
  slug?: string;
  number: number;
  name: string;
  description: string;
  difficulty: Difficulty;
  duration: number; // minutes
  points: number;
  skills: string[];
  objectives: string[];
  brief: string;
  resources: { name: string; type: string; size: string; evidenceId?: string }[];
  evidence?: { id: string; label: string; filename: string; image: string }[];
  questions: {
    id: string;
    prompt: string;
    kind: "text" | "mcq";
    options?: string[];
  }[];

};

export const CHALLENGES: Challenge[] = [
  {
    id: "phishnet",
    number: 1,
    name: "Operation PhishNet",
    description: "Investigate a suspicious phishing email and identify malicious indicators.",
    difficulty: "Easy",
    duration: 20,
    points: 100,
    skills: ["Email Forensics", "Header Analysis", "URL Reputation"],
    objectives: [
      "Identify the spoofed sender domain",
      "Extract malicious URLs from the email body",
      "Determine the phishing technique used",
    ],
    brief:
      "A finance employee reported a suspicious email requesting an urgent wire transfer. Analyze the message headers, embedded links, and attachments to determine whether this is a phishing attempt and identify the indicators of compromise.",
    resources: [
      { name: "Email Screenshot", type: "PNG", size: "312 KB", evidenceId: "email" },
      { name: "Email Headers", type: "TXT", size: "4 KB", evidenceId: "headers" },
      { name: "URL Analysis Report", type: "PNG", size: "268 KB", evidenceId: "url" },
    ],
    evidence: [
      { id: "email", label: "Email Screenshot", filename: "email-screenshot.png", image: "/__EVIDENCE_EMAIL__" },
      { id: "headers", label: "Email Headers", filename: "email-headers.png", image: "/__EVIDENCE_HEADERS__" },
      { id: "url", label: "URL Analysis Report", filename: "url-analysis.png", image: "/__EVIDENCE_URL__" },
    ],
    questions: [
      { id: "q1", prompt: "What is the spoofed sender domain?", kind: "text" },
      { id: "q2", prompt: "Identify the suspicious URL.", kind: "text" },
      { id: "q3", prompt: "List three phishing indicators found in this email.", kind: "text" },
    ],

  },
  {
    id: "alert-storm",
    number: 2,
    name: "Alert Storm",
    description: "Analyze SIEM / Wazuh alerts and identify the security incident.",
    difficulty: "Medium",
    duration: 30,
    points: 150,
    skills: ["SIEM Analysis", "Wazuh", "Log Correlation"],
    objectives: [
      "Correlate related alerts across sources",
      "Identify the attacker source IP",
      "Rate the severity of the incident",
    ],
    brief:
      "Multiple security alerts were triggered in the environment within a short window. Analyze the Wazuh alerts, system logs, and network captures to correlate the events and answer the questions below.",
    resources: [
      { name: "wazuh-alerts.json", type: "JSON", size: "24 KB", evidenceId: "wazuh" },
      { name: "system.log", type: "Log", size: "112 KB", evidenceId: "syslog" },
      { name: "network-flows.csv", type: "CSV", size: "56 KB", evidenceId: "network" },
    ],
    evidence: [
      { id: "wazuh", label: "Wazuh Dashboard", filename: "wazuh-dashboard.png", image: "/__EVIDENCE_WAZUH__" },
      { id: "syslog", label: "System Log", filename: "system.log.png", image: "/__EVIDENCE_SYSLOG__" },
      { id: "network", label: "Network Flows", filename: "network-flows.png", image: "/__EVIDENCE_NETWORK__" },
    ],
    questions: [
      { id: "q1", prompt: "What type of attack was detected?", kind: "text" },
      { id: "q2", prompt: "What is the source IP address of the attacker?", kind: "text" },
      { id: "q3", prompt: "What was the compromised user account?", kind: "text" },
      {
        id: "q4",
        prompt: "What is the severity of this incident?",
        kind: "mcq",
        options: ["Low", "Medium", "High", "Critical"],
      },
    ],
  },
  {
    id: "ai-defender",
    number: 3,
    name: "AI Defender",
    description: "Use AI to investigate a security scenario and produce the best response.",
    difficulty: "Medium",
    duration: 25,
    points: 100,
    skills: ["AI Tooling", "Threat Analysis", "Response Playbooks"],
    objectives: [
      "Validate the AI findings against raw evidence",
      "Identify the suspicious process chain",
      "Determine the malicious destination IP",
      "Identify evidence of possible data staging or exfiltration",
      "Decide whether the AI recommendation should be trusted",
    ],
    brief:
      "An AI-powered SOC Assistant has flagged suspicious activity on an internal workstation. The assistant generated an investigation summary after analyzing endpoint telemetry. Your task is NOT to blindly trust the AI. Review both the AI-generated summary and the raw host telemetry to determine whether the AI's conclusions are accurate. Validate every important finding using the available evidence before answering.",
    resources: [
      { name: "ai-summary.txt", type: "Text", size: "4 KB", evidenceId: "ai-summary" },
      { name: "host-telemetry.json", type: "JSON", size: "18 KB", evidenceId: "host-telemetry" },
    ],
    evidence: [
      { id: "ai-summary", label: "AI Summary", filename: "ai-summary.png", image: "/__EVIDENCE_AI_SUMMARY__" },
      { id: "host-telemetry", label: "Host Telemetry", filename: "host-telemetry.png", image: "/__EVIDENCE_HOST_TELEMETRY__" },
    ],
    questions: [
      { id: "q1", prompt: "What suspicious process execution was detected on the endpoint?", kind: "text" },
      { id: "q2", prompt: "Which external IP address did the compromised host communicate with?", kind: "text" },
      { id: "q3", prompt: "What evidence suggests possible data exfiltration?", kind: "text" },
      { id: "q4", prompt: "Should the AI's containment recommendation be trusted? Justify your answer using the raw telemetry.", kind: "text" },
    ],
  },
  {
    id: "incident-zero",
    number: 4,
    name: "Incident Zero",
    description: "Respond to a real-world security incident using incident response methodology.",
    difficulty: "Hard",
    duration: 35,
    points: 250,
    skills: ["Incident Response", "Triage", "Containment"],
    objectives: [
      "Classify the incident type",
      "Identify patient zero",
      "Choose the correct IR phase to execute next",
    ],
    brief:
      "A critical alert indicates lateral movement across the network. Follow the incident response lifecycle to triage, contain, and document the incident.",
    resources: [
      { name: "ir-runbook.txt", type: "Text", size: "6 KB", evidenceId: "ir-runbook" },
      { name: "edr-events.json", type: "JSON", size: "42 KB", evidenceId: "edr-events" },
      { name: "auth-audit.csv", type: "CSV", size: "28 KB", evidenceId: "auth-audit" },
    ],
    evidence: [
      { id: "ir-runbook", label: "IR Runbook", filename: "ir-runbook.png", image: "/__EVIDENCE_IR_RUNBOOK__" },
      { id: "edr-events", label: "EDR Events", filename: "edr-events.png", image: "/__EVIDENCE_EDR_EVENTS__" },
      { id: "auth-audit", label: "Auth Audit", filename: "auth-audit.png", image: "/__EVIDENCE_AUTH_AUDIT__" },
    ],
    questions: [
      { id: "q1", prompt: "Which endpoint is patient zero?", kind: "text" },
      {
        id: "q2",
        prompt: "Which IR phase should be executed next?",
        kind: "mcq",
        options: ["Identification", "Containment", "Eradication", "Recovery"],
      },
      { id: "q3", prompt: "What is the primary lateral movement technique observed?", kind: "text" },
      { id: "q4", prompt: "What is the recommended immediate containment action?", kind: "text" },
    ],
  },
  {
    id: "final-hunt",
    number: 5,
    name: "Final Hunt",
    description: "Perform digital forensics and build the complete attack timeline.",
    difficulty: "Hard",
    duration: 40,
    points: 400,
    skills: ["Digital Forensics", "Timeline Analysis", "Threat Hunting"],
    objectives: [
      "Reconstruct the attack timeline",
      "Identify the initial access vector",
      "Determine the total dwell time",
    ],
    brief:
      "You have full forensic artifacts from a completed intrusion. Analyze the evidence and reconstruct the attacker's timeline from initial access to actions on objectives.",
    resources: [
      { name: "disk-image-summary.txt", type: "Text", size: "12 KB", evidenceId: "disk-summary" },
      { name: "memory-strings.log", type: "Log", size: "320 KB", evidenceId: "memory-strings" },
      { name: "timeline.csv", type: "CSV", size: "48 KB", evidenceId: "timeline" },
      { name: "network-capture.pcap", type: "PCAP", size: "1.2 MB", evidenceId: "pcap" },
    ],
    evidence: [
      { id: "disk-summary", label: "Disk Image Summary", filename: "disk-image-summary.txt", image: "/__EVIDENCE_DISK_SUMMARY__" },
      { id: "memory-strings", label: "Memory Strings", filename: "memory-strings.log", image: "/__EVIDENCE_MEMORY_STRINGS__" },
      { id: "timeline", label: "Timeline", filename: "timeline.csv", image: "/__EVIDENCE_TIMELINE__" },
      { id: "pcap", label: "Network Capture", filename: "network-capture.pcap", image: "/__EVIDENCE_PCAP__" },
    ],
    questions: [
      { id: "q1", prompt: "What was the initial access vector?", kind: "text" },
      { id: "q2", prompt: "What was the attacker dwell time (in hours)?", kind: "text" },
      {
        id: "q3",
        prompt: "Which technique was used for persistence?",
        kind: "mcq",
        options: ["Scheduled Task", "Registry Run Key", "Service Creation", "WMI Subscription"],
      },
      { id: "q4", prompt: "What was the primary command-and-control (C2) IP address?", kind: "text" },
      { id: "q5", prompt: "What data or artifact indicates the attacker's final objective?", kind: "text" },
    ],
  },
];

const PROGRESS_KEY = "arena.challengeProgress";
const ACTIVE_KEY = "arena.activeChallengeId";

export type ProgressMap = Record<string, ChallengeStatus>;

export function getProgress(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(PROGRESS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function setStatus(id: string, status: ChallengeStatus) {
  if (typeof window === "undefined") return;
  const p = getProgress();
  p[id] = status;
  sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
}

export function setActive(id: string) {
  if (typeof window !== "undefined") sessionStorage.setItem(ACTIVE_KEY, id);
}

export function getActive(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACTIVE_KEY);
}

export function computeScore(progress: ProgressMap): number {
  return CHALLENGES.filter((c) => progress[c.id] === "completed").reduce(
    (sum, c) => sum + c.points,
    0,
  );
}

export function completedCount(progress: ProgressMap): number {
  return CHALLENGES.filter((c) => progress[c.id] === "completed").length;
}

export const TOTAL_POINTS = CHALLENGES.reduce((s, c) => s + c.points, 0);

export const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  Easy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  Medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  Hard: "bg-rose-500/10 text-rose-400 border-rose-500/30",
};

import { API_BASE_URL } from "./config";

export async function fetchChallengesApi(): Promise<Challenge[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/challenges/`);
    if (!res.ok) return CHALLENGES;
    const json = await res.json();
    const list = json.results || json.data || json;
    if (Array.isArray(list) && list.length > 0) {
      return list.map((item: any) => {
        const itemSlug = item.slug || item.id;
        const fb = CHALLENGES.find((c) => c.id === itemSlug || c.number === item.challenge_number) || CHALLENGES[0];
        return {
          id: itemSlug || fb.id,
          number: item.number || item.challenge_number || fb.number,
          name: item.name || fb.name,
          description: item.description || fb.description,
          difficulty: item.difficulty || fb.difficulty,
          duration: item.duration || item.duration_minutes || fb.duration,
          points: item.points || fb.points,
          skills: item.skills && item.skills.length > 0 ? item.skills : fb.skills,
          objectives: item.objectives && item.objectives.length > 0 ? item.objectives : fb.objectives,
          brief: item.brief || fb.brief || item.description,
          resources: item.resources && item.resources.length > 0 ? item.resources : fb.resources,
          evidence: item.evidence && item.evidence.length > 0 ? item.evidence : fb.evidence,
          questions: item.questions && item.questions.length > 0 ? item.questions : fb.questions,
        };
      });
    }
  } catch {
    // fallback
  }
  return CHALLENGES;
}

export async function fetchChallengeDetailApi(id: string): Promise<Challenge | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/challenges/${id}/`);
    if (!res.ok) return CHALLENGES.find((c) => c.id === id) || null;
    const json = await res.json();
    const item = json.challenge || json.data || json;
    if (item && item.name) {
      const itemSlug = item.slug || item.id || id;
      const fb = CHALLENGES.find((c) => c.id === itemSlug || c.id === id) || CHALLENGES[0];
      return {
        id: itemSlug,
        number: item.number || item.challenge_number || fb.number,
        name: item.name || fb.name,
        description: item.description || fb.description,
        difficulty: item.difficulty || fb.difficulty,
        duration: item.duration || item.duration_minutes || fb.duration,
        points: item.points || fb.points,
        skills: item.skills && item.skills.length > 0 ? item.skills : fb.skills,
        objectives: item.objectives && item.objectives.length > 0 ? item.objectives : fb.objectives,
        brief: item.brief || fb.brief || item.description,
        resources: item.resources && item.resources.length > 0 ? item.resources : fb.resources,
        evidence: item.evidence && item.evidence.length > 0 ? item.evidence : fb.evidence,
        questions: item.questions && item.questions.length > 0 ? item.questions : fb.questions,
      };
    }
  } catch {
    // fallback
  }
  return CHALLENGES.find((c) => c.id === id) || null;
}

export async function startChallengeApi(id: string): Promise<void> {
  setActive(id);
  setStatus(id, "in_progress");
  try {
    const token = localStorage.getItem("blueteamers_participant_token") || sessionStorage.getItem("blueteamers_participant_token");
    await fetch(`${API_BASE_URL}/challenges/${id}/start/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    // silent
  }
}

export async function saveProgressApi(id: string, answers: Record<string, string>): Promise<void> {
  try {
    const token = localStorage.getItem("blueteamers_participant_token") || sessionStorage.getItem("blueteamers_participant_token");
    await fetch(`${API_BASE_URL}/challenges/${id}/save-progress/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ answers }),
    });
  } catch {
    // silent
  }
}

export async function submitChallengeApi(id: string, answers: Record<string, string>): Promise<any> {
  setStatus(id, "completed");
  try {
    const token = localStorage.getItem("blueteamers_participant_token") || sessionStorage.getItem("blueteamers_participant_token");
    const res = await fetch(`${API_BASE_URL}/submissions/submit/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ challenge_id: id, answers }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // silent
  }
  return { success: true };
}

