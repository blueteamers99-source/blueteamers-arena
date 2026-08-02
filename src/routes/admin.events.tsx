import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Calendar,
  HelpCircle,
  Users,
  Trophy,
  Settings,
  ArrowLeft,
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Copy,
  X,
  RefreshCw,
  Radio,
} from "lucide-react";
import { AdminLayout } from "../components/admin/AdminLayout";
import { API_BASE_URL } from "@/lib/config";

export const Route = createFileRoute("/admin/events")({
  component: AdminEvents,
  head: () => ({
    meta: [
      { title: "Events — Blueteamers Arena Admin" },
      { name: "description", content: "Manage workshop and CTF events." },
    ],
  }),
});

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

const navItems = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Events", href: "/admin/events", icon: Calendar },
  { title: "Questions", href: "/admin/questions", icon: HelpCircle },
  { title: "Participants", href: "/admin/participants", icon: Users },
  { title: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { title: "Settings", href: "/admin/settings", icon: Settings },
];

function normalizeStatus(raw: string | undefined | null): EventStatus {
  if (!raw) return "Upcoming";
  const s = raw.trim().toLowerCase();
  if (s === "live") return "Live";
  if (s === "completed" || s === "closed" || s === "finished") return "Completed";
  return "Upcoming";
}

const STATUS_FILTERS: ("All" | EventStatus)[] = ["All", "Live", "Upcoming", "Completed"];

function getAdminToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return (
    localStorage.getItem("admin_access_token") ||
    localStorage.getItem("student_access_token") ||
    localStorage.getItem("access_token")
  );
}

