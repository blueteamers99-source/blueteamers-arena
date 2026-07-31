import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Search,
  Users,
  Radio,
  CheckCircle2,
  Clock,
  Building2,
  ArrowRight,
  X,
  Layers,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ACCENT_CLASSES, getSelectedEvent, type MockEvent } from "@/lib/mock-events";
import { Navbar } from "@/components/Navbar";

type EventStatus = "Live" | "Upcoming" | "Completed";

type EventRow = {
  id: string;
  name: string;
  college: string;
  code: string;
  participants: number;
  status: EventStatus;
  date: string;
};

function normalizeStatus(raw: string | undefined | null): EventStatus {
  if (!raw) return "Upcoming";
  const s = raw.trim().toLowerCase();
  if (s === "live") return "Live";
  if (s === "completed" || s === "closed" || s === "finished") return "Completed";
  return "Upcoming";
}

export const Route = createFileRoute("/stuevents")({
  component: StuEvents,
  head: () => ({
    meta: [
      { title: "Events — Blueteamers Arena" },
      { name: "description", content: "Select and view SOC workshop and competition events." },
      { property: "og:title", content: "Events — Blueteamers Arena" },
      { property: "og:description", content: "SOC workshop and competition events." },
    ],
  }),
});

export default function StuEvents() {
  const [ev, setEv] = useState<MockEvent>(() => getSelectedEvent());
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");

  useEffect(() => {
    setEv(getSelectedEvent());
    fetch("/api/v1/events/")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => {
        let list: any[] = [];
        if (Array.isArray(data)) list = data;
        else if (Array.isArray(data.results)) list = data.results;
        else if (data.data) {
          const d = data.data;
          if (Array.isArray(d)) list = d;
          else if (Array.isArray(d.results)) list = d.results;
        }
        setEvents(
          list.map((e: any) => ({
            id: String(e.id ?? Math.random()),
            name: String(e.name || e.workshop_name || "Workshop"),
            college: String(e.college_name || e.college || "—"),
            code: String(e.event_code || e.code || "—"),
            participants: Number(e.enrolled_participants ?? e.participants_count ?? e.participants ?? 0),
            status: normalizeStatus(e.status),
            date: String(e.event_date || e.date || "—"),
          }))
        );
      })
      .catch(() => setEvents([]));
  }, []);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      const matchSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.college.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q);
      const matchStatus =
        filterStatus === "All" ||
        e.status.toLowerCase() === filterStatus.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [events, search, filterStatus]);

  const stats = useMemo(() => {
    const totalEvents = events.length;
    const liveEvents = events.filter((e) => e.status === "Live").length;
    const upcomingEvents = events.filter((e) => e.status === "Upcoming").length;
    const completedEvents = events.filter((e) => e.status === "Completed").length;
    const totalParticipants = events.reduce((acc, curr) => acc + curr.participants, 0);

    return { totalEvents, liveEvents, upcomingEvents, completedEvents, totalParticipants };
  }, [events]);

  const accent = (ev && ev.accent && ACCENT_CLASSES[ev.accent]) ? ACCENT_CLASSES[ev.accent] : ACCENT_CLASSES.blue;

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <Navbar />

      {/* Background Glow Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.12),rgba(255,255,255,0))]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Stat Cards 3-Grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <StatCard
            icon={<Layers className={`h-4 w-4 ${accent.text}`} />}
            label="Total Events"
            value={`${stats.totalEvents}`}
            sub="Workshops & Competitions"
          />
          <StatCard
            icon={<Radio className={`h-4 w-4 ${accent.text}`} />}
            label="Live Arenas"
            value={`${stats.liveEvents}`}
            sub="Active Competitions"
          />
          <StatCard
            icon={<Users className={`h-4 w-4 ${accent.text}`} />}
            label="Total Participants"
            value={`${stats.totalParticipants}`}
            sub="Registered Blue Teamers"
          />
        </div>

        {/* Section Header & Filter Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              Workshop & Arena Events
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Click on any event card below to view detailed information.
            </p>
          </div>

          {/* Search & Filter Inputs */}
          <div className="flex flex-wrap items-center gap-3.5">
            <div className="relative min-w-[260px] sm:min-w-[320px]">
              <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events, colleges, codes..."
                className="w-full rounded-xl border border-border/80 bg-card py-2.5 pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/40 shadow-sm"
              />
            </div>

            <div className="flex items-center gap-1.5 rounded-2xl border border-border/80 bg-card p-1.5 shadow-sm">
              {["All", "Live", "Upcoming", "Completed"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                    filterStatus.toLowerCase() === status.toLowerCase()
                      ? `${accent.bg} text-white shadow-sm`
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Streamlined Events List Cards (Without S.No Numbers) */}
        <ul className="space-y-4">
          {filteredEvents.map((e) => {
            return (
              <li key={e.id}>
                <button
                  onClick={() => setSelected(e)}
                  className="group relative flex w-full items-center justify-between gap-5 rounded-2xl border border-border/80 bg-card p-5 text-left shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:bg-card/95 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-0.5 cursor-pointer"
                >
                  {/* Concise Event Summary */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                        {e.name}
                      </h3>
                      <span className="inline-flex items-center rounded-lg border border-border/80 bg-[var(--surface)] px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                        {e.college}
                      </span>
                      <EventStatusBadge status={e.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground font-medium">
                      Click to view full event details & schedule
                    </p>
                  </div>

                  {/* Clean Action Arrow */}
                  <div className="flex shrink-0 items-center gap-3 text-right">
                    <span className="hidden text-xs font-semibold text-muted-foreground group-hover:text-primary sm:inline-block">
                      View Details
                    </span>
                    <div className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-[var(--surface)] transition-all group-hover:border-primary/50 group-hover:bg-primary/10">
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
          {filteredEvents.length === 0 && (
            <li className="rounded-2xl border border-border/80 bg-card p-12 text-center text-sm font-medium text-muted-foreground">
              No events found matching your search query.
            </li>
          )}
        </ul>
      </div>

      {/* Compact, Scroll-Free Professional Popup Modal */}
      {selected && (
        <DetailsModal
          event={selected}
          accentText={accent.text}
          accentBg={accent.bg}
          accentHover={accent.hover}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="group rounded-2xl border border-border/80 bg-card p-5 shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-primary/10 hover:-translate-y-0.5">
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <span>{label}</span>
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10">{icon}</div>
      </div>
      <div className="mt-3 text-3xl font-extrabold tracking-tight text-foreground">{value}</div>
      {sub && <div className="mt-1 text-xs font-medium text-muted-foreground">{sub}</div>}
    </div>
  );
}

function EventStatusBadge({ status }: { status: EventStatus }) {
  if (status === "Live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
      </span>
    );
  }
  if (status === "Upcoming") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-400">
        <Clock className="h-3.5 w-3.5" /> Upcoming
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[var(--surface)] px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
      <CheckCircle2 className="h-3.5 w-3.5" /> Completed
    </span>
  );
}

function DetailsModal({
  event,
  accentText,
  accentBg,
  accentHover,
  onClose,
}: {
  event: EventRow;
  accentText: string;
  accentBg: string;
  accentHover: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[540px] rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-2xl shadow-black/90 transition-all transform animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-extrabold uppercase tracking-wider ${accentText}`}>
                Official Event
              </span>
              <span className="inline-flex items-center rounded-md border border-border/80 bg-background px-2 py-0.5 font-mono text-[10px] font-bold text-blue-400">
                {event.code}
              </span>
            </div>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-foreground">{event.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Concise Description */}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Official cybersecurity investigation workshop for <strong className="text-foreground">{event.college}</strong>. Real-time SOC log analysis & threat hunting simulation.
        </p>

        {/* 4 Metric Cards (2x2 Grid) */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 text-center">
          <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-2.5 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">College</div>
            <div className="mt-0.5 text-sm font-bold text-foreground truncate">{event.college}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-2.5 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Event Code</div>
            <div className="mt-0.5 text-xs font-mono font-bold text-blue-400 truncate">{event.code}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-2.5 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Participants</div>
            <div className="mt-0.5 text-sm font-bold text-foreground">{event.participants}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-2.5 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</div>
            <div className="mt-0.5 text-xs font-bold text-foreground flex justify-center">{event.status}</div>
          </div>
        </div>

        {/* Structured Details Block */}
        <div className="mt-4 space-y-2 text-xs">
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-[var(--surface)]/60 p-3">
            <div className="flex items-center gap-2 text-muted-foreground font-medium">
              <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>Campus Host</span>
            </div>
            <span className="font-semibold text-foreground">{event.college} Engineering Campus</span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-[var(--surface)]/60 p-3">
            <div className="flex items-center gap-2 text-muted-foreground font-medium">
              <Calendar className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Date & Duration</span>
            </div>
            <span className="font-semibold text-foreground">{event.date} • 60 Mins</span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-[var(--surface)]/60 p-3">
            <div className="flex items-center gap-2 text-muted-foreground font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span>Access Code</span>
            </div>
            <span className="font-mono font-semibold text-blue-400">{event.code}</span>
          </div>
        </div>

        {/* Footer Action Button */}
        <div className="mt-5 flex items-center justify-end border-t border-border/60 pt-3.5">
          <button
            onClick={onClose}
            className={`w-full rounded-xl py-2.5 text-xs font-bold text-white shadow-md transition-all ${accentBg} ${accentHover}`}
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
