import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Target,
  Trophy,
  BookOpen,
  Award,
  Clock,
  Home,
  ArrowRight,
  CheckCircle2,
  X,
  Sparkles,
  Flame,
  BarChart3,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  Search,
  Lock,
  PlayCircle,
  Crown,
  FileText,
  Calendar,
} from "lucide-react";
import StuEvents from "./stuevents";
import { API_BASE_URL } from "@/lib/config";
import {
  ACCENT_CLASSES,
  getSelectedEvent,
  getStudentName,
  type MockEvent,
} from "@/lib/mock-events";
import {
  CHALLENGES,
  DIFFICULTY_BADGE,
  TOTAL_POINTS,
  completedCount,
  computeScore,
  getProgress,
  setActive,
  type Challenge,
  type ProgressMap,
} from "@/lib/mock-challenges";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — Blueteamers Arena" },
      { name: "description", content: "Your arena dashboard." },
      { property: "og:title", content: "Dashboard — Blueteamers Arena" },
      { property: "og:description", content: "Your arena dashboard." },
    ],
  }),
});

const sidebarItems = [
  { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "Events", label: "Events", icon: Calendar },
  { id: "Challenges", label: "Challenges", icon: Target },
  { id: "Leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "Rules", label: "Rules", icon: BookOpen, isAction: true },
  { id: "Certificate", label: "Certificate", icon: Award, locked: true },
];

const rules = [
  "20 Challenges",
  "60 Minutes Duration",
  "One Attempt Only",
  "No Page Refresh / Back",
  "Auto Submit on Timeout",
];

const podium = [
  { rank: 1, medal: "🥇", name: "Rahul", score: 950, time: "1:42:18", color: "#F59E0B", border: "border-amber-500/60", bg: "from-amber-500/10 via-card to-card" },
  { rank: 2, medal: "🥈", name: "Akhil", score: 910, time: "1:45:07", color: "#9CA3AF", border: "border-slate-400/40", bg: "from-slate-400/10 via-card to-card" },
  { rank: 3, medal: "🥉", name: "Sanjay", score: 890, time: "1:48:12", color: "#B45309", border: "border-amber-700/40", bg: "from-amber-700/10 via-card to-card" },
];

const tableRows = [
  { rank: 4, student: "Anjali", challenges: "5/5", score: 870, time: "1:49:52", status: "Completed" },
  { rank: 5, student: "Kiran", challenges: "5/5", score: 850, time: "1:52:41", status: "Completed" },
  { rank: 6, student: "Priya", challenges: "4/5", score: 720, time: "—", status: "Running" },
  { rank: 7, student: "Rohith", challenges: "3/5", score: 610, time: "—", status: "Running" },
];

type LeaderboardFilter = "All" | "Completed" | "Running";

function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("Dashboard");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [name, setName] = useState("Student");
  const [ev, setEv] = useState<MockEvent>(() => getSelectedEvent());

  // Live state from PostgreSQL
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [challengeList, setChallengeList] = useState<any[]>([]);
  const [leaderboardItems, setLeaderboardItems] = useState<any[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<any | null>(null);
  const [challengeSearch, setChallengeSearch] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("All");

  // Leaderboard state
  const [leaderboardSearch, setLeaderboardSearch] = useState("");
  const [leaderboardFilter, setLeaderboardFilter] = useState<LeaderboardFilter>("All");

  useEffect(() => {
    setEv(getSelectedEvent());
    fetch(`${API_BASE_URL}/dashboard/`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData && (resData.data || resData.success)) {
          const d = resData.data || resData;
          setDashboardData(d);
          if (d.student?.name) setName(d.student.name);
          if (Array.isArray(d.challenges)) setChallengeList(d.challenges);
        }
      })
      .catch((err) => console.error("Error fetching student dashboard:", err));

    fetch(`${API_BASE_URL}/challenges/`)
      .then((res) => res.json())
      .then((resData) => {
        const list = resData.data?.results || resData.results || resData.data || (Array.isArray(resData) ? resData : []);
        if (Array.isArray(list) && list.length > 0) {
          setChallengeList(list);
        }
      })
      .catch(() => {});

    fetch(`${API_BASE_URL}/leaderboard/`)
      .then((res) => res.json())
      .then((resData) => {
        const list = resData.data?.leaderboard || resData.leaderboard || resData.results || resData.data || (Array.isArray(resData) ? resData : []);
        if (Array.isArray(list)) {
          setLeaderboardItems(list);
        }
      })
      .catch((err) => console.error("Error fetching leaderboard:", err));
  }, []);

  const score = useMemo(() => challengeList.reduce((acc, c) => acc + (c.points_earned || 0), 0), [challengeList]);
  const done = useMemo(() => challengeList.filter((c) => c.is_completed || c.completed).length, [challengeList]);

  const filteredChallenges = useMemo(() => {
    return challengeList.filter((c: any) => {
      const title = String(c.title || c.name || "").toLowerCase();
      const desc = String(c.description || "").toLowerCase();
      const q = challengeSearch.toLowerCase();
      const matchSearch = !q || title.includes(q) || desc.includes(q);
      const matchDiff =
        filterDifficulty === "All" ||
        String(c.difficulty || "").toLowerCase() === filterDifficulty.toLowerCase();
      return matchSearch && matchDiff;
    });
  }, [challengeList, challengeSearch, filterDifficulty]);

  const filteredLeaderboardRows = useMemo(() => {
    return leaderboardItems.map((p: any, idx: number) => ({
      rank: idx + 1,
      student: p.name || "Student",
      challenges: `${p.completed || 0}/5`,
      score: p.score || 0,
      time: p.time_taken || "--:--",
      status: p.completed > 0 ? "Completed" : "Running",
    })).filter((row) => {
      const matchesSearch = row.student.toLowerCase().includes(leaderboardSearch.toLowerCase());
      const matchesFilter = leaderboardFilter === "All" || row.status === leaderboardFilter;
      return matchesSearch && matchesFilter;
    });
  }, [leaderboardItems, leaderboardSearch, leaderboardFilter]);

  const accent = { text: "text-primary", border: "border-primary", bg: "bg-primary", bgSoft: "bg-primary/10", hover: "hover:bg-primary/80" };

  const handleStartChallenge = (c: Challenge) => {
    setActive(c.id);
    navigate({ to: "/challenge/play" });
  };

  const dashboardStats = [
    { label: "Progress", value: "0%", icon: BarChart3, sub: "Completion rate" },
    { label: "Score", value: "0", icon: Flame, sub: "Points earned" },
    { label: "Rank", value: "--", icon: Trophy, sub: `/ ${ev?.participants ?? 180} Participants` },
    { label: "Challenges", value: `0 / ${ev?.challenges ?? 20}`, icon: Target, sub: "Completed" },
  ];

  const sortedPodium = [podium[1], podium[0], podium[2]];

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Background Glow Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.12),rgba(255,255,255,0))]" />

      {/* Flush Edge Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-40 bg-card border-r border-border/80 flex flex-col justify-between transition-all duration-300 ${
          collapsed ? "w-16 p-3" : "w-64 p-5"
        }`}
      >
        <div>
          {/* Sidebar Top Header with Brand & Collapse Button */}
          <div className="mb-6 flex items-center justify-between">
            {!collapsed ? (
              <Link to="/" className="group flex items-center gap-3 transition-opacity hover:opacity-80">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-card shadow-sm">
                  <span className={`text-base font-bold ${accent.text}`}>B</span>
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-extrabold tracking-wider">BLUETEAMERS</div>
                  <div className={`text-[10px] font-bold tracking-widest ${accent.text}`}>ARENA</div>
                </div>
              </Link>
            ) : (
              <Link to="/" className="mx-auto flex items-center justify-center">
                <div className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card shadow-sm">
                  <span className={`text-base font-bold ${accent.text}`}>B</span>
                </div>
              </Link>
            )}

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {/* Nav Items */}
          <nav className="mt-4">
            <ul className="space-y-1.5 font-medium text-sm">
              {sidebarItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      title={collapsed ? item.label : undefined}
                      onClick={() => {
                        if (item.isAction) {
                          setRulesOpen(true);
                        } else if (!item.locked) {
                          setActiveTab(item.id);
                        }
                      }}
                      className={`group w-full flex items-center gap-3 rounded-xl transition-all duration-200 cursor-pointer ${
                        collapsed ? "justify-center px-2 py-3" : "px-3.5 py-2.5"
                      } ${
                        isActive
                          ? `${accent.bgSoft} ${accent.text} font-semibold shadow-sm`
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                      {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                      {!collapsed && item.locked && <span className="text-[10px] opacity-70">🔒</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* Bottom Back to Home Link */}
        <div className="border-t border-border/60 pt-4">
          <Link
            to="/"
            title={collapsed ? "Back to Home" : undefined}
            className={`flex items-center gap-3 rounded-xl text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground ${
              collapsed ? "justify-center p-2.5" : "px-3.5 py-2.5"
            }`}
          >
            <Home className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Back to Home</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content Area (Dynamic Margin based on sidebar state) */}
      <main className={`relative z-10 transition-all duration-300 ${collapsed ? "pl-16" : "pl-64"}`}>
        {/* Top Header Navigation Bar */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-card hover:text-foreground border border-border/60"
              title="Toggle sidebar"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <h1 className="text-lg font-bold tracking-tight text-foreground">{activeTab}</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-3.5 py-1 text-xs font-semibold text-foreground shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{ev?.college || "CBIT"} • {ev?.workshop || "AI with SOC Workshop"}</span>
            </div>
          </div>
        </header>

        {/* Tab: Events */}
        {activeTab === "Events" && <StuEvents hideNav />}

        {/* Tab 1: Dashboard Overview */}
        {activeTab === "Dashboard" && (
          <div className="p-6 lg:p-8 space-y-6 w-full max-w-[1600px]">
            {/* Hero Welcome Card */}
            <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card to-card/90 p-6 sm:p-8 shadow-xl backdrop-blur-sm">
              <div className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full ${accent.bgSoft} blur-3xl`} />

              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Welcome back,
                  </div>
                  <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
                    {name} <span className="inline-block animate-bounce duration-1000">👋</span>
                  </h1>
                  <div className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                    <ShieldCheck className={`h-3.5 w-3.5 ${accent.text}`} />
                    <span>{ev?.college || "CBIT"} • {ev?.workshop || "AI with SOC Workshop"}</span>
                  </div>
                </div>

                {/* Time Left Container */}
                <div className="rounded-xl border border-border/80 bg-[var(--surface)] p-4 px-6 text-center shadow-inner backdrop-blur-sm min-w-[140px]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time Left</div>
                  <div className="mt-1.5 flex items-center justify-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground">
                    <Clock className={`h-5 w-5 animate-pulse ${accent.text}`} /> 60:00
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">Minutes</div>
                </div>
              </div>
            </div>

            {/* Stats 4-Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {dashboardStats.map((s) => (
                <div
                  key={s.label}
                  className="group rounded-2xl border border-border/80 bg-card p-5 shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-primary/10 hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <span>{s.label}</span>
                    <s.icon className={`h-4 w-4 ${accent.text} opacity-80`} />
                  </div>
                  <div className="mt-3 text-3xl font-extrabold tracking-tight text-foreground">{s.value}</div>
                  {s.sub && <div className="mt-1 text-xs font-medium text-muted-foreground">{s.sub}</div>}
                </div>
              ))}
            </div>

            {/* 2-Column Section */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Journey CTA Box */}
              <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl backdrop-blur-sm flex flex-col justify-between group">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className={`h-5 w-5 ${accent.text}`} />
                    <h3 className="text-xl font-bold tracking-tight">Start Your Journey</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Click the button below to start the first challenge.
                  </p>
                </div>

                <button
                  onClick={() => setRulesOpen(true)}
                  className={`mt-6 inline-flex items-center justify-center gap-2 rounded-xl ${accent.bg} ${accent.hover} px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]`}
                >
                  Start Challenge <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>

              {/* Event Info Box */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl backdrop-blur-sm">
                <h3 className="text-xl font-bold tracking-tight">Event Info</h3>
                <dl className="mt-4 space-y-2.5 text-sm">
                  {[
                    ["Event", ev?.workshop || "AI with SOC Workshop"],
                    ["College", ev?.college || "CBIT"],
                    ["Date", ev?.date || "22 July 2026"],
                    ["Duration", ev?.duration || "60 Minutes"],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between rounded-xl border border-border/40 bg-card/60 px-4 py-2.5 transition-colors hover:border-border"
                    >
                      <dt className="text-muted-foreground font-medium">{k}</dt>
                      <dd className="font-semibold text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Challenges List */}
        {activeTab === "Challenges" && (
          <div className="p-6 lg:p-8 space-y-6 w-full max-w-[1600px]">
            {/* Section Header & Filter Controls */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">Investigation Challenges</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Complete challenges in any order. Only one challenge can be active at a time.
                </p>
              </div>

              {/* Search & Filter Inputs */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[240px]">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={challengeSearch}
                    onChange={(e) => setChallengeSearch(e.target.value)}
                    placeholder="Search challenges..."
                    className="w-full rounded-xl border border-border/80 bg-card py-2 pl-9 pr-4 text-sm outline-none focus:border-primary"
                  />
                </div>

                <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-card p-1">
                  {["All", "Easy", "Medium", "Hard"].map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setFilterDifficulty(diff)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                        filterDifficulty.toLowerCase() === diff.toLowerCase()
                          ? `${accent.bg} text-white shadow-sm`
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Challenges List */}
            <ul className="space-y-4">
              {filteredChallenges.map((c) => {
                const status = (c.is_completed || c.completed) ? "completed" : "not_started";
                const diffBadge = (DIFFICULTY_BADGE as any)[c.difficulty] || "border-blue-500/30 bg-blue-500/10 text-blue-400";
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedChallenge(c)}
                      className="group relative flex w-full items-center gap-5 rounded-2xl border border-border/80 bg-card p-6 text-left shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:bg-card/95 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-0.5 cursor-pointer"
                    >
                      <div
                        className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-bold text-lg shadow-inner ${accent.bgSoft} ${accent.text} border border-border/40 group-hover:scale-105 transition-transform`}
                      >
                        {c.number || 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                            {c.title || c.name}
                          </h3>
                          <span
                            className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${diffBadge}`}
                          >
                            {c.difficulty}
                          </span>
                          <StatusBadge status={status} />
                        </div>
                        <p className="mt-1.5 truncate text-xs sm:text-sm leading-relaxed text-muted-foreground">
                          {c.description}
                        </p>
                      </div>

                      <div className="hidden shrink-0 items-center gap-6 text-right sm:flex">
                        <div className="rounded-xl border border-border/60 bg-[var(--surface)]/80 px-4 py-2 text-center shadow-inner">
                          <div className="text-xs font-semibold text-foreground">{c.duration} mins</div>
                          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">Duration</div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-[var(--surface)]/80 px-4 py-2 text-center shadow-inner">
                          <div className="text-xs font-semibold text-foreground">{c.points} pts</div>
                          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">Reward</div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Tab 3: Embedded Leaderboard View */}
        {activeTab === "Leaderboard" && (
          <div className="p-6 lg:p-8 space-y-8 w-full max-w-[1600px]">
            {/* Page Title & Controls */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
                  Arena Leaderboard
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Live standings based on points, completed challenges, and submission speed.
                </p>
              </div>

              {/* Search & Filter Controls */}
              <div className="flex flex-wrap items-center gap-3.5">
                <div className="relative min-w-[260px] sm:min-w-[320px]">
                  <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={leaderboardSearch}
                    onChange={(e) => setLeaderboardSearch(e.target.value)}
                    placeholder="Search student..."
                    className="w-full rounded-xl border border-border/80 bg-card py-2.5 pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/40 shadow-sm"
                  />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl border border-border/80 bg-card p-1.5 shadow-sm">
                  {(["All", "Completed", "Running"] as LeaderboardFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setLeaderboardFilter(f)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                        leaderboardFilter === f
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Podium Top 3 Champions Section */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
              {sortedPodium.map((p) => {
                const isFirst = p.rank === 1;
                return (
                  <div
                    key={p.rank}
                    className={`relative group rounded-2xl border ${p.border} bg-gradient-to-b ${p.bg} p-6 text-center shadow-xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 ${
                      isFirst ? "sm:-translate-y-3 shadow-amber-500/10 border-amber-500/80" : ""
                    }`}
                  >
                    {isFirst && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full border border-amber-500/60 bg-amber-500/20 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-amber-400 backdrop-blur-md shadow-sm">
                        <Crown className="h-3 w-3 text-amber-400" /> Champion
                      </div>
                    )}
                    <div
                      className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-inner border border-border/40"
                      style={{ backgroundColor: `${p.color}20`, color: p.color }}
                    >
                      {p.medal}
                    </div>
                    <div className="mt-4 text-base font-bold text-foreground">{p.name}</div>
                    <div className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">
                      {p.score} <span className="text-xs font-semibold text-muted-foreground">Points</span>
                    </div>
                    <div className="mt-1.5 text-xs font-medium text-muted-foreground/80 flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3" /> Time {p.time}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Leaderboard Table (Ranks 4+) */}
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl backdrop-blur-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-border/80 bg-[var(--surface)] text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-4 text-left">Rank</th>
                    <th className="px-5 py-4 text-left">Student</th>
                    <th className="px-5 py-4 text-left">Challenges</th>
                    <th className="px-5 py-4 text-right">Score</th>
                    <th className="px-5 py-4 text-right">Time</th>
                    <th className="px-5 py-4 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-medium">
                  {filteredLeaderboardRows.map((row) => (
                    <tr
                      key={row.rank}
                      className="transition-colors hover:bg-accent/40"
                    >
                      <td className="px-5 py-4">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-[var(--surface)] text-xs font-bold text-muted-foreground">
                          #{row.rank}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold text-foreground">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                            {row.student.charAt(0)}
                          </div>
                          <span>{row.student}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{row.challenges}</td>
                      <td className="px-5 py-4 text-right font-extrabold text-foreground">{row.score} pts</td>
                      <td className="px-5 py-4 text-right text-muted-foreground text-xs">{row.time}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-[11px] font-semibold ${
                            row.status === "Completed"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : "border-blue-500/30 bg-blue-500/10 text-blue-400"
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
                  {filteredLeaderboardRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                        No students match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Rules Modal */}
      {rulesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setRulesOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-8 shadow-2xl shadow-black/80 transition-all transform animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <h2 className="text-xl font-bold text-foreground">Rules of the Arena</h2>
              <button
                onClick={() => setRulesOpen(false)}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <ul className="mt-6 space-y-3.5">
              {rules.map((r) => (
                <li key={r} className="flex items-center gap-3 text-sm font-medium text-foreground">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10">
                    <CheckCircle2 className={`h-4 w-4 ${accent.text}`} />
                  </div>
                  <span>{r}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => {
                setRulesOpen(false);
                setActiveTab("Challenges");
              }}
              className={`mt-8 block w-full rounded-xl ${accent.bg} ${accent.hover} px-5 py-3.5 text-center text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]`}
            >
              Start Competition
            </button>
          </div>
        </div>
      )}

      {/* Challenge Details Modal */}
      {selectedChallenge && (
        <DetailsModal
          challenge={selectedChallenge}
          accentText={accent.text}
          accentBg={accent.bg}
          accentHover={accent.hover}
          onClose={() => setSelectedChallenge(null)}
          onStart={() => handleStartChallenge(selectedChallenge)}
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

function StatusBadge({ status }: { status: "not_started" | "in_progress" | "completed" }) {
  if (status === "completed")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> Completed
      </span>
    );
  if (status === "in_progress")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-400">
        <PlayCircle className="h-3.5 w-3.5" /> In Progress
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[var(--surface)] px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
      <Lock className="h-3.5 w-3.5" /> Not Started
    </span>
  );
}

function DetailsModal({
  challenge,
  accentText,
  accentBg,
  accentHover,
  onClose,
  onStart,
}: {
  challenge: Challenge;
  accentText: string;
  accentBg: string;
  accentHover: string;
  onClose: () => void;
  onStart: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/80 bg-card p-8 shadow-2xl shadow-black/90 transition-all transform animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-4 border-b border-border/60">
          <div>
            <div className={`text-xs font-extrabold uppercase tracking-wider ${accentText}`}>
              Challenge {challenge.number}
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{challenge.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{challenge.description}</p>

        {/* 3 Metric Pills */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-3.5 shadow-inner">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Estimated Time</div>
            <div className="mt-1 text-base font-bold text-foreground">{challenge.duration} min</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-3.5 shadow-inner">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Max Points</div>
            <div className="mt-1 text-base font-bold text-foreground">{challenge.points}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-3.5 shadow-inner">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Difficulty</div>
            <div className="mt-1 text-base font-bold text-foreground">{challenge.difficulty}</div>
          </div>
        </div>

        <Section title="Skills Tested">
          <div className="flex flex-wrap gap-2">
            {challenge.skills.map((s) => (
              <span
                key={s}
                className="rounded-lg border border-border/80 bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm"
              >
                {s}
              </span>
            ))}
          </div>
        </Section>

        <Section title="Objectives">
          <ul className="space-y-2 text-sm font-medium">
            {challenge.objectives.map((o) => (
              <li key={o} className="flex items-start gap-2.5 text-muted-foreground">
                <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${accentText}`} />
                <span className="text-foreground">{o}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Resources Included">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium text-muted-foreground">
            {challenge.resources.map((r) => (
              <li key={r.name} className="flex items-center gap-2 truncate rounded-lg border border-border/40 bg-[var(--surface)] px-3 py-2">
                <FileText className={`h-3.5 w-3.5 shrink-0 ${accentText}`} />
                <span className="truncate text-foreground">{r.name}</span>
              </li>
            ))}
          </ul>
        </Section>

        <div className="mt-8 flex gap-4 pt-4 border-t border-border/60">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-foreground transition-all hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={onStart}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl ${accentBg} ${accentHover} px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]`}
          >
            Start Challenge <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}
