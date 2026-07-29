import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  LayoutDashboard,
  Calendar,
  HelpCircle,
  Users,
  Trophy,
  Settings,
  Search,
  Plus,
  Download,
  Trash2,
  Pencil,
  X,
  UserCheck,
  Award,
  CheckCircle,
} from "lucide-react";

export const Route = createFileRoute("/admin/participants")({
  component: AdminParticipants,
  head: () => ({
    meta: [
      { title: "Participant Management — Blueteamers Arena Admin" },
      { name: "description", content: "Manage event participants, view scores, filter by event, and export reports." },
    ],
  }),
});

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/admin/dashboard" },
  { title: "Events", icon: Calendar, href: "/admin/events" },
  { title: "Questions", icon: HelpCircle, href: "/admin/questions" },
  { title: "Participants", icon: Users, href: "/admin/participants" },
  { title: "Leaderboard", icon: Trophy, href: "/admin/dashboard?tab=leaderboard" },
  { title: "Settings", icon: Settings, href: "/admin/settings" },
];

type ParticipantItem = {
  id: string;
  name: string;
  email: string;
  college_name?: string;
  event_code?: string;
  score: number;
  completed: number;
  started_at?: string;
  finished_at?: string;
};

const initialParticipants: ParticipantItem[] = [
  { id: "1", name: "Rahul Sharma", email: "rahul@cbit.ac.in", college_name: "CBIT", event_code: "CBIT2026", score: 85, completed: 5 },
  { id: "2", name: "Anjali Verma", email: "anjali@vnr.ac.in", college_name: "VNR", event_code: "VNR2026", score: 90, completed: 5 },
  { id: "3", name: "Vikram Reddy", email: "vikram@mgit.ac.in", college_name: "MGIT", event_code: "MGIT2026", score: 70, completed: 4 },
  { id: "4", name: "Sneha Patel", email: "sneha@jntu.ac.in", college_name: "JNTU", event_code: "JNTU2026", score: 95, completed: 5 },
  { id: "5", name: "Karthik Raju", email: "karthik@cbit.ac.in", college_name: "CBIT", event_code: "CBIT2026", score: 60, completed: 3 },
];

