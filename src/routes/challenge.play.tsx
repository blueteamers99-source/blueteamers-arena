import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Clock,
  Download,
  FileText,
  Flag,
  Home,
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
  type Challenge,
} from "@/lib/mock-challenges";
import { API_BASE_URL } from "@/lib/config";
import evidenceEmail from "@/assets/evidence-email.png.asset.json";
import evidenceUrl from "@/assets/evidence-url.png.asset.json";
import evidenceWazuh from "@/assets/evidence-wazuh.png.asset.json";
import evidenceSyslog from "@/assets/evidence-syslog.png.asset.json";
import evidenceNetwork from "@/assets/evidence-network.png.asset.json";
import evidenceDiskSummary from "@/assets/evidence-disk-summary.png.asset.json";
import evidenceMemoryStrings from "@/assets/evidence-memory-strings.png.asset.json";
import evidenceTimeline from "@/assets/evidence-timeline.png.asset.json";
import evidenceNetworkCapture from "@/assets/evidence-network-capture.png.asset.json";
import { EVIDENCE_TEXT } from "@/lib/evidence-text";
import { EvidenceCodeViewer } from "@/components/EvidenceCodeViewer";

// Only true image evidence is rendered via <img>. TXT / JSON / CSV files
// are rendered as live text by <EvidenceCodeViewer>.
const EVIDENCE_URLS: Record<string, string> = {
  "/__EVIDENCE_EMAIL__": evidenceEmail.url,
  "/__EVIDENCE_URL__": evidenceUrl.url,
  "/__EVIDENCE_WAZUH__": evidenceWazuh.url,
  "/__EVIDENCE_SYSLOG__": evidenceSyslog.url,
  "/__EVIDENCE_NETWORK__": evidenceNetwork.url,
  "/__EVIDENCE_DISK_SUMMARY__": evidenceDiskSummary.url,
  "/__EVIDENCE_MEMORY_STRINGS__": evidenceMemoryStrings.url,
  "/__EVIDENCE_TIMELINE__": evidenceTimeline.url,
  "/__EVIDENCE_PCAP__": evidenceNetworkCapture.url,
};



