import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Home,
  Lock,
  PlayCircle,
  Search,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";
import {
  ACCENT_CLASSES,
  getSelectedEvent,
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

import { Navbar } from "@/components/Navbar";
import { API_BASE_URL } from "@/lib/config";

export const Route = createFileRoute("/challenges")({
  component: ChallengesPage,
  head: () => ({
    meta: [
      { title: "Challenges — Blueteamers Arena" },
      { name: "description", content: "Select and complete SOC investigation challenges." },
      { property: "og:title", content: "Challenges — Blueteamers Arena" },
      { property: "og:description", content: "SOC investigation challenges." },
    ],
  }),
});

function ChallengesPage() {
  const navigate = useNavigate();
  const [challengeList, setChallengeList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("All");

  useEffect(() => {
    fetch(`${API_BASE_URL}/challenges/`)
      .then((res) => res.json())
      .then((resData) => {
        const list = resData.data?.results || resData.results || resData.data || (Array.isArray(resData) ? resData : []);
        if (Array.isArray(list)) {
          setChallengeList(list);
        }
      })
      .catch((err) => console.error("Error fetching challenges:", err));
  }, []);

  const score = useMemo(() => challengeList.reduce((acc, c) => acc + (c.points_earned || 0), 0), [challengeList]);
  const done = useMemo(() => challengeList.filter((c) => c.is_completed || c.completed).length, [challengeList]);

  const filteredChallenges = useMemo(() => {
    return challengeList.filter((c: any) => {
      const title = String(c.title || c.name || "").toLowerCase();
      const desc = String(c.description || "").toLowerCase();
      const q = search.toLowerCase();
      const matchSearch = !q || title.includes(q) || desc.includes(q);
      const matchDiff =
        filterDifficulty === "All" ||
        String(c.difficulty || "").toLowerCase() === filterDifficulty.toLowerCase();
      return matchSearch && matchDiff;
    });
  }, [challengeList, search, filterDifficulty]);

  const accent = { text: "text-primary", border: "border-primary", bg: "bg-primary", bgSoft: "bg-primary/10", hover: "hover:bg-primary/80" };
  const progress = useMemo(() => getProgress(), []);

  const startChallenge = (c: any) => {
    navigate({ to: `/challenge/play` as any });
  };

  return (
    <main className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <Navbar />

      {/* Background Glow Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.12),rgba(255,255,255,0))]" />

      {/* Content Container */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Stat Cards 3-Grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <StatCard
            icon={<Target className={`h-4 w-4 ${accent.text}`} />}
            label="Progress"
            value={`${done} / ${CHALLENGES.length}`}
            sub="Challenges Completed"
          />
          <StatCard
            icon={<Trophy className={`h-4 w-4 ${accent.text}`} />}
            label="Current Score"
            value={`${score} / ${TOTAL_POINTS}`}
            sub="Points Earned"
          />
          <StatCard
            icon={<Clock className={`h-4 w-4 ${accent.text}`} />}
            label="Time Remaining"
            value="02:05:18"
            sub="Hours Left"
          />
        </div>

        {/* Section Header & Filter Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              Investigation Challenges
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Complete challenges in any order. Only one challenge can be active at a time.
            </p>
          </div>

          {/* Search & Filter Inputs */}
          <div className="flex flex-wrap items-center gap-3.5">
            <div className="relative min-w-[260px] sm:min-w-[320px]">
              <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search challenges..."
                className="w-full rounded-xl border border-border/80 bg-card py-2.5 pl-10 pr-4 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/40 shadow-sm"
              />
            </div>

            <div className="flex items-center gap-1.5 rounded-2xl border border-border/80 bg-card p-1.5 shadow-sm">
              {["All", "Easy", "Medium", "Hard"].map((diff) => (
                <button
                  key={diff}
                  onClick={() => setFilterDifficulty(diff)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
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
            const status = (c.is_completed || c.completed) ? "completed" : (progress[c.id] ?? "not_started");
            return (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c)}
                  className="group relative flex w-full items-center gap-5 rounded-2xl border border-border/80 bg-card p-6 text-left shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:bg-card/95 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-0.5"
                >
                  {/* Challenge Number Badge */}
                  <div
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-bold text-lg shadow-inner ${accent.bgSoft} ${accent.text} border border-border/40 group-hover:scale-105 transition-transform`}
                  >
                    {c.number}
                  </div>

                  {/* Challenge Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                        {c.name}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${(DIFFICULTY_BADGE as any)[c.difficulty] || "border-blue-500/30 bg-blue-500/10 text-blue-400"}`}
                      >
                        {c.difficulty}
                      </span>
                      <StatusBadge status={status} />
                    </div>
                    <p className="mt-1.5 truncate text-xs sm:text-sm leading-relaxed text-muted-foreground">
                      {c.description}
                    </p>
                  </div>

                  {/* Challenge Stats Pill */}
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

      {/* Details Modal */}
      {selected && (
        <DetailsModal
          challenge={selected}
          accentText={accent.text}
          accentBg={accent.bg}
          accentHover={accent.hover}
          onClose={() => setSelected(null)}
          onStart={() => startChallenge(selected)}
        />
      )}
    </main>
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
