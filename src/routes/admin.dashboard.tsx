import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Calendar,
  HelpCircle,
  Users,
  Trophy,
  Settings,
  Crown,
  Search,
  Clock,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { AdminLayout } from "../components/admin/AdminLayout";

type AdminDashboardSearch = {
  tab?: string;
};

export const Route = createFileRoute("/admin/dashboard")({
  validateSearch: (search: Record<string, unknown>): AdminDashboardSearch => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: AdminDashboard,
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Blueteamers Arena" },
      { name: "description", content: "Manage events, students, and challenges from the Blueteamers Arena admin dashboard." },
      { property: "og:title", content: "Admin Dashboard — Blueteamers Arena" },
      { property: "og:description", content: "Manage events, students, and challenges from the Blueteamers Arena admin dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const stats = [
  { label: "Total Events", value: "12" },
  { label: "Participants", value: "486" },
  { label: "Active Events", value: "3" },
  { label: "Questions", value: "125" },
];

const recentEvents = [
  { event: "CBIT AI with SOC", college: "CBIT", participants: 84, status: "Live", date: "22 Jul 2026" },
  { event: "VNR Cyber Workshop", college: "VNR", participants: 62, status: "Completed", date: "20 Jul 2026" },
  { event: "ACE Engineering", college: "ACE", participants: 95, status: "Upcoming", date: "25 Jul 2026" },
];

const recentActivity = [
  "Rahul joined CBIT event",
  "New Event Created",
  "5 Challenges Completed",
  "Leaderboard Updated",
  "Anjali submitted Incident Zero",
  "CBIT event timer extended",
];

const podium = [
  { rank: 1, medal: "🥇", name: "Rahul", college: "CBIT", score: 950, time: "1:42:18", color: "#F59E0B", border: "border-amber-500/60", bg: "from-amber-500/10 via-card to-card" },
  { rank: 2, medal: "🥈", name: "Akhil", college: "VNR", score: 910, time: "1:45:07", color: "#9CA3AF", border: "border-slate-400/40", bg: "from-slate-400/10 via-card to-card" },
  { rank: 3, medal: "🥉", name: "Sanjay", college: "CBIT", score: 890, time: "1:48:12", color: "#B45309", border: "border-amber-700/40", bg: "from-amber-700/10 via-card to-card" },
];

const leaderboardRows = [
  { rank: 4, student: "Anjali", college: "CBIT", challenges: "5/5", score: 870, time: "1:49:52", status: "Completed" },
  { rank: 5, student: "Kiran", college: "VNR", challenges: "5/5", score: 850, time: "1:52:41", status: "Completed" },
  { rank: 6, student: "Priya", college: "ACE", challenges: "4/5", score: 720, time: "—", status: "Running" },
  { rank: 7, student: "Rohith", college: "MGIT", challenges: "3/5", score: 610, time: "—", status: "Running" },
  { rank: 8, student: "Sneha", college: "CBIT", challenges: "3/5", score: 580, time: "—", status: "Running" },
  { rank: 9, student: "Vikram", college: "JNTU", challenges: "2/5", score: 440, time: "—", status: "Running" },
];

type LeaderboardFilter = "All" | "Completed" | "Running";

function AdminDashboard() {
  const search = Route.useSearch();
  const [activeTab, setActiveTab] = useState<string>(search.tab || "dashboard");
  const [lbSearch, setLbSearch] = useState("");
  const [lbFilter, setLbFilter] = useState<LeaderboardFilter>("All");
  const [selectedEvent, setSelectedEvent] = useState("All Events");

  useEffect(() => {
    if (search.tab) {
      setActiveTab(search.tab);
    }
  }, [search.tab]);

  const sortedPodium = [podium[1], podium[0], podium[2]];

  const filteredLeaderboard = leaderboardRows.filter((row) => {
    const matchesSearch =
      row.student.toLowerCase().includes(lbSearch.toLowerCase()) ||
      row.college.toLowerCase().includes(lbSearch.toLowerCase());
    const matchesFilter = lbFilter === "All" || row.status === lbFilter;
    const matchesEvent =
      selectedEvent === "All Events" ||
      (selectedEvent === "CBIT AI with SOC" && row.college === "CBIT") ||
      (selectedEvent === "VNR Cyber Workshop" && row.college === "VNR");
    return matchesSearch && matchesFilter && matchesEvent;
  });

  return (
    <AdminLayout activeId={activeTab as any} onTabChange={(tab) => setActiveTab(tab)}>
      {activeTab === "dashboard" ? (
        <>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage events, participants, and challenges.</p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50">
                <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
                <div className="mt-3 text-3xl font-bold text-foreground">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-foreground">Recent Events</h2>
                <Link to="/admin/events" className="text-xs font-medium text-primary hover:text-[var(--primary-hover)]">
                  View All
                </Link>
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-[var(--surface)] text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Event</th>
                      <th className="px-4 py-3 text-left font-medium">College</th>
                      <th className="px-4 py-3 text-right font-medium">Participants</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {recentEvents.map((row) => (
                      <tr key={row.event} className="transition-colors hover:bg-[var(--surface)]">
                        <td className="px-4 py-3 font-medium text-foreground">{row.event}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.college}</td>
                        <td className="px-4 py-3 text-right text-foreground">{row.participants}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{row.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold text-foreground">Recent Activity</h2>
              <ul className="mt-4 space-y-3">
                {recentActivity.map((activity, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {activity}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {/* Leaderboard Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Arena Leaderboard</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Standings
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Real-time rankings based on scores, challenge speed, and accuracy across all active events.
              </p>
            </div>

            {/* Event Selector */}
            <div className="flex items-center gap-2">
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-sm outline-none transition-colors focus:border-primary"
              >
                <option value="All Events">All Events</option>
                <option value="CBIT AI with SOC">CBIT AI with SOC</option>
                <option value="VNR Cyber Workshop">VNR Cyber Workshop</option>
              </select>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={lbSearch}
                onChange={(e) => setLbSearch(e.target.value)}
                placeholder="Search participant or college..."
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              {(["All", "Completed", "Running"] as LeaderboardFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setLbFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    lbFilter === f
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-[var(--surface)] hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Podium Top 3 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
            {sortedPodium.map((p) => {
              const isFirst = p.rank === 1;
              return (
                <div
                  key={p.rank}
                  className={`relative group rounded-2xl border ${p.border} bg-gradient-to-b ${p.bg} p-5 text-center shadow-lg transition-all duration-300 hover:-translate-y-1 ${
                    isFirst ? "sm:-translate-y-2 border-amber-500/80" : ""
                  }`}
                >
                  {isFirst && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full border border-amber-500/60 bg-amber-500/20 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-amber-400 backdrop-blur-md">
                      <Crown className="h-3 w-3 text-amber-400" /> Champion
                    </div>
                  )}
                  <div
                    className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl text-xl shadow-inner border border-border/40"
                    style={{ backgroundColor: `${p.color}20`, color: p.color }}
                  >
                    {p.medal}
                  </div>
                  <div className="mt-3 text-sm font-bold text-foreground">{p.name}</div>
                  <div className="text-xs font-medium text-muted-foreground">{p.college}</div>
                  <div className="mt-2 text-xl font-extrabold tracking-tight text-foreground">
                    {p.score} <span className="text-xs font-semibold text-muted-foreground">pts</span>
                  </div>
                  <div className="mt-1 text-xs font-medium text-muted-foreground/80 flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" /> Time {p.time}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Leaderboard Table (Ranks 4+) */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-[var(--surface)] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Rank</th>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">College</th>
                  <th className="px-4 py-3 text-left">Progress</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-right">Time</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLeaderboard.map((row) => (
                  <tr key={row.rank} className="transition-colors hover:bg-[var(--surface)]">
                    <td className="px-4 py-3">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-border bg-background text-xs font-bold text-muted-foreground">
                        #{row.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {row.student.charAt(0)}
                        </div>
                        <span>{row.student}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-muted-foreground">{row.college}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{row.challenges}</td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">{row.score} pts</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{row.time}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          row.status === "Completed"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-blue-500/10 text-blue-400"
                        }`}
                      >
                        {row.status === "Completed" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredLeaderboard.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No participants match your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "Live"
      ? "bg-emerald-500/10 text-emerald-400"
      : status === "Completed"
      ? "bg-primary/10 text-primary"
      : "bg-amber-500/10 text-amber-400";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {status}
    </span>
  );
}
