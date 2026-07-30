import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Calendar,
  Search,
  Plus,
  Pencil,
  Trash2,
  Copy,
  X,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { AdminLayout } from "../components/admin/AdminLayout";

export const Route = createFileRoute("/admin/events")({
  component: AdminEvents,
  head: () => ({
    meta: [
      { title: "Events — Blueteamers Arena Admin" },
      { name: "description", content: "Create, edit, and manage cybersecurity workshop events across colleges." },
      { property: "og:title", content: "Events — Blueteamers Arena Admin" },
      { property: "og:description", content: "Create, edit, and manage cybersecurity workshop events across colleges." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

export type EventStatus = "Live" | "Upcoming" | "Completed";

export type EventRow = {
  id: string;
  name: string;
  college: string;
  code: string;
  participants: number;
  status: EventStatus;
  date: string;
};

export const seedEvents: EventRow[] = [
  { id: "1", name: "CBIT AI with SOC", college: "CBIT", code: "CBIT-AI-2026", participants: 84, status: "Live", date: "22 Jul 2026" },
  { id: "2", name: "VNR Cyber Workshop", college: "VNR", code: "VNR-CY-2026", participants: 62, status: "Completed", date: "20 Jul 2026" },
  { id: "3", name: "MGIT Blue Team Bootcamp", college: "MGIT", code: "MGIT-BT-2026", participants: 48, status: "Upcoming", date: "28 Jul 2026" },
  { id: "4", name: "JNTU SOC Simulation", college: "JNTU", code: "JNTU-SOC-2026", participants: 120, status: "Live", date: "22 Jul 2026" },
  { id: "5", name: "ACE Engineering Recon", college: "ACE", code: "ACE-REC-2026", participants: 95, status: "Upcoming", date: "25 Jul 2026" },
  { id: "6", name: "IIIT Threat Hunt", college: "IIIT", code: "IIIT-TH-2026", participants: 74, status: "Completed", date: "18 Jul 2026" },
];

const STATUS_FILTERS: ("All" | EventStatus)[] = ["All", "Live", "Upcoming", "Completed"];

function AdminEvents() {
  const [events, setEvents] = useState<EventRow[]>(seedEvents);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | EventStatus>("All");
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      const matchQ =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.college.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q);
      const matchS = statusFilter === "All" || e.status === statusFilter;
      return matchQ && matchS;
    });
  }, [events, query, statusFilter]);

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this event?")) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
    }
  };

  const handleDuplicate = (id: string) => {
    setEvents((prev) => {
      const src = prev.find((e) => e.id === id);
      if (!src) return prev;
      return [
        ...prev,
        {
          ...src,
          id: `${Date.now()}`,
          name: `${src.name} (Copy)`,
          code: `${src.code}-COPY`,
          participants: 0,
          status: "Upcoming",
        },
      ];
    });
  };

  const handleCreate = (row: EventRow) => setEvents((prev) => [row, ...prev]);

  const handleUpdate = (updated: EventRow) => {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setEditingEvent(null);
  };

  return (
    <AdminLayout activeId="events">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, publish, and manage workshop events across colleges.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
        >
          <Plus className="h-4 w-4" /> Create Event
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events, colleges, codes..."
            className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary text-foreground"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-[var(--surface)] hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-[var(--surface)] text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Event Name</th>
                <th className="px-4 py-3 text-left font-medium">College</th>
                <th className="px-4 py-3 text-left font-medium">Event Code</th>
                <th className="px-4 py-3 text-right font-medium">Participants</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-[var(--surface)] transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.college}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.code}</td>
                  <td className="px-4 py-3 text-right text-foreground">{row.participants}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{row.date}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn label="Edit Event" onClick={() => setEditingEvent(row)}>
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn label="Duplicate" onClick={() => handleDuplicate(row.id)}>
                        <Copy className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn label="Delete" danger onClick={() => handleDelete(row.id)}>
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No events match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onCreate={(row) => {
            handleCreate(row);
            setShowCreate(false);
          }}
        />
      )}

      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={handleUpdate}
        />
      )}
    </AdminLayout>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--surface)] ${
        danger ? "hover:text-red-400" : "hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: EventStatus }) {
  const styles =
    status === "Live"
      ? "bg-emerald-500/10 text-emerald-400"
      : status === "Upcoming"
      ? "bg-primary/10 text-primary"
      : "bg-muted-foreground/10 text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {status}
    </span>
  );
}

