import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Trophy,
  Target,
  Clock,
  Medal,
  ArrowLeft,
  Home,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

export const Route = createFileRoute("/competition-complete")({
  component: CompetitionComplete,
  head: () => ({
    meta: [
      { title: "Competition Complete — Blueteamers Arena" },
      {
        name: "description",
        content: "You have successfully completed all investigation challenges.",
      },
      {
        property: "og:title",
        content: "Competition Complete — Blueteamers Arena",
      },
      {
        property: "og:description",
        content: "You have successfully completed all investigation challenges.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CompetitionComplete() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [certData, setCertData] = useState<any>(null);

  useEffect(() => {
    const eventCode = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("arena.selectedEventCode") : null;
    if (!eventCode) {
      navigate({ to: "/arena" });
      return;
    }

    const token = typeof localStorage !== "undefined" ? localStorage.getItem("student_access_token") : null;
    const userEmail = typeof localStorage !== "undefined" ? localStorage.getItem("user_email") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = userEmail ? `${API_BASE_URL}/dashboard/me/?email=${encodeURIComponent(userEmail)}` : `${API_BASE_URL}/dashboard/me/`;

    fetch(url, { headers })
      .then((res) => res.json())
      .then((resData) => {
        if (resData) setData(resData);
      })
      .catch(() => {});

    // Fetch official PostgreSQL certificate status
    fetch(`${API_BASE_URL}/certificate/`, { headers })
      .then((res) => res.json())
      .then((cData) => setCertData(cData))
      .catch(() => {});
  }, []);

  const score = data?.score ?? data?.data?.current_score ?? 0;
  const rank = data?.rank ?? data?.data?.current_rank ?? 1;
  const done = data?.completed ?? data?.data?.completed_challenges ?? 5;
  const total = data?.total ?? data?.data?.current_event?.total_challenges ?? 5;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-3xl">
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <h1 className="mt-8 text-3xl font-extrabold tracking-tight">
            Competition Complete
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            You have successfully completed all investigation challenges for {data?.event || "Blueteamers Arena"}.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryCard
            icon={<Trophy className="h-4 w-4 text-emerald-400" />}
            label="Final Score"
            value={`${score} Points`}
          />
          <SummaryCard
            icon={<Target className="h-4 w-4 text-emerald-400" />}
            label="Challenges Completed"
            value={`${done} / ${total}`}
          />
          <SummaryCard
            icon={<Clock className="h-4 w-4 text-emerald-400" />}
            label="College"
            value={data?.college || "VRSEC"}
          />
          <SummaryCard
            icon={<Medal className="h-4 w-4 text-emerald-400" />}
            label="Final Rank"
            value={`#${rank}`}
          />
        </div>

        <div className="mt-8 rounded-xl border border-border bg-card p-6 text-center space-y-3">
          <h2 className="text-lg font-semibold">Official Event Results</h2>
          <p className="text-sm text-muted-foreground">
            Great job {data?.name || "Participant"}! Your performance has been verified and recorded in PostgreSQL.
          </p>

          {certData && (
            <div className={`p-4 rounded-xl border ${certData.unlocked ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-amber-500/40 bg-amber-500/10 text-amber-400"} text-sm font-semibold`}>
              {certData.unlocked ? (
                <div className="space-y-2">
                  <p>🎓 Official Certificate Unlocked! ID: <span className="font-mono font-bold">{certData.certificate_id}</span></p>
                  <a
                    href={`/certificate?id=${certData.certificate_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-all"
                  >
                    🎓 View & Download Verified Certificate
                  </a>
                </div>
              ) : (
                <div>
                  <p>🔒 Certificate Unavailable</p>
                  <p className="text-xs font-normal text-muted-foreground mt-1">
                    {certData.message || `You scored ${score} points, but ${certData.passing_score || 300} points are required to earn a certificate.`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/leaderboard"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
          >
            <Trophy className="h-4 w-4" />
            View Leaderboard
          </Link>
          <Link
            to="/review"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-card"
          >
            Review My Answers
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Return to Dashboard
          </Link>
          <span className="text-muted-foreground/40">•</span>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Home className="h-4 w-4" /> Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