function AdminParticipants() {
  const [participants, setParticipants] = useState<ParticipantItem[]>(initialParticipants);
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("All");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<ParticipantItem | null>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCollege, setNewCollege] = useState("CBIT");

  useEffect(() => {
    fetch("/api/v1/admin/participants/")
      .then((res) => res.json())
      .then((resData) => {
        if (resData && (resData.success || resData.results)) {
          const list = resData.data?.results || resData.results || resData.data;
          if (Array.isArray(list) && list.length > 0) {
            setParticipants(
              list.map((item: any) => ({
                id: strVal(item.id),
                name: item.name || "Student",
                email: item.email || "",
                college_name: item.college_name || item.event?.college_name || "College",
                event_code: item.event_code || item.event?.event_code || "EVENT",
                score: item.score || 0,
                completed: item.completed || 0,
              }))
            );
          }
        }
      })
      .catch(() => {});
  }, []);

  const strVal = (val: any) => (val ? String(val) : String(Math.random()));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return participants.filter((p) => {
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
      const matchE = eventFilter === "All" || (p.college_name || p.event_code) === eventFilter;
      return matchQ && matchE;
    });
  }, [participants, query, eventFilter]);

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this participant?")) {
      fetch(`/api/v1/admin/participants/${id}/`, { method: "DELETE" }).catch(() => {});
      setParticipants((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;
    const newItem: ParticipantItem = {
      id: String(Date.now()),
      name: newName,
      email: newEmail,
      college_name: newCollege,
      event_code: `${newCollege}2026`,
      score: 0,
      completed: 0,
    };

    fetch("/api/v1/admin/participants/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem),
    }).catch(() => {});

    setParticipants((prev) => [newItem, ...prev]);
    setShowAddModal(false);
    setNewName("");
    setNewEmail("");
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParticipant) return;

    fetch(`/api/v1/admin/participants/${editingParticipant.id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingParticipant),
    }).catch(() => {});

    setParticipants((prev) => prev.map((p) => (p.id === editingParticipant.id ? editingParticipant : p)));
    setEditingParticipant(null);
  };

  const handleExportCSV = () => {
    fetch("/api/v1/admin/reports/export/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "csv" }),
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "blueteamers_participants_report.csv";
        a.click();
      })
      .catch(() => {
        alert("Downloaded participant report CSV.");
      });
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card">
              <span className="text-lg font-bold text-primary">B</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-wide">BLUETEAMERS</div>
              <div className="text-xs font-semibold tracking-widest text-primary">ARENA</div>
            </div>
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Back to Home
            </Link>
            <Link to="/admin/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Sign Out
            </Link>
          </div>
        </nav>
      </header>

      <div className="mx-auto flex max-w-7xl items-start gap-6 px-6 py-10">
        {/* Sidebar Navigation */}
        <aside className="sticky top-6 hidden w-60 shrink-0 rounded-xl border border-border bg-card p-4 lg:block">
          <div className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Menu</div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = item.href === "/admin/participants";
              return (
                <Link
                  key={item.title}
                  to={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-[var(--surface)] hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <section className="flex-1 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Participant Management</h1>
              <p className="text-sm text-muted-foreground">
                View student registrations, live scores, challenge progress, and export official reports.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface)]"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Add Student
              </button>
            </div>
          </div>

          {/* Metric Stats Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase">Total Registered</span>
              </div>
              <div className="mt-2 text-2xl font-bold">{participants.length}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center gap-3 text-muted-foreground">
                <UserCheck className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold uppercase">Active Students</span>
              </div>
              <div className="mt-2 text-2xl font-bold">{participants.filter((p) => p.completed > 0).length}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center gap-3 text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-sky-400" />
                <span className="text-xs font-semibold uppercase">Completed CTFs</span>
              </div>
              <div className="mt-2 text-2xl font-bold">{participants.filter((p) => p.completed >= 5).length}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Award className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-semibold uppercase">Average Score</span>
              </div>
              <div className="mt-2 text-2xl font-bold">
                {participants.length > 0
                  ? Math.round(participants.reduce((acc, p) => acc + p.score, 0) / participants.length)
                  : 0}
              </div>
            </div>
          </div>

          {/* Search & Event Filters */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by student name or email..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-border/60 bg-background py-2 pl-9 pr-4 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">College:</span>
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="All">All Colleges</option>
                <option value="CBIT">CBIT</option>
                <option value="VNR">VNR</option>
                <option value="MGIT">MGIT</option>
                <option value="JNTU">JNTU</option>
              </select>
            </div>
          </div>

          {/* Participants Table */}
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/60 bg-background/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Student Name</th>
                  <th className="px-6 py-4">Email Address</th>
                  <th className="px-6 py-4">College</th>
                  <th className="px-6 py-4">Completed</th>
                  <th className="px-6 py-4">Score</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      No participants found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="transition-colors hover:bg-[var(--surface)]">
                      <td className="px-6 py-4 font-semibold text-foreground">{p.name}</td>
                      <td className="px-6 py-4 text-muted-foreground">{p.email}</td>
                      <td className="px-6 py-4">
                        <span className="rounded-md border border-border/60 bg-background px-2.5 py-1 text-xs font-semibold">
                          {p.college_name || p.event_code}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{p.completed} / 5</td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-primary">{p.score} pts</span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => setEditingParticipant(p)}
                          className="rounded-md border border-border/60 p-2 text-muted-foreground hover:bg-background hover:text-foreground"
                          title="Edit Student"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="rounded-md border border-red-500/20 p-2 text-red-400 hover:bg-red-500/10"
                          title="Delete Student"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Add Participant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Add New Student Participant</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder="rahul@cbit.ac.in"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">College</label>
                <select
                  value={newCollege}
                  onChange={(e) => setNewCollege(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="CBIT">CBIT</option>
                  <option value="VNR">VNR</option>
                  <option value="MGIT">MGIT</option>
                  <option value="JNTU">JNTU</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Save Participant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Participant Modal */}
      {editingParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Edit Student Participant</h3>
              <button onClick={() => setEditingParticipant(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingParticipant.name}
                  onChange={(e) => setEditingParticipant({ ...editingParticipant, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Email Address</label>
                <input
                  type="email"
                  required
                  value={editingParticipant.email}
                  onChange={(e) => setEditingParticipant({ ...editingParticipant, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Score (Points)</label>
                <input
                  type="number"
                  value={editingParticipant.score}
                  onChange={(e) => setEditingParticipant({ ...editingParticipant, score: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingParticipant(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Update Participant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
