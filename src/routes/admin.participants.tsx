import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Users,
  Search,
  Plus,
  Download,
  Trash2,
  Pencil,
  X,
  UserCheck,
  Award,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import { AdminLayout } from "../components/admin/AdminLayout";

export const Route = createFileRoute("/admin/participants")({
  component: AdminParticipants,
  head: () => ({
    meta: [
      { title: "Participant Management — Blueteamers Arena Admin" },
      { name: "description", content: "Manage event participants, view scores, filter by event, and export reports." },
    ],
  }),
});

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

function getAdminToken(): string {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return "";
  return (
    localStorage.getItem("admin_access_token") ||
    localStorage.getItem("access_token") ||
    ""
  );
}

function AdminParticipants() {
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("All");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<ParticipantItem | null>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCollege, setNewCollege] = useState("CBIT");

  const loadParticipants = () => {
    const token = getAdminToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch("/api/v1/admin/participants/", { headers })
      .then((res) => {
        if (res.status === 401 && token) {
          return fetch("/api/v1/admin/participants/").then((r) => r.json());
        }
        return res.json();
      })
      .then((resData) => {
        const list = resData.data?.results || resData.results || resData.data || (Array.isArray(resData) ? resData : []);
        if (Array.isArray(list)) {
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
      })
      .catch((err) => console.error("Error fetching participants:", err));
  };

  useEffect(() => {
    loadParticipants();
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
      fetch(`/api/v1/admin/participants/${id}/`, { method: "DELETE" })
        .then(() => loadParticipants())
        .catch(() => {});
      setParticipants((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;

    fetch("/api/v1/admin/participants/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        email: newEmail,
        college_name: newCollege,
      }),
    })
      .then((res) => res.json())
      .then(() => {
        loadParticipants();
      })
      .catch((err) => console.error("Error creating student:", err));

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
    <AdminLayout activeId="participants">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Participant Management</h1>
            <p className="text-sm text-muted-foreground">
              View student registrations, live scores, challenge progress, and export official reports.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--surface)] text-foreground"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
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
            <div className="mt-2 text-2xl font-bold text-foreground">{participants.length}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <UserCheck className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold uppercase">Active Students</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">{participants.filter((p) => p.completed > 0).length}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-sky-400" />
              <span className="text-xs font-semibold uppercase">Completed CTFs</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">{participants.filter((p) => p.completed >= 5).length}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Award className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-semibold uppercase">Average Score</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
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
              className="w-full rounded-lg border border-border/60 bg-background py-2 pl-9 pr-4 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">College:</span>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
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
                      <span className="rounded-md border border-border/60 bg-background px-2.5 py-1 text-xs font-semibold text-foreground">
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
                        className="rounded-md border border-border/60 p-2 text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
                        title="Edit Student"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="rounded-md border border-red-500/20 p-2 text-red-400 hover:bg-red-500/10 transition-colors"
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

      </div>

      {/* Add Participant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Add New Student Participant</h3>
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
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
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
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  placeholder="rahul@cbit.ac.in"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">College</label>
                <select
                  value={newCollege}
                  onChange={(e) => setNewCollege(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
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
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)]"
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
              <h3 className="text-lg font-bold text-foreground">Edit Student Participant</h3>
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
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Email Address</label>
                <input
                  type="email"
                  required
                  value={editingParticipant.email}
                  onChange={(e) => setEditingParticipant({ ...editingParticipant, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Score (Points)</label>
                <input
                  type="number"
                  value={editingParticipant.score}
                  onChange={(e) => setEditingParticipant({ ...editingParticipant, score: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingParticipant(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)]"
                >
                  Update Participant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
