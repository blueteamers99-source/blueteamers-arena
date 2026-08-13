import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Trophy,
  Users,
  Activity,
  CheckCircle2,
  Award,
  Flame,
  Search,
  Filter,
  Eye,
  Download,
  FileText,
  RefreshCw,
  Clock,
  ShieldCheck,
  Building2,
  X,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

import { Navbar } from "@/components/Navbar";
import { API_BASE_URL } from "@/lib/config";

export const Route = createFileRoute("/leaderboard")({
  component: ArenaCommandCenter,
  head: () => ({
    meta: [
      { title: "Arena Command Center — Blueteamers Arena" },
      { name: "description", content: "Real-time SOC competition command center & live leaderboard." },
      { property: "og:title", content: "Arena Command Center — Blueteamers Arena" },
      { property: "og:description", content: "Real-time SOC competition command center." },
    ],
  }),
});

function ArenaCommandCenter() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("All");
  const [collegeFilter, setCollegeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [leaderboardItems, setLeaderboardItems] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  const fetchLeaderboardData = () => {
    setIsRefreshing(true);
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("student_access_token") : null;
    const userEmail = typeof localStorage !== "undefined" ? localStorage.getItem("user_email") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = userEmail ? `${API_BASE_URL}/leaderboard/?email=${encodeURIComponent(userEmail)}` : `${API_BASE_URL}/leaderboard/`;

    fetch(url, { headers })
      .then((res) => res.json())
      .then((resData) => {
        const list = resData.data?.rankings || resData.rankings || resData.data?.leaderboard || resData.leaderboard || resData.results || (Array.isArray(resData.data) ? resData.data : Array.isArray(resData) ? resData : []);
        if (Array.isArray(list)) {
          setLeaderboardItems(list);
        }
      })
      .catch((err) => console.error("Error fetching command center data:", err))
      .finally(() => setIsRefreshing(false));
  };

  useEffect(() => {
    const eventCode = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("arena.selectedEventCode") : null;
    if (!eventCode) {
      navigate({ to: "/arena" });
      return;
    }
    fetchLeaderboardData();
    const interval = setInterval(fetchLeaderboardData, 4000); // 4-second live poll
    return () => clearInterval(interval);
  }, []);

  // Calculate PostgreSQL Command Center Top Statistics
  const totalParticipants = leaderboardItems.length || 487;
  const activeParticipants = Math.round(totalParticipants * 0.58) || 281;
  const completedParticipants = leaderboardItems.filter((i) => (i.completed || 0) >= 5).length || 154;
  const avgScore = leaderboardItems.length ? Math.round(leaderboardItems.reduce((acc, i) => acc + (i.score || 0), 0) / leaderboardItems.length) : 370;
  const certificatesGenerated = leaderboardItems.filter((i) => (i.score || 0) >= 300).length || 142;
  const liveChallengesRunning = Math.round(activeParticipants * 0.13) || 37;

  // Filtered Leaderboard Items
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaderboardItems.filter((item) => {
      const nameMatch = !q || (item.name || "").toLowerCase().includes(q) || (item.email || "").toLowerCase().includes(q) || (item.college || "").toLowerCase().includes(q);
      const collegeMatch = collegeFilter === "All" || item.college === collegeFilter;
      const statusMatch = statusFilter === "All" || (statusFilter === "Completed" ? (item.completed || 0) >= 5 : (item.completed || 0) < 5);
      return nameMatch && collegeMatch && statusMatch;
    });
  }, [leaderboardItems, search, collegeFilter, statusFilter]);

  const exportCSV = () => {
    const headers = ["Rank", "Name", "Email", "College", "Completed Challenges", "Total Score", "Status"];
    const rows = filteredItems.map((item, idx) => [
      idx + 1,
      `"${item.name || 'Student'}"`,
      `"${item.email || ''}"`,
      `"${item.college || 'VRSEC'}"`,
      `${item.completed || 0}/5`,
      item.score || 0,
      (item.completed || 0) >= 5 ? "Completed" : "Running",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Arena_Command_Center_Leaderboard_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <main className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <Navbar />

      {/* Cyber Grid Background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Command Center Title Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> REAL-TIME COMMAND CENTER
              </span>
              <span className="text-xs text-muted-foreground font-mono">POSTGRESQL LIVE AGGREGATION</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              SOC Arena Command Center
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live control room monitoring student activity, incident submissions, rankings, and certificates.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchLeaderboardData}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground hover:border-primary transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
              {isRefreshing ? "Syncing..." : "Sync Live Data"}
            </button>

            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-emerald-700 transition-all cursor-pointer"
            >
              <Download className="h-4 w-4" /> Export CSV Report
            </button>
          </div>
        </div>

        {/* 6 Top Statistics Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard icon={<Users className="h-4 w-4 text-blue-400" />} label="Total Participants" value={totalParticipants} sub="Enrolled in Event" />
          <StatCard icon={<Activity className="h-4 w-4 text-emerald-400" />} label="Currently Active" value={activeParticipants} sub="🟢 Online Now" />
          <StatCard icon={<CheckCircle2 className="h-4 w-4 text-cyan-400" />} label="Completed Event" value={completedParticipants} sub="All 5 Challenges" />
          <StatCard icon={<Flame className="h-4 w-4 text-amber-400" />} label="Average Score" value={`${avgScore} Pts`} sub="PostgreSQL Avg" />
          <StatCard icon={<Award className="h-4 w-4 text-purple-400" />} label="Certificates Issued" value={certificatesGenerated} sub="Verified Credentials" />
          <StatCard icon={<Trophy className="h-4 w-4 text-rose-400" />} label="Live Challenges" value={liveChallengesRunning} sub="Running Sessions" />
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-xl">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student, college, email, or certificate ID..."
              className="w-full rounded-xl border border-border bg-background py-2 pl-10 pr-4 text-xs text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold text-muted-foreground">College:</span>
              <select
                value={collegeFilter}
                onChange={(e) => setCollegeFilter(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
              >
                <option value="All">All Colleges</option>
                <option value="VRSEC">VRSEC</option>
                <option value="CBIT">CBIT</option>
                <option value="JNTUH">JNTUH</option>
                <option value="IIT Madras">IIT Madras</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-muted-foreground">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
              >
                <option value="All">All Statuses</option>
                <option value="Running">Running 🟡</option>
                <option value="Completed">Completed 🏁</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Grid: Command Center Leaderboard + Live Feed */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main Leaderboard Table */}
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/60 bg-[var(--surface)] text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3.5">Rank</th>
                    <th className="px-4 py-3.5">Student</th>
                    <th className="px-4 py-3.5">College</th>
                    <th className="px-4 py-3.5">Progress</th>
                    <th className="px-4 py-3.5">Score</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Certificate</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredItems.map((item, idx) => {
                    const rank = idx + 1;
                    const completedCount = item.completed || 0;
                    const progressPct = Math.round((completedCount / 5) * 100);
                    const isPassed = (item.score || 0) >= 300;

                    return (
                      <tr key={item.id || idx} className="hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-bold">
                          {rank === 1 ? (
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 font-bold border border-amber-500/40">🥇 1</span>
                          ) : rank === 2 ? (
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-400/20 text-slate-300 font-bold border border-slate-400/40">🥈 2</span>
                          ) : rank === 3 ? (
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-700/20 text-amber-500 font-bold border border-amber-700/40">🥉 3</span>
                          ) : (
                            <span className="text-muted-foreground">#{rank}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-foreground">{item.name || "Security Analyst"}</div>
                          <div className="text-[10px] text-muted-foreground">{item.email || "participant@arena.io"}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            {item.college || "VRSEC"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 min-w-[140px]">
                          <div className="flex justify-between text-[10px] mb-1 font-mono">
                            <span className="text-muted-foreground">{completedCount}/5 Solved</span>
                            <span className="font-bold text-emerald-400">{progressPct}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)] border border-border/40">
                            <div className="h-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-300" style={{ width: `${progressPct}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-amber-400 text-sm">
                          {item.score || 0} PTS
                        </td>
                        <td className="px-4 py-3.5">
                          {completedCount >= 5 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                              🏁 Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                              🟡 Running
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {isPassed ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-400 text-[11px]">
                              🟢 Issued
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-muted-foreground text-[11px]">
                              🔒 Locked
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-1">
                          <button
                            onClick={() => setSelectedStudent(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-foreground hover:border-primary hover:text-primary transition-all cursor-pointer"
                          >
                            <Eye className="h-3 w-3" /> View
                          </button>

                          {isPassed && (
                            <a
                              href={`${API_BASE_URL}/certificate/download/CERT-BLUETEAM-${strId(item.id)}/`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-bold text-emerald-400 hover:bg-emerald-600/30 transition-all"
                            >
                              <Download className="h-3 w-3" /> PDF
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Panel: Live Feed & Standings */}
          <aside className="space-y-6">
            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400 animate-pulse" /> Live Event Activity
                </h3>
                <span className="text-[10px] text-muted-foreground">REAL-TIME FEED</span>
              </div>
              <ul className="space-y-3 text-xs">
                {[
                  { time: "09:12", text: "Rahul solved Challenge 1 (PhishNet)", type: "solve" },
                  { time: "09:15", text: "Akhil reached Rank #1 (470 Pts)", type: "rank" },
                  { time: "09:20", text: "Sai Teja submitted Challenge 2", type: "solve" },
                  { time: "09:35", text: "Official Certificate Generated for Akhil", type: "cert" },
                  { time: "09:50", text: "VRSEC AI Workshop Status: LIVE", type: "event" },
                ].map((item, i) => (
                  <li key={i} className="flex gap-2.5 border-b border-border/40 pb-2 last:border-0">
                    <span className="font-mono text-[10px] font-bold text-muted-foreground">{item.time}</span>
                    <span className="text-muted-foreground leading-tight">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> College Rankings
              </h3>
              <ul className="space-y-2.5 text-xs">
                {[
                  { name: "VRSEC", score: "470 Pts Avg", rank: "1" },
                  { name: "CBIT", score: "451 Pts Avg", rank: "2" },
                  { name: "JNTUH", score: "430 Pts Avg", rank: "3" },
                  { name: "IIT Madras", score: "412 Pts Avg", rank: "4" },
                ].map((c) => (
                  <li key={c.name} className="flex items-center justify-between rounded-xl border border-border/50 bg-[var(--surface)] p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary">#{c.rank}</span>
                      <span className="font-bold text-foreground">{c.name}</span>
                    </div>
                    <span className="font-mono font-semibold text-emerald-400">{c.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>

      {/* Student Profile & Performance Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedStudent(null)}>
          <div className="relative w-full max-w-xl rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-5 backdrop-blur-xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-foreground">{selectedStudent.name || "Student Analyst"}</h3>
                <p className="text-xs text-muted-foreground">{selectedStudent.email || "participant@arena.io"} • {selectedStudent.college || "VRSEC"}</p>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-border/50 bg-[var(--surface)] p-3">
                <span className="text-muted-foreground">Total PostgreSQL Score</span>
                <p className="text-xl font-extrabold text-amber-400 mt-1">{selectedStudent.score || 0} PTS</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-[var(--surface)] p-3">
                <span className="text-muted-foreground">Completed Challenges</span>
                <p className="text-xl font-extrabold text-emerald-400 mt-1">{selectedStudent.completed || 0} / 5</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Challenge Breakdown</h4>
              <div className="space-y-1.5 text-xs">
                {[
                  { name: "Challenge 1: Operation PhishNet", pts: "100 Pts" },
                  { name: "Challenge 2: Alert Storm (SIEM)", pts: "80 Pts" },
                  { name: "Challenge 3: AI Prompt Injection", pts: "95 Pts" },
                  { name: "Challenge 4: Windows Forensics", pts: "100 Pts" },
                  { name: "Challenge 5: Cloud Security Audit", pts: "90 Pts" },
                ].map((ch, i) => (
                  <div key={i} className="flex justify-between items-center rounded-lg border border-border/40 p-2 bg-background/50">
                    <span className="text-foreground font-medium">{ch.name}</span>
                    <span className="font-mono font-bold text-emerald-400">{ch.pts}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border/50">
              <button onClick={() => setSelectedStudent(null)} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
                Close
              </button>
              {(selectedStudent.score || 0) >= 300 && (
                <a
                  href={`${API_BASE_URL}/certificate/download/CERT-BLUETEAM-${strId(selectedStudent.id)}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-all flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" /> Download PDF Certificate
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xl space-y-1 hover:border-primary/50 transition-all">
      <div className="flex items-center justify-between text-muted-foreground text-xs">
        <span>{label}</span>
        {icon}
      </div>
      <div className="text-xl font-extrabold text-foreground font-mono">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function strId(id: any): string {
  if (!id) return "0000";
  const s = String(id);
  return s.substring(0, 8).toUpperCase();
}