function AdminEvents() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | EventStatus>("All");
  const [showCreate, setShowCreate] = useState(false);
  const [viewingEvent, setViewingEvent] = useState<EventRow | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);

  const fetchEvents = () => {
    const token = getAdminToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const processResponseData = (resData: any) => {
      let list: any[] = [];
      if (Array.isArray(resData)) {
        list = resData;
      } else if (Array.isArray(resData.results)) {
        list = resData.results;
      } else if (resData && resData.data) {
        const d = resData.data;
        if (Array.isArray(d)) list = d;
        else if (Array.isArray(d.results)) list = d.results;
      }
      setEvents(
        list.map((e: any) => ({
          id: String(e.id ?? e.pk ?? Math.random()),
          name: String(e.name || e.workshop_name || "CTF Workshop"),
          college: String(e.college_name || e.college || "—"),
          code: String(e.event_code || e.code || "—"),
          participants: Number(e.enrolled_participants ?? e.participants_count ?? e.participants ?? 0),
          status: normalizeStatus(e.status),
          date: String(e.event_date || e.date || "—"),
          description: String(e.description || ""),
        }))
      );
      setError(null);
      setLoading(false);
    };

    fetch(`${API_BASE_URL}/events/`, { headers })
      .then(async (res) => {
        if (!res.ok) {
          const fallbackRes = await fetch(`${API_BASE_URL}/events/`);
          if (!fallbackRes.ok) {
            throw new Error(`HTTP ${fallbackRes.status}`);
          }
          return fallbackRes.json();
        }
        return res.json();
      })
      .then((data) => processResponseData(data))
      .catch(() => {
        fetch(`${API_BASE_URL}/events/`)
          .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
          .then((data) => processResponseData(data))
          .catch((finalErr) => {
            setError("Failed to load events.");
            setLoading(false);
            console.error("[Events] fetch error:", finalErr);
          });
      });
  };

  useEffect(() => {
    fetchEvents();
    const timer = setInterval(fetchEvents, 15000);
    return () => clearInterval(timer);
  }, []);

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
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      fetch(`${API_BASE_URL}/events/${id}/`, {
        method: "DELETE",
        headers,
      })
        .then(() => fetchEvents())
        .catch(() => fetchEvents());
    }
  };

  const handleDuplicate = (id: string) => {
    const src = events.find((e) => e.id === id);
    if (!src) return;

    const token = getAdminToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API_BASE_URL}/events/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: `${src.name} (Copy)`,
        college_name: src.college,
        workshop_name: `${src.name} (Copy)`,
        event_code: `${src.code}-CPY`,
        event_date: "2026-08-01",
        status: "Upcoming",
        description: src.description || "",
      }),
    })
      .then(() => fetchEvents())
      .catch(() => fetchEvents());
  };

  const handleToggleStatus = (row: EventRow) => {
    const nextStatus = row.status === "Live" ? "Completed" : "Live";
    const token = getAdminToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API_BASE_URL}/events/${row.id}/`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: nextStatus }),
    })
      .then(() => fetchEvents())
      .catch(() => fetchEvents());
  };

  const handleCreate = (formData: {
    college: string;
    workshop: string;
    date: string;
    code: string;
    status?: EventStatus;
    description?: string;
    duration?: number;
    passingScore?: number;
    challenges?: number;
  }) => {
    const token = getAdminToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const body = {
      college_name: formData.college || "CBIT",
      workshop_name: formData.workshop || "SOC Cyber Defense",
      event_code: formData.code || `EVENT-${Date.now()}`,
      event_date: formData.date || new Date().toISOString().split("T")[0],
      duration_minutes: formData.duration || 60,
      passing_score: formData.passingScore || 600,
      total_challenges: formData.challenges || 5,
      status: formData.status || "Upcoming",
      description: formData.description || "",
    };

    fetch(`${API_BASE_URL}/events/`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (res.status === 401 && token) {
          return fetch(`${API_BASE_URL}/events/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }).then((r) => r.json());
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(() => fetchEvents())
      .catch((err) => {
        console.error("[Create Event] error:", err);
        fetchEvents();
      });

    setShowCreate(false);
  };

  const handleUpdate = (updated: EventRow) => {
    const token = getAdminToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const body = {
      college_name: updated.college,
      workshop_name: updated.name,
      event_code: updated.code,
      event_date: updated.date,
      status: updated.status,
      description: updated.description || "",
    };

    fetch(`${API_BASE_URL}/events/${updated.id}/`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    })
      .then(() => fetchEvents())
      .catch(() => fetchEvents());

    setEditingEvent(null);
  };

  return (
    <AdminLayout activeId="events">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, publish, and manage workshop events across colleges.
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)] cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Create Event
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search events, colleges, codes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading events…</div>
        ) : error ? (
          <div className="px-4 py-10 text-center text-sm text-red-400">{error}</div>
        ) : (
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
                  <tr key={row.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.college}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.code}</td>
                    <td className="px-4 py-3 text-right">{row.participants}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{row.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconBtn label="View" onClick={() => setViewingEvent(row)}>
                          <Eye className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn label="Edit" onClick={() => setEditingEvent(row)}>
                          <Pencil className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn label="Toggle Status" onClick={() => handleToggleStatus(row)}>
                          <Radio className="h-4 w-4" />
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
                      No events found. Create your first event using the button above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8">
        <Link
          to="/admin/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </div>

      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {viewingEvent && (
        <ViewEventModal
          event={viewingEvent}
          onClose={() => setViewingEvent(null)}
        />
      )}

      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onUpdate={handleUpdate}
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

function ViewEventModal({ event, onClose }: { event: EventRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl space-y-6 p-6 sm:p-7 backdrop-blur-xl animate-in zoom-in-95 duration-200"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/80 via-primary to-primary/40" />

        <div className="flex items-start justify-between gap-4 pt-1">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-xs">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-foreground">{event.name}</h2>
              <p className="text-xs font-medium text-muted-foreground">{event.college}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors border border-transparent hover:border-border/60 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-background/60 p-4 text-sm">
          <div className="flex justify-between items-center"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event Code:</span><span className="font-mono text-xs font-bold text-primary">{event.code}</span></div>
          <div className="flex justify-between items-center"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status:</span><StatusBadge status={event.status} /></div>
          <div className="flex justify-between items-center"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event Date:</span><span className="font-medium text-foreground">{event.date}</span></div>
          <div className="flex justify-between items-center"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Enrolled Participants:</span><span className="font-medium text-foreground">{event.participants}</span></div>
          {event.description && (
            <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground">
              <span className="font-semibold block text-foreground mb-1 uppercase tracking-wider">Description:</span>
              {event.description}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function EditEventModal({
  event,
  onClose,
  onUpdate,
}: {
  event: EventRow;
  onClose: () => void;
  onUpdate: (updated: EventRow) => void;
}) {
  const [college, setCollege] = useState(event.college);
  const [workshop, setWorkshop] = useState(event.name);
  const [date, setDate] = useState(event.date);
  const [code, setCode] = useState(event.code);
  const [status, setStatus] = useState<EventStatus>(event.status);
  const [description, setDescription] = useState(event.description || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      ...event,
      college,
      name: workshop,
      date,
      code,
      status,
      description,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border/80 bg-card shadow-2xl space-y-4 p-5 sm:p-6 backdrop-blur-xl animate-in zoom-in-95 duration-200"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/80 via-primary to-primary/40" />

        <div className="flex items-start justify-between gap-4 pt-0.5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-xs">
              <Pencil className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">Edit Event</h2>
              <p className="text-[11px] font-medium text-muted-foreground">Update event details in PostgreSQL.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors border border-transparent hover:border-border/60 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="College">
            <input required value={college} onChange={(e) => setCollege(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Workshop Name">
            <input required value={workshop} onChange={(e) => setWorkshop(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Date">
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
              className={inputCls}
            >
              <option value="Upcoming">Upcoming</option>
              <option value="Live">Live</option>
              <option value="Completed">Completed</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Event Code">
              <input required value={code} onChange={(e) => setCode(e.target.value)} className={`${inputCls} font-mono`} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={inputCls}
                placeholder="Event description..."
              />
            </Field>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/80 px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

function CreateEventModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: {
    college: string;
    workshop: string;
    date: string;
    code: string;
    status?: EventStatus;
    description?: string;
    duration?: number;
    passingScore?: number;
    challenges?: number;
  }) => void;
}) {
  const [college, setCollege] = useState("");
  const [workshop, setWorkshop] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<EventStatus>("Upcoming");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("60");
  const [passingScore, setPassingScore] = useState("600");
  const [challenges, setChallenges] = useState("5");
  const [code, setCode] = useState("");

  const publish = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = code || generateCode(college);
    onCreate({
      college,
      workshop,
      date,
      code: finalCode,
      status,
      description,
      duration: Number(duration) || 60,
      passingScore: Number(passingScore) || 600,
      challenges: Number(challenges) || 5,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <form
        onSubmit={publish}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/80 bg-card shadow-2xl space-y-4 p-5 sm:p-6 backdrop-blur-xl animate-in zoom-in-95 duration-200"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/80 via-primary to-primary/40" />

        <div className="flex items-start justify-between gap-4 pt-0.5">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-xs">
              <Plus className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">Create Event</h2>
              <p className="text-[11px] font-medium text-muted-foreground">Configure a new workshop and publish it live.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors border border-transparent hover:border-border/60 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="College">
            <input required value={college} onChange={(e) => setCollege(e.target.value)} className={inputCls} placeholder="e.g. CBIT" />
          </Field>
          <Field label="Workshop Name">
            <input required value={workshop} onChange={(e) => setWorkshop(e.target.value)} className={inputCls} placeholder="AI with SOC" />
          </Field>
          <Field label="Date">
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
              className={inputCls}
            >
              <option value="Upcoming">Upcoming</option>
              <option value="Live">Live</option>
              <option value="Completed">Completed</option>
            </select>
          </Field>
          <Field label="Duration (mins)">
            <input required type="number" min={10} value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Passing Score">
            <input required type="number" min={0} value={passingScore} onChange={(e) => setPassingScore(e.target.value)} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Number of Challenges">
              <input required type="number" min={1} value={challenges} onChange={(e) => setChallenges(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">Event Code</label>
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
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-accent/60 px-3.5 text-xs font-semibold text-foreground hover:bg-accent hover:border-primary/40 transition-all cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Generate
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={inputCls}
                placeholder="Provide event details, prerequisites, and scope..."
              />
            </Field>
          </div>
        </div>

        <div className="pt-2 border-t border-border/60 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/80 px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all cursor-pointer"
          >
            Publish Event
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border/80 bg-background/80 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs hover:border-border/100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">{label}</label>
      {children}
    </div>
  );
}
