import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  PlayCircle,
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
  const [ev, setEv] = useState<MockEvent | null>(null);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [selected, setSelected] = useState<Challenge | null>(null);

  useEffect(() => {
    const eventCode = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("arena.selectedEventCode") : null;
    if (!eventCode) {
      navigate({ to: "/arena" });
      return;
    }
    setEv(getSelectedEvent());
    setProgress(getProgress());
  }, []);

  const score = useMemo(() => computeScore(progress), [progress]);
  const done = useMemo(() => completedCount(progress), [progress]);

  if (!ev) return null;
  const accent = ACCENT_CLASSES[ev.accent];

  const startChallenge = (c: Challenge) => {
    setActive(c.id);
    navigate({ to: "/challenge/play" });
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-6 py-8">
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

        <div className="mt-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Challenges</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete challenges in any order. Only one challenge can be active at a time.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-3">
          {CHALLENGES.map((c) => {
            const status = progress[c.id] ?? "not_started";
            return (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c)}
                  className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-border/80 hover:bg-card/80"
                >
                  <div className={`grid h-10 w-10 flex-none place-items-center rounded-lg ${accent.bgSoft} ${accent.text} font-semibold`}>
                    {c.number}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{c.name}</h3>
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${DIFFICULTY_BADGE[c.difficulty]}`}
                      >
                        {c.difficulty}
                      </span>
                      <StatusBadge status={status} />
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {c.description}
                    </p>
                  </div>
                  <div className="hidden flex-none gap-6 text-right text-xs text-muted-foreground sm:flex">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{c.duration}</div>
                      mins
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{c.points}</div>
                      points
                    </div>
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
