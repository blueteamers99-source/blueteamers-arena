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
  AlertCircle,
  Crown,
  TimerReset,
} from "lucide-react";

import { Navbar } from "@/components/Navbar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { API_BASE_URL } from "@/lib/config";
import { studentAuthFetch } from "@/lib/auth";
import { extractLeaderboardPayload } from "@/lib/api-types";
import type { LeaderboardEntry, LeaderboardPayload } from "@/lib/api-types";
import { formatClock } from "@/lib/useEventCountdown";

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
  const [leaderboardItems, setLeaderboardItems] = useState<LeaderboardEntry[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPayload | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<LeaderboardEntry | null>(null);
  // Local relative countdown: the server supplies the authoritative remaining
  // seconds on every poll; we tick it down locally between polls.
  const [serverRemaining, setServerRemaining] = useState<number | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number>(Date.now());
  const [nowTick, setNowTick] = useState<number>(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const displayRemaining =
    serverRemaining === null ? null : Math.max(0, serverRemaining - Math.floor((nowTick - lastSyncAt) / 1000));

  const fetchLeaderboardData = () => {
    setIsRefreshing(true);
    const eventCode =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem("arena.selectedEventCode")
        : null;

    let url =
      eventCode && eventCode !== "global"
        ? `${API_BASE_URL}/leaderboard/?event_code=${encodeURIComponent(eventCode)}`
        : `${API_BASE_URL}/leaderboard/current/`;

    const applyPayload = (resData: unknown) => {
      const payload = extractLeaderboardPayload(resData);
      setLeaderboard(payload);
      setLeaderboardItems(payload.rankings);
      if (typeof payload.time_remaining === "number") {
        setServerRemaining(payload.time_remaining);
        setLastSyncAt(Date.now());
      }
    };

    studentAuthFetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Leaderboard request failed");
        return res.json();
      })
      .then((resData) => {
        const payload = extractLeaderboardPayload(resData);
        if (payload.rankings.length > 0) {
          applyPayload(resData);
        } else if (url !== `${API_BASE_URL}/leaderboard/current/`) {
          // Event-scoped query returned nothing usable — retry with the
          // authenticated participant's own event.
          url = `${API_BASE_URL}/leaderboard/current/`;
          return studentAuthFetch(url)
            .then((retryRes) => (retryRes.ok ? retryRes.json() : null))
            .then((retryData) => {
              if (retryData) applyPayload(retryData);
            });
        }
      })
      .catch((err) => {
        console.error("Error fetching command center data:", err);
        setFetchError("Unable to load leaderboard data. Please try again.");
      })
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

  // Calculate PostgreSQL Command Center Top Statistics (from real data only)
  const totalParticipants = leaderboardItems.length;
  const activeParticipants = leaderboardItems.filter((i) => !i.is_finished).length;
  const completedParticipants = leaderboardItems.filter((i) => i.is_finished).length;
  const totalChallenges = leaderboardItems.reduce((m, i) => Math.max(m, i.completed || 0), 0) || 5;
  const avgScore = totalParticipants > 0 ? Math.round(leaderboardItems.reduce((acc, i) => acc + i.score, 0) / totalParticipants) : 0;
  const certificatesGenerated = leaderboardItems.filter((i) => i.score >= 600).length;
  const liveChallengesRunning = leaderboardItems.filter((i) => !i.is_finished && i.score > 0).length;
  const isFinal = Boolean(leaderboard?.is_final);
  const winner = leaderboard?.winner ?? (isFinal && leaderboardItems[0] ? leaderboardItems[0] : null);
  const finalReason = leaderboard?.final_reason ?? null;
  const eventStatus = leaderboard?.event_status ?? "Live";
  // While the quiz runs this is the current top-3 of the live board; once the
  // event is final it switches to the officially announced top-3 winners —
  // always sourced from the same ranked list, so both views stay in sync.
  const podium = isFinal
    ? leaderboard?.winners?.length
      ? leaderboard.winners
      : leaderboardItems.slice(0, 3)
    : leaderboard?.top3_podium?.length
      ? leaderboard.top3_podium
      : leaderboardItems.slice(0, 3);
  // Best score so far — the live "pace setter" to make the run feel alive.
  const topScore = leaderboardItems.length > 0 ? leaderboardItems[0].score : 0;
  const secondsToHHMMSS = (secs: number | null) =>
    secs === null ? "--:-- : --" : formatClock(secs);

  // Filtered Leaderboard Items
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaderboardItems.filter((item) => {
      const nameMatch = !q || item.name.toLowerCase().includes(q) || item.email.toLowerCase().includes(q) || item.college_name.toLowerCase().includes(q);
      const collegeMatch = collegeFilter === "All" || item.college_name === collegeFilter;
      const statusMatch = statusFilter === "All" || (statusFilter === "Completed" ? item.is_finished : !item.is_finished);
      return nameMatch && collegeMatch && statusMatch;
    });
  }, [leaderboardItems, search, collegeFilter, statusFilter]);

  const exportCSV = () => {
    const escapeCSV = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const headers = ["Rank", "Name", "Email", "College", "Completed Challenges", "Total Score", "Status"];
    const rows = filteredItems.map((item, idx) => [
      idx + 1,
      escapeCSV(item.name),
      escapeCSV(item.email),
      escapeCSV(item.college_name),
      `${item.completed}/5`,
      item.score,
      item.is_finished ? "Completed" : "Running",
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
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${isFinal ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"}`}>
                <span className={`h-2 w-2 rounded-full ${isFinal ? "bg-amber-400" : "bg-emerald-400"} ${isFinal ? "" : "animate-ping"}`} />
                {isFinal ? "🏁 FINAL RESULTS" : "⚡ REAL-TIME COMMAND CENTER"}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {isFinal ? "STANDINGS LOCKED" : eventStatus === "Live" ? "LIVE — UPDATES EVERY 4s" : "POSTGRESQL LIVE AGGREGATION"}
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              SOC Arena Command Center
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isFinal
                ? "The competition has concluded. Final standings are locked and the winner is crowned."
                : "Live control room monitoring student activity, incident submissions, rankings, and certificates."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Live countdown + top score pulse */}
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-md">
              <TimerReset className={`h-4 w-4 ${displayRemaining !== null && displayRemaining <= 0 && !isFinal ? "text-destructive" : "text-primary"}`} />
              <div className="leading-tight">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{isFinal ? "Event Ended" : "Time Remaining"}</div>
                <div className={`font-mono font-bold text-sm ${displayRemaining !== null && displayRemaining <= 0 && !isFinal ? "text-destructive" : "text-foreground"}`}>
                  {secondsToHHMMSS(displayRemaining)}
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 shadow-md">
              <Flame className="h-4 w-4 text-amber-400" />
              <div className="leading-tight">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Top Score</div>
                <div className="font-mono font-bold text-sm text-amber-400">{topScore} PTS</div>
              </div>
            </div>

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

        {/* Winner Jumbotron — crowned the moment results are final */}
        {isFinal && winner && (
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-card to-emerald-500/10 p-6 shadow-2xl">
            <div className="pointer-events-none absolute -right-8 -top-10 text-[180px] font-black text-amber-500/10 select-none leading-none">🏆</div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between relative z-10">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
                  <Crown className="h-4 w-4" />
                  {finalReason === "all_finished" ? "ALL PARTICIPANTS FINISHED" : "EVENT TIME EXPIRED"} — WINNER CROWNED
                </div>
                <h2 className="mt-3 text-4xl font-black tracking-tight text-foreground">
                  {winner.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {winner.college_name} • {winner.completed} challenges completed • Finished in {winner.time_taken || "--:--"}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-4xl font-black text-amber-400 font-mono">{winner.score}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Final Score</div>
                </div>
                {isPassedEntry(winner) && (
                  <Link
                    to="/verify"
                    search={{ id: `CERT-BLUETEAM-${strId(winner.participant_id)}` }}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-black shadow-lg hover:bg-amber-400 transition-all"
                  >
                    <Award className="h-4 w-4" /> Winner Certificate
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Podium — top 3 on the live board while running, final order when locked */}
        {podium.length > 0 && (
          <ErrorBoundary label="Leaderboard Podium">
            <div className="grid gap-4 sm:grid-cols-3">
              {podium.map((p, idx) => (
                <div
                  key={p.participant_id}
                  className={`rounded-2xl border p-4 shadow-xl relative overflow-hidden ${
                    idx === 0 ? "border-amber-500/60 bg-gradient-to-b from-amber-500/15 to-card"
                    : idx === 1 ? "border-slate-400/40 bg-gradient-to-b from-slate-400/10 to-card"
                    : "border-amber-700/40 bg-gradient-to-b from-amber-700/10 to-card"
                  }`}
                >
                  <div className="text-3xl">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</div>
                  <div className="mt-2 truncate font-bold text-foreground">{p.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{p.college_name}</div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-amber-400">{p.score} PTS</span>
                    <span className="text-muted-foreground">{p.completed} completed</span>
                  </div>
                  {!isFinal && !p.is_finished && (
                    <span className="absolute right-3 top-3 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-black">LIVE</span>
                  )}
                </div>
              ))}
            </div>
          </ErrorBoundary>
        )}

        {/* Error Banner */}
        {fetchError && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{fetchError}</span>
            <button onClick={() => { setFetchError(null); fetchLeaderboardData(); }} className="ml-auto rounded-lg border border-destructive/30 px-3 py-1 text-xs font-bold hover:bg-destructive/20 transition-all cursor-pointer">
              Retry
            </button>
          </div>
        )}

        {/* 6 Top Statistics Cards */}
        <ErrorBoundary label="Leaderboard Stats">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard icon={<Users className="h-4 w-4 text-blue-400" />} label="Total Participants" value={totalParticipants} sub="Enrolled in Event" />
          <StatCard icon={<Activity className="h-4 w-4 text-emerald-400" />} label="Currently Active" value={activeParticipants} sub="Online Now" />
          <StatCard icon={<CheckCircle2 className="h-4 w-4 text-cyan-400" />} label="Completed Event" value={completedParticipants} sub={`All ${totalChallenges} Challenges`} />
          <StatCard icon={<Flame className="h-4 w-4 text-amber-400" />} label="Average Score" value={`${avgScore} Pts`} sub="Avg Score" />
          <StatCard icon={<Award className="h-4 w-4 text-purple-400" />} label="Certificates Issued" value={certificatesGenerated} sub="Verified Credentials" />
          <StatCard icon={<Trophy className="h-4 w-4 text-rose-400" />} label="Live Challenges" value={liveChallengesRunning} sub="Running Sessions" />
        </div>
        </ErrorBoundary>

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
          <ErrorBoundary label="Leaderboard Table">
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
                  {filteredItems.length === 0 && !fetchError && !isRefreshing && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        No leaderboard data available yet.
                      </td>
                    </tr>
                  )}
                  {filteredItems.map((item, idx) => {
                    // Rank comes from the server (ordered by score, then finish
                    // time) so it always matches the participant's actual score —
                    // never re-derive it from filtered row position.
                    const rank = item.rank;
                    const completedCount = item.completed;
                    const progressPct = Math.round((completedCount / 5) * 100);
                    const isPassed = item.score >= 600;

                    return (
                      <tr
                        key={item.participant_id || idx}
                        className={`transition-colors ${item.is_current_user ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-primary/5"}`}
                      >
                        <td className="px-4 py-3.5 font-mono font-bold">
                          {rank === 1 ? (
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 font-bold border border-amber-500/40">🥇 1</span>
                          ) : rank === 2 ? (
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-400/20 text-slate-300 font-bold border border-slate-400/40">🥈 2</span>
                          ) : rank === 3 ? (
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-700/20 text-amber-500 font-bold border border-amber-700/40">🥉 3</span>
                          ) : rank != null ? (
                            <span className="text-muted-foreground">#{rank}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-foreground">{item.name || "Security Analyst"}</div>
                          <div className="text-[10px] text-muted-foreground">{item.email || "participant@arena.io"}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            {item.college_name || "VRSEC"}
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
                          {item.score} PTS
                        </td>
                        <td className="px-4 py-3.5">
                          {item.is_finished ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                              🏁 Completed
                            </span>
                          ) : item.score > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" /> In Progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                              🟡 Not Started
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
                            <Link
                              to="/verify"
                              search={{ id: `CERT-BLUETEAM-${strId(item.participant_id)}` }}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-bold text-emerald-400 hover:bg-emerald-600/30 transition-all"
                            >
                              <Download className="h-3 w-3" /> PDF
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </ErrorBoundary>

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
                {leaderboardItems.length > 0 ? (
                  leaderboardItems.slice(0, 5).map((item, i) => (
                    <li key={item.participant_id || i} className="flex gap-2.5 border-b border-border/40 pb-2 last:border-0">
                      <span className="font-mono text-[10px] font-bold text-muted-foreground">#{item.rank}</span>
                      <span className="text-muted-foreground leading-tight">
                        {item.name} — {item.score} Pts
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-muted-foreground text-center py-4">No activity data available</li>
                )}
              </ul>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> College Rankings
              </h3>
              <ul className="space-y-2.5 text-xs">
                {(() => {
                  const collegeMap = new Map<string, { totalScore: number; count: number }>();
                  leaderboardItems.forEach((item) => {
                    const college = item.college_name || "Unknown";
                    const existing = collegeMap.get(college) || { totalScore: 0, count: 0 };
                    existing.totalScore += item.score;
                    existing.count += 1;
                    collegeMap.set(college, existing);
                  });
                  const colleges = Array.from(collegeMap.entries())
                    .map(([name, data]) => ({
                      name,
                      avgScore: data.count > 0 ? Math.round(data.totalScore / data.count) : 0,
                      count: data.count,
                    }))
                    .sort((a, b) => b.avgScore - a.avgScore)
                    .slice(0, 5);

                  if (colleges.length === 0) {
                    return <li className="text-muted-foreground text-center py-4">No college data available</li>;
                  }

                  return colleges.map((c, i) => (
                    <li key={c.name} className="flex items-center justify-between rounded-xl border border-border/50 bg-[var(--surface)] p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary">#{i + 1}</span>
                        <span className="font-bold text-foreground">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground">({c.count} participants)</span>
                      </div>
                      <span className="font-mono font-semibold text-emerald-400">{c.avgScore} Pts Avg</span>
                    </li>
                  ));
                })()}
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
                <p className="text-xs text-muted-foreground">{selectedStudent.email} • {selectedStudent.college_name || "VRSEC"}</p>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-border/50 bg-[var(--surface)] p-3">
                <span className="text-muted-foreground">Total PostgreSQL Score</span>
                <p className="text-xl font-extrabold text-amber-400 mt-1">{selectedStudent.score} PTS</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-[var(--surface)] p-3">
                <span className="text-muted-foreground">Completed Challenges</span>
                <p className="text-xl font-extrabold text-emerald-400 mt-1">{selectedStudent.completed} / 5</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Challenge Breakdown</h4>
              <div className="space-y-1.5 text-xs">
                <div className="text-muted-foreground text-center py-2 text-xs">No challenge data available</div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border/50">
              <button onClick={() => setSelectedStudent(null)} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
                Close
              </button>
              {(selectedStudent.score) >= 600 && (
                <Link
                  to="/verify"
                  search={{ id: `CERT-BLUETEAM-${strId(selectedStudent.participant_id)}` }}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-all flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" /> Download PDF Certificate
                </Link>
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

function isPassedEntry(item: LeaderboardEntry): boolean {
  return item.score >= 600;
}

function strId(id: string | number | null | undefined): string {
  if (!id) return "0000";
  const s = String(id);
  return s.substring(0, 8).toUpperCase();
}
