import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Crown,
  Home,
  Medal,
  Search,
  Trophy,
} from "lucide-react";

import { Navbar } from "@/components/Navbar";

export const Route = createFileRoute("/leaderboard")({
  component: Leaderboard,
  head: () => ({
    meta: [
      { title: "Leaderboard — Blueteamers Arena" },
      { name: "description", content: "Competition leaderboard." },
      { property: "og:title", content: "Leaderboard — Blueteamers Arena" },
      { property: "og:description", content: "Competition leaderboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Filter = "All" | "Completed" | "Running";

function Leaderboard() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [leaderboardItems, setLeaderboardItems] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/v1/leaderboard/")
      .then((res) => res.json())
      .then((resData) => {
        const list = resData.data?.leaderboard || resData.leaderboard || resData.results || resData.data || (Array.isArray(resData) ? resData : []);
        if (Array.isArray(list)) {
          setLeaderboardItems(list);
        }
      })
      .catch((err) => console.error("Error fetching leaderboard:", err));
  }, []);

  const podiumData = leaderboardItems.slice(0, 3).map((p: any, idx: number) => ({
    rank: idx + 1,
    medal: idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉",
    name: p.name || "Student",
    score: p.score || 0,
    time: p.time_taken || "--:--",
    color: idx === 0 ? "#F59E0B" : idx === 1 ? "#9CA3AF" : "#B45309",
    border: idx === 0 ? "border-amber-500/60" : idx === 1 ? "border-slate-400/40" : "border-amber-700/40",
    bg: idx === 0 ? "from-amber-500/10 via-card to-card" : idx === 1 ? "from-slate-400/10 via-card to-card" : "from-amber-700/10 via-card to-card",
  }));

  const sortedPodium = podiumData.length >= 3 ? [podiumData[1], podiumData[0], podiumData[2]] : podiumData;

  const tableRows = leaderboardItems.slice(3).map((p: any, idx: number) => ({
    rank: idx + 4,
    student: p.name || "Student",
    challenges: `${p.completed || 0}/5`,
    score: p.score || 0,
    time: p.time_taken || "--:--",
    status: p.completed > 0 ? "Completed" : "Running",
  }));

  const filteredRows = tableRows.filter((row) => {
    const matchesSearch = row.student.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "All" || row.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <main className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <Navbar />

      {/* Background Glow Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.12),rgba(255,255,255,0))]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Page Title & Search/Filter Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              Arena Leaderboard
            </h1>
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student..."
                className="w-full rounded-xl border border-border/80 bg-card py-2.5 pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/40 shadow-sm"
              />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl border border-border/80 bg-card p-1.5 shadow-sm">
              <FilterButton active={filter === "All"} onClick={() => setFilter("All")}>
                All
              </FilterButton>
              <FilterButton active={filter === "Completed"} onClick={() => setFilter("Completed")}>
                Completed
              </FilterButton>
              <FilterButton active={filter === "Running"} onClick={() => setFilter("Running")}>
                Running
              </FilterButton>
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
              {filteredRows.map((row) => (
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
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No students match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Back Navigation */}
        <div className="pt-2 flex items-center justify-between border-t border-border/60">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/50 hover:bg-card/80 hover:text-foreground shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition-all hover:border-primary/50 hover:bg-card/80 hover:text-foreground shadow-sm"
          >
            <Home className="h-4 w-4" /> Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
        active
          ? "bg-primary text-white shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
