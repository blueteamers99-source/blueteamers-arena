import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  ShieldCheck,
  Sparkles,
  KeyRound,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import { ACCENT_CLASSES, getSelectedEvent, saveSelectedEvent, type MockEvent } from "@/lib/mock-events";
import { Navbar } from "@/components/Navbar";
import { API_BASE_URL } from "@/lib/config";
import { useValidateEventCode } from "@/hooks/useValidateEventCode";

type EventStatus = "Live" | "Upcoming" | "Completed";

type EventRow = {
  id: string;
  name: string;
  college: string;
  code: string;
  participants: number;
  status: EventStatus;
  date: string;
  description?: string;
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

export default function StuEvents({ hideNav }: { hideNav?: boolean } = {}) {
  const navigate = useNavigate();
  const [ev, setEv] = useState<MockEvent>(() => getSelectedEvent());
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");

  useEffect(() => {
    setEv(getSelectedEvent());
    fetch(`${API_BASE_URL}/events/`)
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
            description: e.description || "",
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
        filterStatus === "All" || e.status.toLowerCase() === filterStatus.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [events, search, filterStatus]);

  const liveCount = useMemo(() => events.filter((e) => e.status === "Live").length, [events]);

  const accent = {
    text: "text-primary",
    border: "border-primary",
    bg: "bg-primary",
    hover: "hover:bg-primary/90",
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!hideNav && <Navbar />}

      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Top Header & Enter Arena Code CTA */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Blueteamers Arena Events
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a live workshop or enter your college event code to join the arena.
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/arena" })}
            className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
          >
            <KeyRound className="h-4.5 w-4.5" />
            Enter Event Code
          </button>
        </div>

        {/* 3 Overview Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<Radio className="h-4 w-4 text-emerald-400" />}
            label="Live Workshops"
            value={String(liveCount)}
            sub="Active competitions"
          />
          <StatCard
            icon={<Calendar className="h-4 w-4 text-blue-400" />}
            label="Total Events"
            value={String(events.length)}
            sub="Across engineering colleges"
          />
          <StatCard
            icon={<Users className="h-4 w-4 text-purple-400" />}
            label="Total Participants"
            value={String(events.reduce((acc, e) => acc + e.participants, 0))}
            sub="Registered students"
          />
        </div>

        {/* Search & Status Filter */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

        {/* Events List */}
        <ul className="space-y-4">
          {filteredEvents.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => setSelected(e)}
                className="group relative flex w-full items-center justify-between gap-5 rounded-2xl border border-border/80 bg-card p-5 text-left shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:bg-card/95 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-0.5 cursor-pointer"
              >
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
                    Event Code: <span className="font-mono text-primary font-bold">{e.code}</span> • Click to view details
                  </p>
                </div>

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
          ))}
          {filteredEvents.length === 0 && (
            <li className="rounded-2xl border border-border/80 bg-card p-12 text-center text-sm font-medium text-muted-foreground">
              No events found matching your search query.
            </li>
          )}
        </ul>
      </div>

      {/* Details Modal */}
      {selected && (
        <DetailsModal
          event={selected}
          accentText={accent.text}
          accentBg={accent.bg}
          accentHover={accent.hover}
          onClose={() => setSelected(null)}
          onEnterCode={() => {
            setSelected(null);
            setShowCodeModal(true);
          }}
        />
      )}

      {/* Enter Event Code Modal */}
      {showCodeModal && (
        <EnterEventCodeModal
          onClose={() => setShowCodeModal(false)}
          onSuccess={(validatedEvent) => {
            setShowCodeModal(false);
            saveSelectedEvent(validatedEvent.event_code || "CBIT-3154");
            if (typeof sessionStorage !== "undefined") {
              sessionStorage.setItem("is_code_verified", "true");
            }
            navigate({ to: "/event", search: { verified: "true" } });
          }}
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

function EnterEventCodeModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (eventData: any) => void;
}) {
  const [code, setCode] = useState(() => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("saved_event_code") || "";
    }
    return "";
  });

  const { loading, error, success, validateCode, reset } = useValidateEventCode();

  const handleValidation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!code.trim()) return;

    const res = await validateCode(code);
    if (res.success && res.event) {
      setTimeout(() => {
        onSuccess(res.event);
      }, 500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xl backdrop-blur-xl transition-all transform animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 border border-primary/20">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Enter Arena Code</h2>
              <p className="text-xs text-muted-foreground">Validate your workshop access code</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <form onSubmit={handleValidation} className="mt-6 space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Event Access Code
            </label>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  reset();
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text").trim().toUpperCase();
                  setCode(pasted);
                  reset();
                }}
                placeholder="e.g. CBIT-3154"
                disabled={loading || success}
                className="w-full rounded-xl border border-border/80 bg-background px-4 py-3.5 font-mono text-lg font-bold tracking-widest text-primary uppercase placeholder:normal-case placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-inner transition-all"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive animate-in shake duration-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-400 animate-in fade-in duration-200">
              <Check className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>Event code verified! Entering Arena...</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || success}
              className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success || !code.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                "Continue to Arena"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DetailsModal({
  event,
  accentText,
  accentBg,
  accentHover,
  onClose,
  onEnterCode,
}: {
  event: EventRow;
  accentText: string;
  accentBg: string;
  accentHover: string;
  onClose: () => void;
  onEnterCode: () => void;
}) {
  const navigate = useNavigate();

  const handleFullDetails = () => {
    saveSelectedEvent(event.code);
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("is_code_verified");
    }
    onClose();
    navigate({ to: "/event", search: { verified: undefined } });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[580px] rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-2xl shadow-black/90 transition-all transform animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
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
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {event.description || `Official cybersecurity investigation workshop for ${event.college}. Real-time SOC log analysis, phishing detection & threat hunting simulation.`}
        </p>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-2.5 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">College</div>
            <div className="mt-0.5 text-xs font-bold text-foreground truncate">{event.college}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-2.5 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Event Code</div>
            <div className="mt-0.5 text-xs font-mono font-bold text-blue-400 truncate">{event.code}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-2.5 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Participants</div>
            <div className="mt-0.5 text-xs font-bold text-foreground">{event.participants} Max</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-2.5 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mode</div>
            <div className="mt-0.5 text-xs font-bold text-emerald-400">Offline / Hybrid</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-2.5 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pass Score</div>
            <div className="mt-0.5 text-xs font-bold text-amber-400">350 / 500</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-2.5 shadow-inner">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Certificate</div>
            <div className="mt-0.5 text-xs font-bold text-emerald-400">Available</div>
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row items-center gap-2.5 border-t border-border/60 pt-4">
          <button
            onClick={handleFullDetails}
            className="w-full sm:w-1/2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-bold text-foreground hover:bg-accent transition-colors"
          >
            View Full Event Page
          </button>
          <button
            onClick={() => {
              saveSelectedEvent(event.code);
              onEnterCode();
            }}
            className={`w-full sm:w-1/2 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-white shadow-md transition-all ${accentBg} ${accentHover}`}
          >
            <KeyRound className="h-4 w-4" /> Enter Event Code
          </button>
        </div>
      </div>
    </div>
  );
}
