import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Clock,
  Download,
  FileText,
  Flag,
  Lightbulb,
  Maximize2,
  RotateCcw,
  Save,
  Target,
  Trophy,
  ZoomIn,
  ZoomOut,
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
  fetchProgressApi,
  startChallengeApi,
  fetchChallengeDetailApi,
  type Challenge,
} from "@/lib/mock-challenges";
import evidenceEmail from "@/assets/evidence-email.png";
import evidenceUrl from "@/assets/evidence-url.png";
import evidenceWazuh from "@/assets/evidence-wazuh.png";
import evidenceSyslog from "@/assets/evidence-syslog.png";
import evidenceNetwork from "@/assets/evidence-network.png";
import evidenceDiskSummary from "@/assets/evidence-disk-summary.png";
import evidenceMemoryStrings from "@/assets/evidence-memory-strings.png";
import evidenceTimeline from "@/assets/evidence-timeline.png";
import evidenceNetworkCapture from "@/assets/evidence-network-capture.png";
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
};



export const Route = createFileRoute("/challenge/play")({
  validateSearch: (search: Record<string, unknown>): { challengeId?: string } => ({
    challengeId: (search.challengeId as string) || undefined,
  }),
  component: PlayPage,
  head: () => ({
    meta: [
      { title: "Challenge Workspace — Blueteamers Arena" },
      { name: "description", content: "SOC investigation workspace." },
      { property: "og:title", content: "Challenge Workspace — Blueteamers Arena" },
      { property: "og:description", content: "SOC investigation workspace." },
    ],
  }),
});

