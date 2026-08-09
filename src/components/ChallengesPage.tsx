import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  PlayCircle,
  Search,
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
  fetchChallengesApi,
  startChallengeApi,
  type Challenge,
  type ProgressMap,
} from "@/lib/mock-challenges";

export default function ChallengesPage({ hideNav }: { hideNav?: boolean } = {}) {
  const navigate = useNavigate();
  const [ev, setEv] = useState<MockEvent | null>(null);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [challenges, setChallenges] = useState<Challenge[]>(CHALLENGES);
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [search, setSearch] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("All");

  useEffect(() => {
    setEv(getSelectedEvent());
    setProgress(getProgress());
    fetchChallengesApi().then((list) => {
      if (list && list.length > 0) setChallenges(list);
    });
  }, []);

  const score = useMemo(() => computeScore(progress), [progress]);
  const done = useMemo(() => completedCount(progress), [progress]);

  const filteredChallenges = useMemo(() => {
    return challenges.filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase());
      const matchDiff =
        filterDifficulty === "All" ||
        c.difficulty.toLowerCase() === filterDifficulty.toLowerCase();
      return matchSearch && matchDiff;
    });
  }, [challenges, search, filterDifficulty]);

  if (!ev) return null;
  const accent = ACCENT_CLASSES[ev.accent];

  const startChallenge = (c: Challenge) => {
    startChallengeApi(c.id);
    navigate({ to: "/challenge/play" });
  };

  return (
    <main className={`min-h-screen bg-background ${hideNav ? "p-6 lg:p-8" : ""}`}>
      <div className={`mx-auto ${hideNav ? "w-full max-w-[1600px]" : "max-w-7xl px-6 py-8"}`}>
        {!hideNav && (
          <div className="mb-6 flex items-center justify-between">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Link>
            <div className="text-xs text-muted-foreground">
              {ev.college} • {ev.workshop}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
            sub="Points"
          />
          <StatCard
            icon={<Clock className={`h-4 w-4 ${accent.text}`} />}
            label="Time Remaining"
            value="02:05:18"
            sub="Hours"
          />
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Investigation Challenges</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete challenges in any order. Only one challenge can be active at a time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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

        <ul className="mt-6 space-y-4">
          {filteredChallenges.map((c) => {
            const status = progress[c.id] ?? "not_started";
            return (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c)}
                  className="group relative flex w-full items-center gap-5 rounded-2xl border border-border/80 bg-card p-6 text-left shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:bg-card/95 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-0.5 cursor-pointer"
                >
                  <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-bold text-lg shadow-inner ${accent.bgSoft} ${accent.text} border border-border/40 group-hover:scale-105 transition-transform`}>
                    {c.number}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">{c.name}</h3>
                      <span
                        className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${DIFFICULTY_BADGE[c.difficulty]}`}
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
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: "not_started" | "in_progress" | "completed" }) {
  if (status === "completed")
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> Completed
      </span>
    );
  if (status === "in_progress")
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
        <PlayCircle className="h-3 w-3" /> In Progress
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Lock className="h-3 w-3" /> Not Started
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-card p-8 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className={`text-xs font-medium ${accentText}`}>
              Challenge {challenge.number}
            </div>
            <h2 className="mt-1 text-xl font-bold">{challenge.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">{challenge.description}</p>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-border bg-[var(--surface)] p-3">
            <div className="text-xs text-muted-foreground">Estimated Time</div>
            <div className="mt-1 text-sm font-semibold">{challenge.duration} min</div>
          </div>
          <div className="rounded-lg border border-border bg-[var(--surface)] p-3">
            <div className="text-xs text-muted-foreground">Max Points</div>
            <div className="mt-1 text-sm font-semibold">{challenge.points}</div>
          </div>
          <div className="rounded-lg border border-border bg-[var(--surface)] p-3">
            <div className="text-xs text-muted-foreground">Difficulty</div>
            <div className="mt-1 text-sm font-semibold">{challenge.difficulty}</div>
          </div>
        </div>

        <Section title="Skills Tested">
          <div className="flex flex-wrap gap-2">
            {challenge.skills.map((s) => (
              <span
                key={s}
                className="rounded-md border border-border bg-[var(--surface)] px-2 py-0.5 text-xs text-muted-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        </Section>

        <Section title="Objectives">
          <ul className="space-y-1.5 text-sm">
            {challenge.objectives.map((o) => (
              <li key={o} className="flex gap-2 text-muted-foreground">
                <CheckCircle2 className={`mt-0.5 h-4 w-4 flex-none ${accentText}`} />
                {o}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Resources Included">
          <ul className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
            {challenge.resources.map((r) => (
              <li key={r.name} className="truncate">
                • {r.name}
              </li>
            ))}
          </ul>
        </Section>

        <div className="mt-8 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border bg-[var(--surface)] px-5 py-2.5 text-sm font-medium text-foreground hover:bg-card"
          >
            Cancel
          </button>
          <button
            onClick={onStart}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg ${accentBg} ${accentHover} px-5 py-2.5 text-sm font-semibold text-white transition-colors`}
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
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}