function generateCode(college: string) {
  const base = college.trim().toUpperCase().replace(/\s+/g, "").slice(0, 6) || "EVENT";
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${base}-${rand}`;
}

function CreateEventModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (row: EventRow) => void;
}) {
  const [college, setCollege] = useState("");
  const [workshop, setWorkshop] = useState("");
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState("60");
  const [passingScore, setPassingScore] = useState("600");
  const [challenges, setChallenges] = useState("5");
  const [code, setCode] = useState("");

  const publish = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = code || generateCode(college);
    const formattedDate = date
      ? new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "TBD";
    onCreate({
      id: `${Date.now()}`,
      name: workshop || "Untitled Workshop",
      college: college || "—",
      code: finalCode,
      participants: 0,
      status: "Upcoming",
      date: formattedDate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onSubmit={publish}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Create Event</h2>
            <p className="mt-1 text-xs text-muted-foreground">Configure a new workshop and publish it live.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-[var(--surface)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="College">
            <input required value={college} onChange={(e) => setCollege(e.target.value)} className={inputCls} placeholder="e.g. CBIT" />
          </Field>
          <Field label="Workshop Name">
            <input required value={workshop} onChange={(e) => setWorkshop(e.target.value)} className={inputCls} placeholder="AI with SOC" />
          </Field>
          <Field label="Date">
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Duration (mins)">
            <input required type="number" min={10} value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Passing Score">
            <input required type="number" min={0} value={passingScore} onChange={(e) => setPassingScore(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Number of Challenges">
            <input required type="number" min={1} value={challenges} onChange={(e) => setChallenges(e.target.value)} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Event Code</label>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Auto-generated on publish"
                className={`${inputCls} font-mono`}
              />
              <button
                type="button"
                onClick={() => setCode(generateCode(college))}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-[var(--surface)] px-3 text-xs font-medium text-foreground hover:border-primary"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Generate
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 pt-2 border-t border-border/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)]"
          >
            Publish Event
          </button>
        </div>
      </form>
    </div>
  );
}

function EditEventModal({
  event,
  onClose,
  onSave,
}: {
  event: EventRow;
  onClose: () => void;
  onSave: (row: EventRow) => void;
}) {
  const [name, setName] = useState(event.name);
  const [college, setCollege] = useState(event.college);
  const [code, setCode] = useState(event.code);
  const [status, setStatus] = useState<EventStatus>(event.status);
  const [date, setDate] = useState(event.date);
  const [participants, setParticipants] = useState(event.participants);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...event,
      name,
      college,
      code,
      status,
      date,
      participants,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between border-b border-border/60 pb-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Edit Event</h2>
            <p className="text-xs text-muted-foreground">Update details for {event.name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-[var(--surface)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Event Name">
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
          <Field label="College">
            <input required value={college} onChange={(e) => setCollege(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
              className={inputCls}
            >
              <option value="Live">Live</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Completed">Completed</option>
            </select>
          </Field>
          <Field label="Date">
            <input required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Participants Count">
            <input
              type="number"
              min={0}
              value={participants}
              onChange={(e) => setParticipants(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Event Code</label>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${inputCls} font-mono`}
              />
              <button
                type="button"
                onClick={() => setCode(generateCode(college))}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-[var(--surface)] px-3 text-xs font-medium text-foreground hover:border-primary"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Generate
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)]"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
