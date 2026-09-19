import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Flag,
  Lightbulb,
  Maximize2,
  Save,
  Target,
  Trophy,
} from "lucide-react";
import {
  ACCENT_CLASSES,
  getSelectedEvent,
  type MockEvent,
} from "@/lib/mock-events";
import {
  CHALLENGES,
  DIFFICULTY_BADGE,
  completedCount,
  getActive,
  getProgress,
  setStatus,
  saveProgressApi,
  submitChallengeApi,
  startChallengeApi,
  fetchChallengeDetailApi,
  type Challenge,
} from "@/lib/mock-challenges";
import { API_BASE_URL } from "@/lib/config";
import { getStudentAccessToken, studentAuthFetch } from "@/lib/auth";
import { useEventCountdown } from "@/lib/useEventCountdown";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import evidenceEmail from "@/assets/evidence-email.png";
import evidenceUrl from "@/assets/evidence-url.png";
import evidenceWazuh from "@/assets/evidence-wazuh.png";
import evidenceSyslog from "@/assets/evidence-syslog.png";
import evidenceNetwork from "@/assets/evidence-network.png";
import evidenceDiskSummary from "@/assets/evidence-disk-summary.png";
import evidenceMemoryStrings from "@/assets/evidence-memory-strings.png";
import evidenceTimeline from "@/assets/evidence-timeline.png";
import evidenceNetworkCapture from "@/assets/evidence-network-capture.png";
import evidenceAiSummary from "@/assets/evidence-ai-summary.png";
import evidenceHostTelemetry from "@/assets/evidence-host-telemetry.png";
import evidenceIrRunbook from "@/assets/evidence-ir-runbook.png";
import evidenceEdrEvents from "@/assets/evidence-edr-events.png";
import evidenceAuthAudit from "@/assets/evidence-auth-audit.png";
import { EVIDENCE_TEXT } from "@/lib/evidence-text";
import { EvidenceCodeViewer } from "@/components/EvidenceCodeViewer";

// Only true image evidence is rendered via <img>. TXT / JSON / CSV files
// are rendered as live text by <EvidenceCodeViewer>.
const EVIDENCE_URLS: Record<string, string> = {
  "/__EVIDENCE_EMAIL__": evidenceEmail,
  "/__EVIDENCE_URL__": evidenceUrl,
  "/__EVIDENCE_WAZUH__": evidenceWazuh,
  "/__EVIDENCE_SYSLOG__": evidenceSyslog,
  "/__EVIDENCE_NETWORK__": evidenceNetwork,
  "/__EVIDENCE_DISK_SUMMARY__": evidenceDiskSummary,
  "/__EVIDENCE_MEMORY_STRINGS__": evidenceMemoryStrings,
  "/__EVIDENCE_TIMELINE__": evidenceTimeline,
  "/__EVIDENCE_PCAP__": evidenceNetworkCapture,
  "/__EVIDENCE_AI_SUMMARY__": evidenceAiSummary,
  "/__EVIDENCE_HOST_TELEMETRY__": evidenceHostTelemetry,
  "/__EVIDENCE_IR_RUNBOOK__": evidenceIrRunbook,
  "/__EVIDENCE_EDR_EVENTS__": evidenceEdrEvents,
  "/__EVIDENCE_AUTH_AUDIT__": evidenceAuthAudit,
};



export const Route = createFileRoute("/challenge/play")({
  validateSearch: (search: Record<string, unknown>): { challengeId?: string } => ({
    challengeId: (search.challengeId as string) || undefined,
  }),
  component: () => {
    const { challengeId } = Route.useSearch();
    return <PlayPage key={challengeId} />;
  },
  head: () => ({
    meta: [
      { title: "Challenge Workspace — Blueteamers Arena" },
      { name: "description", content: "SOC investigation workspace." },
      { property: "og:title", content: "Challenge Workspace — Blueteamers Arena" },
      { property: "og:description", content: "SOC investigation workspace." },
    ],
  }),
});

function PlayPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const [ev, setEv] = useState<MockEvent | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Universal event-wide timer (2:30:00) shared with the dashboard and the
  // challenges list. There is NO per-challenge timer anymore.
  const { formatted: eventTimeLeft, refresh: refreshEventClock } = useEventCountdown();
  // Universal score — the participant's total score across the whole event,
  // identical on every challenge.
  const [totalScore, setTotalScore] = useState<number | null>(null);
  const [activeEvidence, setActiveEvidence] = useState<string>("");
  const [peek, setPeek] = useState<{
    px: number;
    py: number;
    vw: number;
    vh: number;
    scale: number;
  } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const peekRef = useRef(peek);
  peekRef.current = peek;
  const peekReleaseTimer = useRef<number | null>(null);
  // This screen must never zoom the browser page: swallow Ctrl/meta + wheel
  // (mouse wheel and trackpad pinch both arrive as wheel events with ctrlKey)
  // anywhere on the page. Pinching should only magnify the evidence image.
  useEffect(() => {
    const blockPageZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    window.addEventListener("wheel", blockPageZoom, { passive: false });
    return () => window.removeEventListener("wheel", blockPageZoom);
  }, []);
  const schedulePeekRelease = () => {
    if (peekReleaseTimer.current !== null) window.clearTimeout(peekReleaseTimer.current);
    peekReleaseTimer.current = window.setTimeout(() => {
      peekReleaseTimer.current = null;
      setPeek(null);
    }, 250);
  };
  // The zoomed focal point, measured as the image pixel under the cursor:
  // px/py = position of that image point within the viewer (in px), plus the
  // viewer's current on-screen size. During zoom the scaled image is panned so
  // this point sits exactly at the viewer center, so the image is always
  // visible and magnified. Pressing outside the image falls back to the image
  // center so a zoom can never show an empty (black) view.
  const resolvePeekFocus = (clientX: number, clientY: number, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    const img = el.querySelector("img");
    const fallback = { px: rect.width / 2, py: rect.height / 2, vw: rect.width, vh: rect.height };
    if (!img || !img.parentElement) return fallback;
    // Use layout metrics (offset*) rather than getBoundingClientRect: the
    // zoom transform is applied to the image's container, so the visual rect
    // changes while zooming and would give wrong coordinates on repeat events.
    const fit = img.parentElement;
    const imgL = fit.offsetLeft + img.offsetLeft;
    const imgT = fit.offsetTop + img.offsetTop;
    const imgW = img.offsetWidth;
    const imgH = img.offsetHeight;
    if (imgW <= 0 || imgH <= 0) return fallback;
    const rawX = clientX - rect.left;
    const rawY = clientY - rect.top;
    const inside = rawX >= imgL && rawX <= imgL + imgW && rawY >= imgT && rawY <= imgT + imgH;
    const px = inside ? rawX : imgL + imgW / 2;
    const py = inside ? rawY : imgT + imgH / 2;
    return { px, py, vw: rect.width, vh: rect.height };
  };
  const nextZoomScale = (deltaY: number) =>
    Math.min(6, Math.max((peekRef.current?.scale ?? 1.5) + (deltaY < 0 ? 0.25 : -0.25), 1.2));
  const inlineViewerRef = useImageZoomWheel((e, el) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const f = resolvePeekFocus(e.clientX, e.clientY, el);
    setPeek({ ...f, scale: nextZoomScale(e.deltaY) });
    schedulePeekRelease();
  });
  const fullscreenViewerRef = useImageZoomWheel((e, el) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const f = resolvePeekFocus(e.clientX, e.clientY, el);
    setPeek({ ...f, scale: nextZoomScale(e.deltaY) });
    schedulePeekRelease();
  }, fullscreen);
  const peekStyle = peek
    ? {
        transformOrigin: "0 0" as const,
        transform: `translate(${peek.vw / 2 - peek.scale * peek.px}px, ${
          peek.vh / 2 - peek.scale * peek.py
        }px) scale(${peek.scale})`,
        transition: "transform 120ms ease-out",
      }
    : {
        transformOrigin: "0 0" as const,
        transition: "transform 200ms ease-out",
      };
  const [accessDenied, setAccessDenied] = useState(false);
  const [completedChallenge, setCompletedChallenge] = useState(false);
  const [completedScore, setCompletedScore] = useState<{ earned: number; max: number } | null>(null);

  const initialLoadedRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const currentRef = useRef(current);
  currentRef.current = current;

  useEffect(() => {
    const eventCode = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("arena.selectedEventCode") : null;
    if (!eventCode) {
      navigate({ to: "/arena" });
      return;
    }

    const activeId = searchParams.challengeId || getActive() || "phishnet";
    const localChallenge = CHALLENGES.find((x) => x.id === activeId) ?? CHALLENGES[0];
    setChallenge(localChallenge);
    setEv(getSelectedEvent());
    if (localChallenge.evidence?.length) setActiveEvidence(localChallenge.evidence[0].id);
    setAccessDenied(false);

    // Opening a challenge workspace is an explicit start: kick the universal
    // event clock (idempotent — no-op if already running), then re-sync so
    // the countdown ticks immediately.
    studentAuthFetch(`${API_BASE_URL}/dashboard/start-event-timer/`, { method: "POST" })
      .then(() => refreshEventClock())
      .catch(() => {});

    // Fetch the universal event score once per workspace load
    studentAuthFetch(`${API_BASE_URL}/dashboard/me/`)
      .then((res) => res.json())
      .then((payload: unknown) => {
        if (payload && typeof payload === "object") {
          const root = payload as Record<string, unknown>;
          const scoreVal = typeof root.score === "number" ? root.score : (root.data as Record<string, unknown> | undefined)?.current_score;
          if (typeof scoreVal === "number") setTotalScore(scoreVal);
        }
      })
      .catch(() => {});

    // 1. Fetch live challenge definition if available.
    // A 403 means the backend rejected cross-event access — show the
    // access-denied state instead of falling back to mock content.
    fetchChallengeDetailApi(activeId).then(({ challenge: serverChall, forbidden }) => {
      if (forbidden) {
        setAccessDenied(true);
        return;
      }
      if (serverChall) {
        setChallenge(serverChall);
        // Re-anchor the preview tab to the server's FIRST evidence. The
        // initial selection above comes from the local mock, whose evidence
        // order can differ from the server's — leaving it untouched would
        // open the workspace on the wrong (e.g. 2nd) resource.
        if (serverChall.evidence?.length) {
          setActiveEvidence(serverChall.evidence[0].id);
        }
      }
    });

    // 2. Fetch server-authoritative progress and resume state.
    // Also starts (or resumes) the universal event clock on the backend —
    // idempotent: the clock first starts on the student's first click.
    startChallengeApi(activeId).then((progressState) => {
      if (progressState) {
        // Re-sync the universal event clock from the server
        refreshEventClock();

        // Restore saved answers from server
        const restoredAnswers: Record<string, string> = {};
        if (progressState.answers && typeof progressState.answers === "object") {
          for (const [k, v] of Object.entries(progressState.answers)) {
            if (v !== undefined && v !== null) {
              restoredAnswers[k] = String(v);
            }
          }
        } else if (progressState.draft_answers && typeof progressState.draft_answers === "object") {
          for (const [k, v] of Object.entries(progressState.draft_answers)) {
            if (v && typeof v === "object" && "answer_text" in v) {
              const inner = v as { answer_text?: unknown };
              restoredAnswers[k] = typeof inner.answer_text === "string" ? inner.answer_text : "";
            } else if (v !== undefined && v !== null) {
              restoredAnswers[k] = String(v);
            }
          }
        }

        if (Object.keys(restoredAnswers).length > 0 && !initialLoadDoneRef.current) {
          setAnswers(restoredAnswers);
        }

        if (progressState.status === "completed") {
          setCompletedChallenge(true);
          setCompletedScore({
            earned: typeof progressState.score_earned === "number" ? progressState.score_earned : 0,
            max:
              typeof progressState.max_possible_score === "number"
                ? progressState.max_possible_score
                : 0,
          });
        }
        if (progressState.status) {
          setStatus(activeId, progressState.status === "completed" ? "completed" : "in_progress");
        }
      }
      initialLoadedRef.current = true;
      initialLoadDoneRef.current = true;
    }).catch(() => {
      initialLoadedRef.current = true;
      initialLoadDoneRef.current = true;
    });

    if (activeId && getProgress()[activeId] === "completed") {
      setCompletedChallenge(true);
    }
    if (activeId && getProgress()[activeId] !== "completed") {
      setStatus(activeId, "in_progress");
    }
  }, [searchParams.challengeId]);

  // Debounced auto-save on answers or current question changes
  useEffect(() => {
    if (!initialLoadedRef.current || !challenge || completedChallenge) return;
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      const ok = await saveProgressApi(
        challenge.id,
        answers,
        current,
        Object.keys(answers),
      );
      if (ok) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } else {
        setSaveStatus("error");
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [answers, current, challenge, completedChallenge]);

  // Unload listener for emergency auto-save
  // Uses keepalive fetch so the browser won't cancel the request on tab close.
  useEffect(() => {
    const handleUnload = () => {
      if (challenge && initialLoadedRef.current && !completedChallenge) {
        const token = getStudentAccessToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        try {
          fetch(`${API_BASE_URL}/challenges/${challenge.id}/save-progress/`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              answers: answersRef.current,
              current_question_index: currentRef.current,
              visited_questions: Object.keys(answersRef.current),
            }),
            keepalive: true,
          });
        } catch {
          // Best-effort save on page unload — nothing we can do if it fails
        }
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      handleUnload();
    };
  }, [challenge, completedChallenge]);

  const answered = useMemo(
    () => (challenge && challenge.questions ? challenge.questions.filter((q) => answers[q.id]?.trim()).length : 0),
    [answers, challenge],
  );

  // Auto-redirect to arena when the backend denies cross-event access.
  useEffect(() => {
    if (!accessDenied) return;
    const id = setTimeout(() => navigate({ to: "/arena" }), 4000);
    return () => clearTimeout(id);
  }, [accessDenied, navigate]);

  if (accessDenied) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-400" />
          <h2 className="mt-4 text-xl font-semibold">Challenge Not Available</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This challenge is not part of your registered event. You can only access challenges
            belonging to the event you joined with your event code.
          </p>
          <button
            onClick={() => navigate({ to: "/arena" })}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Back to Arena
          </button>
          <p className="mt-3 text-xs text-muted-foreground">Redirecting automatically...</p>
        </div>
      </main>
    );
  }

  if (!ev || !challenge) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-semibold">Loading Challenge...</h2>
          <p className="mt-2 text-sm text-muted-foreground">Fetching challenge details from database.</p>
          <button
            onClick={() => navigate({ to: "/challenges" })}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Back to Challenges
          </button>
        </div>
      </main>
    );
  }

  if (completedChallenge) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <h2 className="mt-4 text-xl font-semibold">{challenge.name} — Already Submitted</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You have already submitted this challenge and it has been graded. Your answers are
            locked and cannot be changed. Use the review page to view your submitted answers.
          </p>
          {completedScore && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400">
              <Trophy className="h-4 w-4" /> Score: {completedScore.earned} / {completedScore.max}
            </div>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => navigate({ to: "/review", search: { challenge: challenge.id } })}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Review My Answers
            </button>
            <button
              onClick={() => navigate({ to: "/challenges", replace: true })}
              className="inline-flex items-center justify-center rounded-md border border-border bg-[var(--surface)] px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Back to Challenges
            </button>
          </div>
        </div>
      </main>
    );
  }

  const accent = (ev && ev.accent && ACCENT_CLASSES[ev.accent]) ? ACCENT_CLASSES[ev.accent] : ACCENT_CLASSES.blue;
  const questions = challenge.questions ?? [];
  const q = questions.length > current ? questions[current] : null;
  const progressPct = questions.length > 0 ? Math.round((answered / questions.length) * 100) : 0;
  const evidence = challenge.evidence ?? [];
  const currentEvidence =
    evidence.find((e) => e.id === activeEvidence) ?? evidence[0];
  const currentImage = currentEvidence
    ? EVIDENCE_URLS[currentEvidence.image] ?? currentEvidence.image
    : "";

  const submit = async () => {
    // Guard: prevent submitting with no answers at all.
    if (questions.length > 0 && answered === 0) {
      alert("You must answer at least one question before submitting. Unanswered questions are marked as incorrect.");
      return;
    }
    // Guard: warn when some questions are still unanswered — they will be
    // graded as incorrect (0 points).
    if (questions.length > 0 && answered < questions.length) {
      const okToSubmit = confirm(
        `You have answered ${answered} of ${questions.length} questions. Unanswered questions will be marked as incorrect. Submit anyway?`,
      );
      if (!okToSubmit) return;
    }
    const result = await submitChallengeApi(challenge.id, answers);
    if (result && result.success === false) {
      alert(result.message || "Submission failed. Please try again.");
      return;
    }
    const progress = getProgress();
    progress[challenge.id] = "completed";
    // Store the completed challenge slug for the review page
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("arena.lastCompletedChallengeSlug", challenge.id);
    }
    if (completedCount(progress) === CHALLENGES.length) {
      navigate({ to: "/competition-complete", replace: true });
    } else {
      navigate({ to: "/challenges", replace: true });
    }
  };

  const end = () => {
    if (confirm("End this challenge and return to selection?")) {
      navigate({ to: "/challenges", replace: true });
    }
  };

  const saveProgress = async () => {
    setSaveStatus("saving");
    const ok = await saveProgressApi(challenge.id, answers, current, Object.keys(answers));
    if (ok) {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } else {
      setSaveStatus("error");
    }
  };

  const viewPos = (e: React.PointerEvent<HTMLDivElement>) =>
    resolvePeekFocus(e.clientX, e.clientY, e.currentTarget);
  const startPeek = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (peekReleaseTimer.current !== null) {
      window.clearTimeout(peekReleaseTimer.current);
      peekReleaseTimer.current = null;
    }
    const p = viewPos(e);
    setPeek({ ...p, scale: 3 });
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const movePeek = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!peek) return;
    const p = viewPos(e);
    setPeek((prev) => (prev ? { ...p, scale: prev.scale } : prev));
  };
  const stopPeek = () => {
    if (peekReleaseTimer.current !== null) {
      window.clearTimeout(peekReleaseTimer.current);
      peekReleaseTimer.current = null;
    }
    setPeek(null);
  };
  const downloadEvidence = () => {
    if (!currentEvidence) return;
    const a = document.createElement("a");
    a.href = currentImage;
    a.download = currentEvidence.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const openFullscreen = () => setFullscreen(true);
  const selectEvidence = (id: string) => {
    setActiveEvidence(id);
  };


  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={end}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-[var(--surface)] px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Exit
            </button>
            <div className={`grid h-8 w-8 flex-none place-items-center rounded-md ${accent.bgSoft} ${accent.text} text-sm font-semibold`}>
              {challenge.number}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-semibold">{challenge.name}</h1>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${DIFFICULTY_BADGE[challenge.difficulty]}`}>
                  {challenge.difficulty}
                </span>
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {ev.college} • {ev.workshop}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-md border border-border bg-[var(--surface)] px-3 py-1.5 text-xs sm:flex">
              <Clock className={`h-3.5 w-3.5 ${accent.text}`} />
              <span className="font-mono font-semibold">{eventTimeLeft}</span>
            </div>
            <button
              onClick={end}
              className="inline-flex items-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/20"
            >
              <Flag className="h-3.5 w-3.5" /> End Challenge
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 px-6 py-6 lg:grid-cols-[260px_1fr_260px]">
        {/* Left sidebar */}
        <aside className="space-y-4">
          <Panel title="Challenge Brief">
            <p className="text-xs leading-relaxed text-muted-foreground">{challenge.brief}</p>
          </Panel>
          <Panel title="Resources">
            <ul className="space-y-1.5">
              {challenge.resources.map((r) => {
                const isActive = r.evidenceId && r.evidenceId === activeEvidence;
                return (
                  <li key={r.name}>
                    <button
                      type="button"
                      onClick={() => r.evidenceId && selectEvidence(r.evidenceId)}
                      className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition-colors ${isActive
                          ? `${accent.border} ${accent.bgSoft}`
                          : "border-border bg-[var(--surface)] hover:border-border/80"
                        }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText
                          className={`h-3.5 w-3.5 flex-none ${isActive ? accent.text : "text-muted-foreground"
                            }`}
                        />
                        <span className="truncate text-xs">{r.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{r.size}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel title="Hints">
            <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-[var(--surface)] px-2.5 py-2 text-xs text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5" />
              Hints disabled for this challenge
            </div>
          </Panel>
        </aside>

        {/* Center */}
        <ErrorBoundary label="Challenge Workspace">
        <section className="space-y-4">
          {evidence.length > 0 && currentEvidence ? (
            <Panel>
              {(() => {
                const textEntry =
                  EVIDENCE_TEXT[currentEvidence.id] ??
                  // Hardening: if the evidence image token has no bundled asset
                  // mapping, fall back to the backend-provided content_text so
                  // the tab never renders a broken image placeholder.
                  (currentEvidence.content_text &&
                  !EVIDENCE_URLS[currentEvidence.image] &&
                  ["txt", "json", "csv", "log"].includes(
                    String(currentEvidence.file_format || "").toLowerCase()
                  )
                    ? {
                        filename: currentEvidence.filename,
                        format: String(currentEvidence.file_format).toLowerCase() as
                          | "txt"
                          | "json"
                          | "csv"
                          | "log",
                        content: currentEvidence.content_text,
                      }
                    : undefined);
                return (
                  <>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Evidence Preview
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {textEntry
                            ? "Live text view — search, copy, wrap, and download."
                            : "Hold / pinch anywhere on the image to zoom in; release to zoom out."}
                        </p>
                      </div>
                      {!textEntry && (
                        <div className="flex items-center gap-1">
                          <IconBtn onClick={openFullscreen} title="Fullscreen">
                            <Maximize2 className="h-3.5 w-3.5" />
                          </IconBtn>
                          <IconBtn onClick={downloadEvidence} title="Download">
                            <Download className="h-3.5 w-3.5" />
                          </IconBtn>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 border-b border-border">
                      {evidence.map((e) => {
                        const isActive = e.id === activeEvidence;
                        return (
                          <button
                            key={e.id}
                            onClick={() => selectEvidence(e.id)}
                            className={`inline-flex items-center gap-2 rounded-t-md border-b-2 px-3 py-2 text-xs font-medium transition-colors ${isActive
                                ? `${accent.border.replace("border-", "border-b-")} ${accent.text}`
                                : "border-b-transparent text-muted-foreground hover:text-foreground"
                              }`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {e.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3">
                      {textEntry ? (
                        <EvidenceCodeViewer
                          key={currentEvidence.id}
                          filename={textEntry.filename}
                          format={textEntry.format}
                          content={textEntry.content}
                        />
                      ) : (
                        <div
                          className={`h-[520px] rounded-lg border border-border bg-[var(--surface)] ${
                            peek ? "overflow-hidden" : "overflow-auto"
                          }`}
                        >
                          <div
                          ref={inlineViewerRef}
                          onPointerDown={startPeek}
                          onPointerMove={movePeek}
                          onPointerUp={stopPeek}
                          onPointerCancel={stopPeek}
                          title="Press and hold to magnify · release to zoom back out"
                          className={`relative h-full w-full touch-none select-none overflow-hidden ${
                            peek ? "cursor-zoom-out" : "cursor-zoom-in"
                          }`}
                        >
                          <div
                            className="absolute inset-0 flex items-center justify-center p-4 will-change-transform"
                            style={peekStyle}
                          >
                            <img
                              src={currentImage}
                              alt={currentEvidence.label}
                              style={{
                                maxWidth: "100%",
                                maxHeight: "100%",
                              }}
                              className="rounded-md object-contain"
                            />
                          </div>
                        </div>
                      </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </Panel>
          ) : (
            <Panel>
              <div className="flex items-start gap-3">
                <AlertTriangle className={`mt-0.5 h-4 w-4 flex-none ${accent.text}`} />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Instructions
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Review the challenge brief and resources on the left. Answer each question
                    below, then submit when complete.
                  </p>
                </div>
              </div>
            </Panel>
          )}


          <Panel>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Questions
              </div>
              <div className="text-xs text-muted-foreground">
                {answered} / {questions.length} answered
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
              <div
                className={`h-full ${accent.bg} transition-all`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {q ? (
              <div className="mt-6">
                <div className="text-xs text-muted-foreground">
                  Question {current + 1} of {questions.length}
                </div>
                <h3 className="mt-1 text-base font-semibold">{q.prompt}</h3>

                {q.kind === "text" ? (
                  <textarea
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    placeholder="Type your answer..."
                    rows={4}
                    className="mt-3 w-full resize-none rounded-md border border-border bg-[var(--surface)] px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-blue-500/60"
                  />
                ) : (
                  <div className="mt-3 space-y-2">
                    {(q.options || []).map((opt) => {
                      const active = answers[q.id] === opt;
                      return (
                        <label
                          key={opt}
                          className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${active
                              ? `${accent.border} ${accent.bgSoft}`
                              : "border-border bg-[var(--surface)] hover:border-border/80"
                            }`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={active}
                            onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                            className="accent-blue-500"
                          />
                          {opt}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 rounded-md border border-dashed border-border bg-[var(--surface)] p-6 text-center text-sm text-muted-foreground">
                No active questions found for this challenge position.
              </div>
            )}
          </Panel>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <button
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-[var(--surface)] px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" /> Previous
            </button>
            <button
              onClick={saveProgress}
              className={`inline-flex items-center gap-2 rounded-md border border-border bg-[var(--surface)] px-4 py-2 text-sm font-medium transition-colors ${
                saveStatus === "saved"
                  ? "text-emerald-400 border-emerald-500/40"
                  : saveStatus === "saving"
                  ? "text-blue-400 animate-pulse border-blue-500/40"
                  : saveStatus === "error"
                  ? "text-rose-400 border-rose-500/40"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Save className="h-4 w-4" />{" "}
              {saveStatus === "saving"
                ? "Auto-saving..."
                : saveStatus === "saved"
                ? "Saved ✓"
                : saveStatus === "error"
                ? "Save Error (Retry)"
                : "Save Progress"}
            </button>
            {current < questions.length - 1 ? (
              <button
                onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
                className={`inline-flex items-center gap-2 rounded-md ${accent.bg} ${accent.hover} px-4 py-2 text-sm font-semibold text-white`}
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={submit}
                className={`inline-flex items-center gap-2 rounded-md ${accent.bg} ${accent.hover} px-4 py-2 text-sm font-semibold text-white`}
              >
                Submit Challenge <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>
        </ErrorBoundary>

        {/* Right sidebar */}
        <aside className="space-y-4">
          <Panel title="Timer">
            <div className="flex items-center gap-2">
              <Clock className={`h-4 w-4 ${accent.text}`} />
              <span className="font-mono text-2xl font-bold">{eventTimeLeft}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Event time remaining — shared across all challenges</div>
          </Panel>
          <Panel title="Total Score">
            <div className="flex items-center gap-2">
              <Trophy className={`h-4 w-4 ${accent.text}`} />
              <span className="text-2xl font-bold">{totalScore ?? 0}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Your total score across all challenges</div>
          </Panel>
          <Panel title="Challenge Progress">
            <div className="flex items-center gap-2">
              <Target className={`h-4 w-4 ${accent.text}`} />
              <span className="text-2xl font-bold">
                {answered}/{questions.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
              <div
                className={`h-full ${accent.bg} transition-all`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </Panel>
          <Panel title="Challenge Info">
            <dl className="space-y-1.5 text-xs">
              <Row k="Difficulty" v={challenge.difficulty} />
              <Row k="Event Window" v="2:30:00 (all challenges)" />
              <Row k="Max Points" v={String(challenge.points)} />
              <Row k="Questions" v={String(questions.length)} />
            </dl>
          </Panel>
        </aside>
      </div>

      {fullscreen && currentEvidence && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <FileText className={`h-4 w-4 ${accent.text}`} />
              <span className="font-semibold">{currentEvidence.label}</span>
              <span className="text-xs text-muted-foreground">{currentEvidence.filename}</span>
            </div>
            <div className="flex items-center gap-1">
              <IconBtn onClick={downloadEvidence} title="Download">
                <Download className="h-3.5 w-3.5" />
              </IconBtn>
              <button
                onClick={() => setFullscreen(false)}
                className="ml-2 rounded-md border border-border bg-[var(--surface)] px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
          </div>
          <div
            className={`flex-1 ${peek ? "overflow-hidden" : "overflow-auto"}`}
          >
            <div
              ref={fullscreenViewerRef}
              onPointerDown={startPeek}
              onPointerMove={movePeek}
              onPointerUp={stopPeek}
              onPointerCancel={stopPeek}
              title="Press and hold to magnify · release to zoom back out"
              className={`relative h-full w-full touch-none select-none overflow-hidden ${
                peek ? "cursor-zoom-out" : "cursor-zoom-in"
              }`}
            >
              <div
                className="absolute inset-0 flex items-center justify-center p-6 will-change-transform"
                style={peekStyle}
              >
                <img
                  src={currentImage}
                  alt={currentEvidence.label}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                  }}
                  className="rounded-md object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function useImageZoomWheel(
  onZoomStep: (e: WheelEvent, el: HTMLDivElement) => void,
  active = true
): React.RefObject<HTMLDivElement | null> {
  const onZoomStepRef = useRef(onZoomStep);
  onZoomStepRef.current = onZoomStep;
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    const handler = (e: WheelEvent) => onZoomStepRef.current(e, el);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [active]);
  return ref;
}

function IconBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-[var(--surface)] text-muted-foreground hover:text-foreground"
    >
      {children}
    </button>
  );
}


function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {title && (
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5 last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