function formatTime(sec: number) {
  const h = Math.floor(sec / 3600).toString().padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function PlayPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const [ev, setEv] = useState<MockEvent | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [activeEvidence, setActiveEvidence] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const initialLoadedRef = useRef(false);
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
    setRemaining(localChallenge.duration * 60);
    if (localChallenge.evidence?.length) setActiveEvidence(localChallenge.evidence[0].id);
    setZoom(localChallenge.number === 5 ? 1.5 : 1);

    // 1. Fetch live challenge definition if available
    fetchChallengeDetailApi(activeId).then((serverChall) => {
      if (serverChall) {
        setChallenge(serverChall);
      }
    });

    // 2. Fetch server-authoritative progress and resume state
    startChallengeApi(activeId).then((progressState) => {
      if (progressState) {
        // Restore server-calculated remaining time
        if (typeof progressState.remaining_time_seconds === "number") {
          setRemaining(progressState.remaining_time_seconds);
        }

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
              restoredAnswers[k] = (v as any).answer_text || "";
            } else if (v !== undefined && v !== null) {
              restoredAnswers[k] = String(v);
            }
          }
        }

        if (Object.keys(restoredAnswers).length > 0) {
          setAnswers((prev) => ({ ...prev, ...restoredAnswers }));
        }

        // Restore question index
        if (typeof progressState.current_question_index === "number" && progressState.current_question_index >= 0) {
          setCurrent(progressState.current_question_index);
        }

        if (progressState.status) {
          setStatus(activeId, progressState.status === "completed" ? "completed" : "in_progress");
        }
      }
      initialLoadedRef.current = true;
    }).catch(() => {
      initialLoadedRef.current = true;
    });

    if (activeId && getProgress()[activeId] !== "completed") {
      setStatus(activeId, "in_progress");
    }
  }, [searchParams.challengeId]);

  // Server-authoritative timer countdown
  useEffect(() => {
    if (!challenge) return;
    const id = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [challenge]);

  // Debounced auto-save on answers or current question changes
  useEffect(() => {
    if (!initialLoadedRef.current || !challenge) return;
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
  }, [answers, current, challenge]);

  // Unload listener for emergency auto-save
  useEffect(() => {
    const handleUnload = () => {
      if (challenge && initialLoadedRef.current) {
        saveProgressApi(
          challenge.id,
          answersRef.current,
          currentRef.current,
          Object.keys(answersRef.current),
        );
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      handleUnload();
    };
  }, [challenge]);

  const answered = useMemo(
    () => (challenge && challenge.questions ? challenge.questions.filter((q) => answers[q.id]?.trim()).length : 0),
    [answers, challenge],
  );

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
    setStatus(challenge.id, "completed");
    await submitChallengeApi(challenge.id, answers);
    const progress = getProgress();
    progress[challenge.id] = "completed";
    if (completedCount(progress) === CHALLENGES.length) {
      navigate({ to: "/competition-complete" });
    } else {
      navigate({ to: "/challenges" });
    }
  };

  const end = () => {
    if (confirm("End this challenge and return to selection?")) {
      navigate({ to: "/challenges" });
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

  const zoomIn = () => setZoom((z) => Math.min(2.5, +(z + 0.25).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));
  const zoomReset = () => setZoom(challenge?.number === 5 ? 1.5 : 1);
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
    setZoom(challenge?.number === 5 ? 1.5 : 1);
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
              <span className="font-mono font-semibold">{formatTime(remaining)}</span>
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
        <section className="space-y-4">
          {evidence.length > 0 && currentEvidence ? (
            <Panel>
              {(() => {
                const textEntry = EVIDENCE_TEXT[currentEvidence.id];
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
                            : "Click a tab to inspect each evidence file."}
                        </p>
                      </div>
                      {!textEntry && (
                        <div className="flex items-center gap-1">
                          <IconBtn onClick={zoomOut} title="Zoom Out">
                            <ZoomOut className="h-3.5 w-3.5" />
                          </IconBtn>
                          <span className="w-10 text-center font-mono text-[11px] text-muted-foreground">
                            {Math.round(zoom * 100)}%
                          </span>
                          <IconBtn onClick={zoomIn} title="Zoom In">
                            <ZoomIn className="h-3.5 w-3.5" />
                          </IconBtn>
                          <IconBtn onClick={zoomReset} title="Reset Zoom">
                            <RotateCcw className="h-3.5 w-3.5" />
                          </IconBtn>
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
                          ref={viewerRef}
                          className="h-[520px] overflow-auto rounded-lg border border-border bg-[var(--surface)]"
                        >
                          <div 
                            className={`flex min-h-full min-w-full p-4 transition-all duration-200 ${
                              zoom > 1 ? "items-start justify-start" : "items-center justify-center"
                            }`}
                            style={{
                              width: zoom > 1 ? `${zoom * 100}%` : "100%",
                              height: zoom > 1 ? `${zoom * 100}%` : "100%",
                            }}
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

        {/* Right sidebar */}
        <aside className="space-y-4">
          <Panel title="Timer">
            <div className="flex items-center gap-2">
              <Clock className={`h-4 w-4 ${accent.text}`} />
              <span className="font-mono text-2xl font-bold">{formatTime(remaining)}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Time remaining</div>
          </Panel>
          <Panel title="Current Score">
            <div className="flex items-center gap-2">
              <Trophy className={`h-4 w-4 ${accent.text}`} />
              <span className="text-2xl font-bold">0</span>
              <span className="text-xs text-muted-foreground">/ {challenge.points}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Points available</div>
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
              <Row k="Duration" v={`${challenge.duration} min`} />
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
              <IconBtn onClick={zoomOut} title="Zoom Out">
                <ZoomOut className="h-3.5 w-3.5" />
              </IconBtn>
              <span className="w-10 text-center font-mono text-[11px] text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <IconBtn onClick={zoomIn} title="Zoom In">
                <ZoomIn className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn onClick={zoomReset} title="Reset Zoom">
                <RotateCcw className="h-3.5 w-3.5" />
              </IconBtn>
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
          <div className="flex-1 overflow-auto p-6">
            <div 
              className={`flex min-h-full min-w-full transition-all duration-200 ${
                zoom > 1 ? "items-start justify-start" : "items-center justify-center"
              }`}
              style={{
                width: zoom > 1 ? `${zoom * 100}%` : "100%",
                height: zoom > 1 ? `${zoom * 100}%` : "100%",
              }}
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
    </main>
  );
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
