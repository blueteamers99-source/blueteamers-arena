export type Accent = "blue" | "green" | "purple" | "orange";

export type MockEvent = {
  code: string;
  college: string;
  workshop: string;
  participants: number;
  accent: Accent;
  date: string;
  duration: string;
  challenges: number;
};

export const EVENTS: Record<string, MockEvent> = {
  CBIT2026: {
    code: "CBIT2026",
    college: "CBIT",
    workshop: "AI with SOC Workshop",
    participants: 180,
    accent: "blue",
    date: "22 July 2026",
    duration: "60 Minutes",
    challenges: 20,
  },
  VNR2026: {
    code: "VNR2026",
    college: "VNR",
    workshop: "AI with SOC Workshop",
    participants: 220,
    accent: "green",
    date: "22 July 2026",
    duration: "60 Minutes",
    challenges: 20,
  },
  MGIT2026: {
    code: "MGIT2026",
    college: "MGIT",
    workshop: "AI with Cybersecurity",
    participants: 150,
    accent: "purple",
    date: "22 July 2026",
    duration: "60 Minutes",
    challenges: 20,
  },
  JNTU2026: {
    code: "JNTU2026",
    college: "JNTU",
    workshop: "AI with SOC",
    participants: 320,
    accent: "orange",
    date: "22 July 2026",
    duration: "60 Minutes",
    challenges: 20,
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

export function getSelectedEvent(): MockEvent {
  if (typeof window === "undefined") return EVENTS.CBIT2026;
  const rawData = localStorage.getItem("selected_event_data");
  if (rawData) {
    try {
      const parsed = JSON.parse(rawData);
      return {
        code: parsed.event_code || "CBIT2026",
        college: parsed.college || "CBIT",
        workshop: parsed.title || "AI with SOC Workshop",
        participants: 180,
        accent: "blue",
        date: parsed.event_date || "22 July 2026",
        duration: "60 Minutes",
        challenges: 20,
      };
    } catch (e) {}
  }
  const code = (sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || "CBIT2026").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return EVENTS[code] ?? EVENTS.CBIT2026;
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
