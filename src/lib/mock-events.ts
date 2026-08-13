export type Accent = "blue" | "green" | "purple" | "orange";

export type MockEvent = {
  code: string;
  college: string;
  workshop: string;
  description?: string;
  participants: number;
  maxStudents?: number;
  accent: Accent;
  date: string;
  day?: string;
  time?: string;
  duration: string;
  mode?: "Offline" | "Online" | "Hybrid";
  venue?: string;
  organizedBy?: string[];
  status?: "Open" | "Closed" | "Completed" | "Live" | "Upcoming";
  difficulty?: "Beginner" | "Intermediate" | "Advanced";
  challenges: number;
  totalScore?: number;
  passingScore?: number;
  certificateAvailable?: boolean;
  learningOutcomes?: string[];
  prerequisites?: string[];
  toolsUsed?: string[];
  benefits?: string[];
  rules?: string[];
  coordinator?: {
    name: string;
    role?: string;
    email: string;
    phone: string;
  };
};

export const DEFAULT_EVENT_DETAILS = {
  description:
    "This workshop is designed to help students develop practical cybersecurity defense skills through real-world SOC investigations, phishing analysis, SIEM log analysis, incident response, and digital forensics challenges.",
  date: "15 August 2026",
  day: "Saturday",
  time: "09:00 AM – 01:00 PM",
  duration: "4 Hours",
  mode: "Offline" as const,
  venue: "VRSEC Seminar Hall – Block B",
  organizedBy: ["Blueteamers Arena", "Department of Computer Science", "VRSEC"],
  status: "Open" as const,
  difficulty: "Intermediate" as const,
  maxStudents: 250,
  totalScore: 500,
  passingScore: 350,
  certificateAvailable: true,
  learningOutcomes: [
    "Email Security & Phishing Detection",
    "SIEM Log Investigation",
    "Incident Response Lifecycle",
    "AI Security Fundamentals",
    "Digital Forensics Basics",
    "Threat Hunting",
    "IOC Identification",
    "MITRE ATT&CK Mapping",
  ],
  prerequisites: [
    "Basic Computer Knowledge",
    "Internet Browsing Skills",
    "Basic Networking Concepts",
    "No prior cybersecurity experience required",
    "Laptop with Chrome/Edge browser",
    "Stable internet connection",
  ],
  toolsUsed: [
    "Blueteamers Arena",
    "Splunk (Demo)",
    "Wireshark",
    "VirusTotal",
    "MITRE ATT&CK",
    "Microsoft Defender Logs",
  ],
  benefits: [
    "Hands-on SOC Investigation Experience",
    "Real-Time Cybersecurity Challenges",
    "Live Leaderboard",
    "Performance Analytics",
    "Certificate of Completion (on passing)",
    "Skill Assessment",
    "Industry-Oriented Practical Learning",
  ],
  rules: [
    "Individual participation only.",
    "Do not share event codes.",
    "No external assistance during challenges.",
    "Respect the event timer.",
    "Follow administrator instructions.",
    "Any malpractice may result in disqualification.",
  ],
  coordinator: {
    name: "John Doe",
    role: "Workshop Coordinator",
    email: "coordinator@blueteamers.io",
    phone: "+91 98765 43210",
  },
};

export const EVENTS: Record<string, MockEvent> = {
  CBIT2026: {
    ...DEFAULT_EVENT_DETAILS,
    code: "CBIT2026",
    college: "CBIT",
    workshop: "AI-Powered Blue Team Workshop 2026",
    participants: 180,
    accent: "blue",
    date: "15 August 2026",
    duration: "4 Hours",
    challenges: 20,
    organizedBy: ["Blueteamers Arena", "Department of CSE", "CBIT"],
    venue: "CBIT R&D Auditorium",
  },
  VNR2026: {
    ...DEFAULT_EVENT_DETAILS,
    code: "VNR2026",
    college: "VNR VJIET",
    workshop: "AI-Powered Blue Team Workshop 2026",
    participants: 220,
    accent: "green",
    date: "18 August 2026",
    duration: "4 Hours",
    challenges: 20,
    organizedBy: ["Blueteamers Arena", "Department of IT", "VNR VJIET"],
    venue: "VNR Main Campus Lab 4",
  },
  MGIT2026: {
    ...DEFAULT_EVENT_DETAILS,
    code: "MGIT2026",
    college: "MGIT",
    workshop: "AI with Cybersecurity Workshop",
    participants: 150,
    accent: "purple",
    date: "20 August 2026",
    duration: "4 Hours",
    challenges: 20,
    organizedBy: ["Blueteamers Arena", "Department of CSE", "MGIT"],
    venue: "MGIT ECE Seminar Hall",
  },
  JNTU2026: {
    ...DEFAULT_EVENT_DETAILS,
    code: "JNTU2026",
    college: "JNTUH",
    workshop: "AI with SOC Investigation",
    participants: 320,
    accent: "orange",
    date: "25 August 2026",
    duration: "4 Hours",
    challenges: 20,
    organizedBy: ["Blueteamers Arena", "School of IT", "JNTUH"],
    venue: "JNTUH UGC Seminar Hall",
  },
  "VRSEC-4851": {
    ...DEFAULT_EVENT_DETAILS,
    code: "VRSEC-4851",
    college: "VRSEC",
    workshop: "AI-Powered Blue Team Workshop 2026",
    participants: 250,
    accent: "blue",
    date: "15 August 2026",
    duration: "4 Hours",
    challenges: 20,
    organizedBy: ["Blueteamers Arena", "Department of Computer Science", "VRSEC"],
    venue: "VRSEC Seminar Hall – Block B",
  },
};

