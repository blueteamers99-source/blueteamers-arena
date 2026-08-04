import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Building2,
  KeyRound,
  Users,
  Trophy,
  Award,
  CheckCircle2,
  ShieldCheck,
  Wrench,
  BookOpen,
  AlertTriangle,
  Mail,
  Phone,
  UserCheck,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Monitor,
  Copy,
  Check,
  FileCheck2,
} from "lucide-react";
import { ACCENT_CLASSES, getSelectedEvent, saveSelectedEvent, type MockEvent } from "@/lib/mock-events";
import { Navbar } from "@/components/Navbar";

export const Route = createFileRoute("/event")({
  component: EventDetailsPage,
  head: () => ({
    meta: [
      { title: "Event Details — Blueteamers Arena" },
      { name: "description", content: "Complete event details, prerequisites, tools used, rules, and entry code for your workshop." },
      { property: "og:title", content: "Event Details — Blueteamers Arena" },
      { property: "og:description", content: "Complete event details, prerequisites, tools used, rules, and entry code." },
    ],
  }),
});

export default function EventDetailsPage() {
  const navigate = useNavigate();
  const [ev, setEv] = useState<MockEvent | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setEv(getSelectedEvent());
  }, []);

  if (!ev) return null;
  const accent = ACCENT_CLASSES[ev.accent || "blue"];

  const handleEnterArena = () => {
    if (ev?.code) {
      saveSelectedEvent(ev.code);
    }
    navigate({ to: "/arena" });
  };

  const handleCopyCode = () => {
    if (ev?.code) {
      navigator.clipboard.writeText(ev.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Navigation & Action Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <Link
            to="/dashboard"
            search={{ tab: "Events" }}
            className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-accent transition-colors shadow-sm"
          >
            <ArrowLeft className="h-4 w-4 text-primary" />
            Back to Events Page
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shadow-sm cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-primary" />}
              {copied ? "Code Copied!" : "Copy Event Code"}
            </button>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left Column: Comprehensive Details (8 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-8">
            {/* Header / Title Banner */}
            <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl shadow-black/30 backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-2.5 mb-4">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  {ev.status || "Open"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-400">
                  <Monitor className="h-3.5 w-3.5" /> {ev.mode || "Offline"}
                </span>
                <span className="inline-flex items-center rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-400">
                  Difficulty: {ev.difficulty || "Intermediate"}
                </span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-foreground">
                {ev.workshop}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                <span>Organized by:</span>
                {(ev.organizedBy || ["Blueteamers Arena", "VRSEC"]).map((org, i) => (
                  <span key={org} className="inline-flex items-center gap-1 font-semibold text-foreground">
                    {i > 0 && <span className="text-muted-foreground">•</span>}
                    {org}
                  </span>
                ))}
              </div>

              <p className="mt-5 text-sm sm:text-base leading-relaxed text-muted-foreground border-t border-border/60 pt-5">
                {ev.description}
              </p>
            </div>

            {/* What You Will Learn */}
            <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl shadow-black/30">
              <div className="flex items-center gap-3 border-b border-border/60 pb-4 mb-6">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">What You Will Learn</h2>
                  <p className="text-xs text-muted-foreground">Key cybersecurity topics and practical competencies covered in this event</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {(ev.learningOutcomes || []).map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-xl border border-border/60 bg-[var(--surface)] p-3.5 transition-colors hover:border-primary/40">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                    <span className="text-xs sm:text-sm font-semibold text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Prerequisites */}
            <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl shadow-black/30">
              <div className="flex items-center gap-3 border-b border-border/60 pb-4 mb-6">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Prerequisites</h2>
                  <p className="text-xs text-muted-foreground">What you need before joining the event</p>
                </div>
              </div>

              <ul className="space-y-3">
                {(ev.prerequisites || []).map((req) => (
                  <li key={req} className="flex items-start gap-3 text-xs sm:text-sm text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Event Rules */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 sm:p-8 shadow-xl">
              <div className="flex items-center gap-3 border-b border-amber-500/20 pb-4 mb-6">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/20 text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Event Rules</h2>
                  <p className="text-xs text-amber-200/80">Please follow all rules strictly during competition</p>
                </div>
              </div>

              <ul className="grid gap-2.5 sm:grid-cols-2">
                {(ev.rules || []).map((rule, idx) => (
                  <li key={rule} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                    <span className="font-mono font-bold text-amber-400 shrink-0">{idx + 1}.</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Passing Criteria & Certificate */}
            <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl shadow-black/30">
              <div className="flex items-center gap-3 border-b border-border/60 pb-4 mb-6">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <FileCheck2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Passing Criteria</h2>
                  <p className="text-xs text-muted-foreground">Score requirement to unlock your Certificate of Completion</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 text-center">
                <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-4">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Total Score</div>
                  <div className="mt-1 text-2xl font-extrabold text-foreground">{ev.totalScore || 500} Pts</div>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="text-xs font-semibold uppercase text-emerald-400">Passing Score</div>
                  <div className="mt-1 text-2xl font-extrabold text-emerald-400">{ev.passingScore || 350} Pts</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-4">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Certificate</div>
                  <div className="mt-1 text-sm font-bold text-emerald-400 flex items-center justify-center gap-1">
                    <Award className="h-4 w-4" /> Available
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl shadow-black/30">
              <div className="flex items-center gap-3 border-b border-border/60 pb-4 mb-6">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-400">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Contact Information</h2>
                  <p className="text-xs text-muted-foreground">Have questions about the event? Reach out to the event coordinator</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-5">
                <div className="text-sm font-bold text-foreground">{ev.coordinator?.name || "John Doe"}</div>
                <div className="text-xs text-muted-foreground">{ev.coordinator?.role || "Workshop Coordinator"}</div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <span>{ev.coordinator?.email || "coordinator@blueteamers.io"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    <span>{ev.coordinator?.phone || "+91 98765 43210"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Sticky Event Details Card UI (4 cols) */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="sticky top-24 space-y-6">
              {/* Main Details Card */}
              <div className="rounded-2xl border border-primary/40 bg-card p-6 shadow-2xl shadow-black/60 backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-5">
                  <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Event Details Card
                  </h3>
                  <span className="rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold text-primary">
                    {ev.code}
                  </span>
                </div>

                <div className="space-y-3.5 text-xs">
                  <DetailRow icon={<Calendar className="h-4 w-4 text-blue-400" />} label="Date" value={ev.date || "15 Aug 2026"} />
                  <DetailRow icon={<Clock className="h-4 w-4 text-blue-400" />} label="Day" value={ev.day || "Saturday"} />
                  <DetailRow icon={<Clock className="h-4 w-4 text-emerald-400" />} label="Time" value={ev.time || "09:00 AM – 01:00 PM"} />
                  <DetailRow icon={<Clock className="h-4 w-4 text-amber-400" />} label="Duration" value={ev.duration || "4 Hours"} />
                  <DetailRow icon={<MapPin className="h-4 w-4 text-rose-400" />} label="Venue" value={ev.venue || "VRSEC Seminar Hall"} />
                  <DetailRow icon={<Monitor className="h-4 w-4 text-cyan-400" />} label="Mode" value={ev.mode || "Offline"} />
                  <DetailRow icon={<Sparkles className="h-4 w-4 text-purple-400" />} label="Difficulty" value={ev.difficulty || "Intermediate"} />
                  <DetailRow icon={<Building2 className="h-4 w-4 text-primary" />} label="College" value={ev.college} />
                  <DetailRow icon={<KeyRound className="h-4 w-4 text-primary" />} label="Event Code" value={<span className="font-mono font-bold text-primary">{ev.code}</span>} />
                  <DetailRow icon={<Users className="h-4 w-4 text-indigo-400" />} label="Max Students" value={String(ev.maxStudents || 250)} />
                  <DetailRow icon={<Trophy className="h-4 w-4 text-amber-400" />} label="Pass Score" value={`${ev.passingScore || 350} / ${ev.totalScore || 500}`} />
                  <DetailRow icon={<Award className="h-4 w-4 text-emerald-400" />} label="Certificate" value={ev.certificateAvailable ? "Available" : "Not Available"} />
                </div>

                {/* Primary CTA */}
                <div className="mt-6 space-y-3">
                  <button
                    onClick={handleEnterArena}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-extrabold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-primary/20 cursor-pointer"
                  >
                    <KeyRound className="h-4.5 w-4.5" />
                    Enter Arena With Code
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="text-[11px] text-center text-muted-foreground font-medium">
                    Use event code <span className="font-mono font-bold text-primary">{ev.code}</span> to unlock challenge questions
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/50 bg-[var(--surface)] p-2.5">
      <div className="flex items-center gap-2 text-muted-foreground font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-bold text-foreground text-right">{value}</div>
    </div>
  );
}