export const Route = createFileRoute("/challenge/play")({
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
  const [ev, setEv] = useState<MockEvent | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [saved, setSaved] = useState(false);
  const [activeEvidence, setActiveEvidence] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement | null>(null);

  // SOC Investigation Lab state
  const [iocs, setIocs] = useState<string[]>(["198.51.100.42", "payroll-secure-verify.com"]);
  const [iocInput, setIocInput] = useState("");
  const [notes, setNotes] = useState("SOC Analyst Initial Assessment: Suspicious phishing attempt detected targeting finance department.");
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [studentScore, setStudentScore] = useState<number>(0);
  const [studentRank, setStudentRank] = useState<number>(1);
  const [studentName, setStudentName] = useState<string>("Security Analyst");

  useEffect(() => {
    // Fetch authenticated student status from PostgreSQL
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("student_access_token") : null;
    if (token) {
      fetch(`${API_BASE_URL}/dashboard/me/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((resData) => {
          const data = resData.data || resData;
          if (data && data.score !== undefined) {
            setStudentScore(data.score || 0);
            setStudentRank(data.rank || 1);
            if (data.name) setStudentName(data.name);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const activeId = getActive() || "phishnet";
    const selectedEv = getSelectedEvent();
    setEv(selectedEv);

    // Try fetching from Django REST API first
    fetch(`${API_BASE_URL}/challenges/${activeId}/`)
      .then((res) => {
        if (!res.ok) throw new Error("API detail fallback");
        return res.json();
      })
      .then((resData) => {
        const data = resData.data || resData;
        if (data && (data.name || data.title)) {
          const apiChallenge: Challenge = {
            id: data.slug || data.id || activeId,
            number: data.challenge_number || 1,
            name: data.name || data.title || "SOC Challenge",
            description: data.description || "",
            difficulty: data.difficulty || "Easy",
            duration: data.duration_minutes || data.duration || 20,
            points: data.points || 100,
            skills: data.skills || ["SOC Analysis"],
            objectives: data.objectives || ["Investigate incident"],
            brief: data.brief || data.description || "Analyze the evidence.",
            resources: data.resources || [],
            evidence: data.evidence || [],
            questions: (data.questions || []).map((q: any, i: number) => ({
              id: q.id || `q${i + 1}`,
              prompt: q.prompt || q.question_text || `Question ${i + 1}`,
              kind: q.kind || (q.options ? "mcq" : "text"),
              options: q.options || [],
            })),
          };
          setChallenge(apiChallenge);
          setRemaining((apiChallenge.duration || 20) * 60);
          if (apiChallenge.evidence?.length) setActiveEvidence(apiChallenge.evidence[0].id);
          return;
        }
        throw new Error("Invalid API format");
      })
      .catch(() => {
        const c = CHALLENGES.find((x) => x.id === activeId || x.slug === activeId) ?? CHALLENGES[0];
        setChallenge(c);
        setRemaining((c.duration || 20) * 60);
        if (c.evidence?.length) setActiveEvidence(c.evidence[0].id);
      });

    if (activeId && getProgress()[activeId] !== "completed") {
      setStatus(activeId, "in_progress");
    }
  }, []);

  useEffect(() => {
    if (!challenge) return;
    const id = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [challenge]);

  const questionsList = useMemo(() => challenge?.questions || [], [challenge]);

  const answered = useMemo(
    () => (challenge && questionsList.length ? questionsList.filter((q) => answers[q.id]?.trim()).length : 0),
    [answers, challenge, questionsList],
  );

  const accent = ACCENT_CLASSES[ev?.accent || "blue"] || ACCENT_CLASSES.blue;
  if (!challenge) return null;

  const q = questionsList[current] || questionsList[0] || { id: "q1", prompt: "Challenge Question", kind: "text" };
  const progressPct = questionsList.length ? Math.round((answered / questionsList.length) * 100) : 0;
  const evidence = challenge.evidence ?? [];
  const currentEvidence =
    evidence.find((e) => e.id === activeEvidence) ?? evidence[0];
  const currentImage = currentEvidence
    ? EVIDENCE_URLS[currentEvidence.image] ?? currentEvidence.image
    : "";

  const submit = async () => {
    try {
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("student_access_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const userEmail = typeof localStorage !== "undefined" ? localStorage.getItem("user_email") : null;

      const res = await fetch(`${API_BASE_URL}/submissions/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          challenge_id: challenge.id,
          answers: answers,
          email: userEmail,
        }),
      });
      const data = await res.json();
      if (data.data?.score_earned !== undefined || data.earned_score !== undefined) {
        const newScore = data.data?.total_participant_score ?? data.total_participant_score ?? data.score_earned;
        if (newScore !== undefined) {
          localStorage.setItem("user_score", String(newScore));
        }
      }
    } catch (e) {
      console.error("Submission API call completed fallback", e);
    }

    setStatus(challenge.id, "completed");
    const progress = getProgress();
    progress[challenge.id] = "completed";
    localStorage.setItem("certificate_unlocked", "true");
    navigate({ to: "/dashboard" });
  };

  const end = () => {
    if (confirm("End this challenge and return to selection?")) {
      navigate({ to: "/challenges" });
    }
  };

  const saveProgress = async () => {
    setSaved(true);
    try {
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("student_access_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const userEmail = typeof localStorage !== "undefined" ? localStorage.getItem("user_email") : null;
      await fetch(`${API_BASE_URL}/submissions/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          challenge_id: challenge.id,
          answers: answers,
          email: userEmail,
        }),
      });
    } catch (e) {}
    setTimeout(() => setSaved(false), 1500);
  };

  const zoomIn = () => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));
  const zoomReset = () => setZoom(1);
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
    setZoom(1);
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
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-[var(--surface)] px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Home className="h-3.5 w-3.5" /> Home
            </Link>
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
                {ev?.college || "CBIT"} • {ev?.workshop || "AI with SOC Workshop"}
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
          <Panel title="Incident Report">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground font-semibold">INCIDENT ID</span>
                <span className="font-mono font-bold text-amber-400">INC-2026-00452</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground font-semibold">PRIORITY</span>
                <span className="inline-flex rounded bg-red-500/20 px-1.5 py-0.5 font-bold text-red-400 text-[10px]">HIGH</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground font-semibold">REPORTED BY</span>
                <span className="text-foreground font-medium">Finance Dept</span>
              </div>
              <p className="pt-1 text-xs leading-relaxed text-muted-foreground">{challenge.brief}</p>
            </div>
          </Panel>

          <Panel title="Discovered IOCs">
            <div className="space-y-2">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={iocInput}
                  onChange={(e) => setIocInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && iocInput.trim()) {
                      setIocs((prev) => [...prev, iocInput.trim()]);
                      setIocInput("");
                    }
                  }}
                  placeholder="IP / Domain / Hash..."
                  className="w-full rounded-md border border-border bg-[var(--surface)] px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (iocInput.trim()) {
                      setIocs((prev) => [...prev, iocInput.trim()]);
                      setIocInput("");
                    }
                  }}
                  className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  +Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pt-1">
                {iocs.map((ioc, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                    {ioc}
                    <button onClick={() => setIocs((prev) => prev.filter((_, i) => i !== idx))} className="hover:text-red-400">×</button>
                  </span>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Investigation Notes">
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record investigation findings, timestamps, and evidence notes..."
              className="w-full resize-none rounded-md border border-border bg-[var(--surface)] p-2 text-xs text-foreground outline-none focus:border-primary"
            />
            <div className="mt-1 text-[10px] text-muted-foreground flex justify-between">
              <span>Auto-saved to session</span>
              <span>{notes.length} chars</span>
            </div>
          </Panel>

          <Panel title="SOC Cheatsheets & Docs">
            <ul className="space-y-1.5">
              {[
                { name: "MITRE ATT&CK Framework", url: "https://attack.mitre.org" },
                { name: "VirusTotal Intelligence", url: "https://virustotal.com" },
                { name: "AbuseIPDB Threat Lookup", url: "https://abuseipdb.com" },
                { name: "Wireshark Display Filters", url: "https://wiki.wireshark.org/DisplayFilters" },
                { name: "YARA Rule Reference", url: "https://yara.readthedocs.io" },
              ].map((r) => (
                <li key={r.name}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-between rounded-md border border-border bg-[var(--surface)] px-2.5 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-primary flex-none" />
                      <span className="truncate text-xs">{r.name}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">↗</span>
                  </a>
                </li>
              ))}
            </ul>
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
                            className={`inline-flex items-center gap-2 rounded-t-md border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                              isActive
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
                          <div className="flex h-full min-h-[420px] items-center justify-center p-4">
                            <img
                              src={currentImage}
                              alt={currentEvidence.label}
                              style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                              className="max-h-full max-w-full rounded-md object-contain"
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
                {answered} / {challenge.questions.length} answered
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
              <div
                className={`h-full ${accent.bg} transition-all`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="mt-6">
              <div className="text-xs text-muted-foreground">
                Question {current + 1} of {challenge.questions.length}
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
                  {q.options!.map((opt) => {
                    const active = answers[q.id] === opt;
                    return (
                      <label
                        key={opt}
                        className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
                          active
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
              className="inline-flex items-center gap-2 rounded-md border border-border bg-[var(--surface)] px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <Save className="h-4 w-4" /> {saved ? "Saved" : "Save Progress"}
            </button>
            {current < challenge.questions.length - 1 ? (
              <button
                onClick={() => setCurrent((c) => Math.min(challenge.questions.length - 1, c + 1))}
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
              <span className="text-2xl font-bold text-amber-400">{studentScore}</span>
              <span className="text-xs text-muted-foreground">/ {challenge.points}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">PostgreSQL verified total</div>
          </Panel>
          <Panel title="Live Leaderboard Rank">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-emerald-400" />
              <span className="text-2xl font-bold text-emerald-400">#{studentRank}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Real-time event position</div>
          </Panel>
          <Panel title="Challenge Progress">
            <div className="flex items-center gap-2">
              <Target className={`h-4 w-4 ${accent.text}`} />
              <span className="text-2xl font-bold">
                {answered}/{questionsList.length}
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
              <Row k="Analyst" v={studentName} />
              <Row k="Difficulty" v={challenge.difficulty} />
              <Row k="Duration" v={`${challenge.duration} min`} />
              <Row k="Max Points" v={String(challenge.points)} />
              <Row k="Questions" v={String(questionsList.length)} />
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
            <div className="flex h-full items-center justify-center">
              <img
                src={currentImage}
                alt={currentEvidence.label}
                style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                className="max-h-full max-w-full rounded-md object-contain"
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