const KEY = "arena.selectedEventCode";
const NAME_KEY = "arena.studentName";

export function saveSelectedEvent(code: string) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(KEY, code);
    localStorage.setItem(KEY, code);
  }
}

// Clear session validation whenever the student leaves the page (navigates away, refreshes, closes tab/window)
if (typeof window !== "undefined") {
  const clearSession = () => {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem("is_code_verified");
  };
  window.addEventListener("pagehide", clearSession);
  window.addEventListener("beforeunload", clearSession);
}

export function getSelectedEvent(): MockEvent {
  if (typeof window === "undefined") return EVENTS["VRSEC-4851"];
  const rawData = localStorage.getItem("selected_event_data");
  if (rawData) {
    try {
      const parsed = JSON.parse(rawData);
      const codeStr = parsed.event_code || "VRSEC-4851";
      return {
        ...DEFAULT_EVENT_DETAILS,
        code: codeStr,
        college: parsed.college || parsed.college_name || "VRSEC",
        workshop: parsed.title || parsed.name || "AI-Powered Blue Team Workshop 2026",
        description: parsed.description || DEFAULT_EVENT_DETAILS.description,
        participants: Number(parsed.enrolled_participants || parsed.participants || 180),
        accent: "blue",
        date: parsed.event_date || parsed.date || DEFAULT_EVENT_DETAILS.date,
        duration: parsed.duration || DEFAULT_EVENT_DETAILS.duration,
        challenges: Number(parsed.challenges_count || 20),
        venue: parsed.venue || DEFAULT_EVENT_DETAILS.venue,
        mode: parsed.mode || DEFAULT_EVENT_DETAILS.mode,
      };
    } catch (e) {}
  }
  const code = (sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || "VRSEC-4851")
    .toUpperCase()
    .trim();
  return EVENTS[code] ?? { ...EVENTS["VRSEC-4851"], code };
}

export function saveStudentName(name: string) {
  if (typeof window !== "undefined") sessionStorage.setItem(NAME_KEY, name);
}

export function getStudentName(): string {
  if (typeof window === "undefined") return "Rahul";
  return sessionStorage.getItem(NAME_KEY) || "Rahul";
}

export const ACCENT_CLASSES: Record<
  Accent,
  { text: string; bg: string; bgSoft: string; border: string; hover: string; ring: string }
> = {
  blue: {
    text: "text-blue-400",
    bg: "bg-blue-500",
    bgSoft: "bg-blue-500/10",
    border: "border-blue-500/40",
    hover: "hover:bg-blue-600",
    ring: "ring-blue-500/60",
  },
  green: {
    text: "text-emerald-400",
    bg: "bg-emerald-500",
    bgSoft: "bg-emerald-500/10",
    border: "border-emerald-500/40",
    hover: "hover:bg-emerald-600",
    ring: "ring-emerald-500/60",
  },
  purple: {
    text: "text-violet-400",
    bg: "bg-violet-500",
    bgSoft: "bg-violet-500/10",
    border: "border-violet-500/40",
    hover: "hover:bg-violet-600",
    ring: "ring-violet-500/60",
  },
  orange: {
    text: "text-orange-400",
    bg: "bg-orange-500",
    bgSoft: "bg-orange-500/10",
    border: "border-orange-500/40",
    hover: "hover:bg-orange-600",
    ring: "ring-orange-500/60",
  },
};
