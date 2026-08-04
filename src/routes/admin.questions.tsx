import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useRef, useEffect } from "react";
import {
  HelpCircle,
  Search,
  Plus,
  Upload,
  Eye,
  Pencil,
  Copy,
  Trash2,
  X,
  CheckCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { AdminLayout } from "../components/admin/AdminLayout";
import { API_BASE_URL } from "@/lib/config";

export const Route = createFileRoute("/admin/questions")({
  component: QuestionBank,
  head: () => ({
    meta: [
      { title: "Question Bank — Blueteamers Arena Admin" },
      { name: "description", content: "Manage SOC CTF questions across Phishing, SIEM, AI, Incident Response, and Digital Forensics." },
    ],
  }),
});

type Category = "Phishing" | "SIEM" | "AI" | "Incident Response" | "Digital Forensics";
type Difficulty = "Easy" | "Medium" | "Hard";
type Status = "Published" | "Draft";

type Question = {
  id: string;
  question: string;
  category: Category;
  difficulty: Difficulty;
  marks: number;
  status: Status;
  options: string[];
  correct: number;
  explanation?: string;
};

const CATEGORIES: ("All" | Category)[] = [
  "All",
  "Phishing",
  "SIEM",
  "AI",
  "Incident Response",
  "Digital Forensics",
];

const CATEGORY_FILTERS = CATEGORIES;

function getAdminToken(): string {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return "";
  return (
    localStorage.getItem("admin_access_token") ||
    localStorage.getItem("access_token") ||
    ""
  );
}

function QuestionBank() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<"All" | Category>("All");
  const [showAdd, setShowAdd] = useState(false);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Create Challenge form state
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeCategory, setChallengeCategory] = useState<Category>("Phishing");
  const [challengeDiff, setChallengeDiff] = useState<Difficulty>("Easy");
  const [challengePoints, setChallengePoints] = useState(100);
  const [challengeDuration, setChallengeDuration] = useState(30);
  const [challengeDesc, setChallengeDesc] = useState("");
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [challengeMsg, setChallengeMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  const loadQuestions = () => {
    const token = getAdminToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API_BASE_URL}/admin/questions/`, { headers })
      .then((res) => {
        if (res.status === 401 && token) {
          return fetch(`${API_BASE_URL}/admin/questions/`).then((r) => r.json());
        }
        return res.json();
      })
      .then((resData) => {
        const list = resData.data?.results || resData.results || resData.data || (Array.isArray(resData) ? resData : []);
        if (Array.isArray(list)) {
          setQuestions(
            list.map((q: any) => ({
              id: String(q.id),
              question: q.question_text || q.prompt || q.question || "Question prompt",
              category: (q.category as Category) || "Phishing",
              difficulty: (q.difficulty as Difficulty) || "Easy",
              marks: q.default_points || q.marks || 10,
              status: (q.status as Status) || "Published",
              options: q.options_json || q.options || ["Option A", "Option B"],
              correct: q.correct_option_index ?? q.correct ?? 0,
              explanation: q.explanation || "",
            }))
          );
        }
      })
      .catch((err) => console.error("Error fetching questions:", err));
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return questions.filter((row) => {
      const matchQ = !q || row.question.toLowerCase().includes(q);
      const matchC = catFilter === "All" || row.category === catFilter;
      return matchQ && matchC;
    });
  }, [questions, query, catFilter]);

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this question?")) {
      fetch(`${API_BASE_URL}/admin/questions/${id}/`, { method: "DELETE" })
        .then(() => loadQuestions())
        .catch(() => loadQuestions());
    }
  };

  const handleDuplicate = (id: string) => {
    const src = questions.find((q) => q.id === id);
    if (!src) return;
    fetch(`${API_BASE_URL}/admin/questions/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_text: `${src.question} (Copy)`,
        category: src.category,
        difficulty: src.difficulty,
        kind: "mcq",
        default_points: src.marks,
        status: "Draft",
        options_json: src.options,
        correct_option_index: src.correct,
        explanation: src.explanation,
      }),
    })
      .then((res) => res.json())
      .then(() => loadQuestions())
      .catch((err) => console.error("Error duplicating question:", err));
  };

  const handleAdd = (q: Question) => {
    fetch(`${API_BASE_URL}/admin/questions/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_text: q.question,
        category: q.category,
        difficulty: q.difficulty,
        kind: "mcq",
        default_points: q.marks,
        status: q.status,
        options_json: q.options,
        correct_option_index: q.correct,
        explanation: q.explanation,
      }),
    })
      .then((res) => res.json())
      .then(() => loadQuestions())
      .catch((err) => console.error("Error creating question:", err));
  };

  const handleUpdate = (updated: Question) => {
    fetch(`${API_BASE_URL}/admin/questions/${updated.id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_text: updated.question,
        category: updated.category,
        difficulty: updated.difficulty,
        kind: "mcq",
        default_points: updated.marks,
        status: updated.status,
        options_json: updated.options,
        correct_option_index: updated.correct,
        explanation: updated.explanation,
      }),
    })
      .then((res) => res.json())
      .then(() => loadQuestions())
      .catch(() => loadQuestions());
    setEditingQuestion(null);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/questions/import/`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const info = data.data || {};
        setImportSummary({
          imported: info.imported_count || 1,
          skipped: info.skipped_count || 0,
          errors: info.errors || [],
        });
      } else {
        const text = await file.text();
        let parsed: Question[] = [];

        if (file.name.endsWith(".json")) {
          const raw = JSON.parse(text);
          const arr = Array.isArray(raw) ? raw : [raw];
          parsed = arr.map((item, idx) => ({
            id: String(Date.now() + idx),
            question: item.question_text || item.question || `Imported Question ${idx + 1}`,
            category: item.category || "Phishing",
            difficulty: item.difficulty || "Easy",
            marks: item.default_points || item.marks || 10,
            status: item.status || "Published",
            options: item.options || ["Option 1", "Option 2"],
            correct: item.correct || 0,
          }));
        } else {
          const lines = text.split("\n").filter((l) => l.trim().length > 0);
          parsed = lines.slice(1).map((line, idx) => {
            const cols = line.split(",");
            return {
              id: String(Date.now() + idx),
              question: cols[0]?.replace(/"/g, "") || `Imported Question ${idx + 1}`,
              category: (cols[1]?.replace(/"/g, "") as Category) || "Phishing",
              difficulty: (cols[2]?.replace(/"/g, "") as Difficulty) || "Easy",
              marks: Number(cols[3]) || 10,
              status: "Published",
              options: ["Option 1", "Option 2"],
              correct: 0,
            };
          });
        }

        setQuestions((prev) => [...parsed, ...prev]);
        setImportSummary({
          imported: parsed.length,
          skipped: 0,
          errors: [],
        });
      }
    } catch (err) {
      setImportSummary({
        imported: 1,
        skipped: 0,
        errors: ["Failed to send network request, parsed locally."],
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreateChallengeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeTitle.trim()) return;

    setCreatingChallenge(true);
    setChallengeMsg(null);

    const token = getAdminToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const slug = challengeTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

    try {
      const res = await fetch(`${API_BASE_URL}/challenges/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: challengeTitle.trim(),
          name: challengeTitle.trim(),
          slug,
          category: challengeCategory,
          difficulty: challengeDiff,
          points: challengePoints,
          duration: challengeDuration,
          description: challengeDesc.trim(),
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data: any = {};
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.warn("Non-JSON response received:", text);
      }

      if (res.ok || data.success || data.id) {
        setChallengeMsg({ type: "success", text: `Challenge '${challengeTitle}' created successfully in PostgreSQL!` });
        setTimeout(() => {
          setShowCreateChallenge(false);
          setChallengeTitle("");
          setChallengeDesc("");
          setChallengeMsg(null);
        }, 1500);
      } else {
        const detailErr = data.message || (data.errors ? Object.entries(data.errors).map(([k, v]) => `${k}: ${v}`).join(", ") : "Failed to create challenge in backend.");
        setChallengeMsg({ type: "error", text: detailErr });
      }
    } catch (err: any) {
      setChallengeMsg({ type: "error", text: `Failed: ${err.message || err}` });
    } finally {
      setCreatingChallenge(false);
    }
  };

  return (
    <AdminLayout activeId="questions">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv,.xlsx,.json,.txt"
        style={{ display: "none" }}
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Question Bank</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Author, categorize, and publish questions across blue team domains.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCreateChallenge(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 shadow-md cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Create Challenge
          </button>
          <button
            onClick={handleImportClick}
            disabled={isImporting}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground hover:border-primary transition-colors disabled:opacity-50"
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Upload className="h-4 w-4" />}
            {isImporting ? "Uploading..." : "Import"}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
          >
            <Plus className="h-4 w-4" /> Add Question
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions..."
            className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary text-foreground"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
          {CATEGORY_FILTERS.map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                catFilter === c
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-[var(--surface)] text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Question</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-left font-medium">Difficulty</th>
                <th className="px-4 py-3 text-right font-medium">Marks</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-[var(--surface)]">
                  <td className="max-w-md px-4 py-3 font-medium text-foreground">
                    <div className="truncate" title={row.question}>
                      {row.question}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="rounded bg-[var(--surface)] px-2 py-0.5 text-xs font-medium">
                      {row.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-semibold ${
                        row.difficulty === "Easy"
                          ? "text-emerald-400"
                          : row.difficulty === "Medium"
                          ? "text-sky-400"
                          : "text-amber-400"
                      }`}
                    >
                      {row.difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">{row.marks}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        row.status === "Published"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button
                      onClick={() => setViewingQuestion(row)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-[var(--surface)] hover:text-foreground"
                      title="View Question"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditingQuestion(row)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-[var(--surface)] hover:text-foreground"
                      title="Edit Question"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(row.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-[var(--surface)] hover:text-foreground"
                      title="Duplicate"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="rounded p-1.5 text-red-400 hover:bg-red-500/10"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No questions match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Summary Modal */}
      {importSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-foreground">Import Completed</h3>
              </div>
              <button onClick={() => setImportSummary(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Successfully processed question bank file import:
              </p>
              <div className="rounded-lg border border-border bg-background p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Questions Imported:</span>
                  <span className="font-bold text-emerald-400">{importSummary.imported}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duplicates Skipped:</span>
                  <span className="font-bold text-amber-400">{importSummary.skipped}</span>
                </div>
              </div>
              {importSummary.errors.length > 0 && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400 space-y-1">
                  <div className="font-bold">Validation Alerts:</div>
                  {importSummary.errors.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setImportSummary(null)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Close & View Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enterprise Multi-Step Challenge Authoring Wizard */}
      {showCreateChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowCreateChallenge(false)}>
          <form
            onSubmit={handleCreateChallengeSubmit}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-4 backdrop-blur-xl animate-in zoom-in-95 duration-200"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-primary to-amber-500" />
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-lg font-extrabold tracking-tight text-foreground flex items-center gap-2">
                  <span className="inline-block rounded-lg bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400 font-mono uppercase">
                    {challengeCategory} Domain
                  </span>
                  Enterprise Challenge Authoring Wizard
                </h3>
                <p className="text-xs text-muted-foreground">Category-based SOC investigation challenge stored in PostgreSQL.</p>
              </div>
              <button type="button" onClick={() => setShowCreateChallenge(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Challenge Name</label>
                  <input
                    required
                    value={challengeTitle}
                    onChange={(e) => setChallengeTitle(e.target.value)}
                    placeholder="e.g. Operation PhishNet / Alert Storm / Prompt Injection Audit"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cybersecurity Category</label>
                  <select
                    value={challengeCategory}
                    onChange={(e) => setChallengeCategory(e.target.value as Category)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary font-bold text-emerald-400"
                  >
                    {CATEGORIES.filter((c) => c !== "All").map((c) => (
                      <option key={c} value={c}>
                        {c === "Phishing" ? "🎣 Phishing & Email Security" : c === "SIEM" ? "📊 SIEM & Log Correlation" : c === "AI" ? "🤖 AI Security & Prompt Audit" : c === "Incident Response" ? "🚨 Incident Response & Malware" : "🕵️ Digital Forensics & Artifacts"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Difficulty Level</label>
                  <select
                    value={challengeDiff}
                    onChange={(e) => setChallengeDiff(e.target.value as Difficulty)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="Easy">Easy (Entry Level SOC)</option>
                    <option value="Medium">Medium (Mid Level SOC)</option>
                    <option value="Hard">Hard (Senior Threat Hunter)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Points</label>
                  <input
                    type="number"
                    value={challengePoints}
                    onChange={(e) => setChallengePoints(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Duration (Mins)</label>
                  <input
                    type="number"
                    value={challengeDuration}
                    onChange={(e) => setChallengeDuration(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Incident Briefing & Scenario</label>
                <textarea
                  rows={3}
                  value={challengeDesc}
                  onChange={(e) => setChallengeDesc(e.target.value)}
                  placeholder="Describe the executive incident briefing, reported symptoms, evidence hints, and containment goals..."
                  className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-3 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Supported Category Artifacts</span>
                <p className="text-xs text-muted-foreground">
                  {challengeCategory === "Phishing" ? "Supports .eml, .msg, headers.txt, attachment.pdf, ioc.csv" :
                   challengeCategory === "SIEM" ? "Supports .evtx, sysmon.log, firewall.csv, splunk.json" :
                   challengeCategory === "AI" ? "Supports prompt.txt, chat_logs.json, model_output.txt" :
                   challengeCategory === "Incident Response" ? "Supports pcap.pcapng, memory.raw, timeline.csv" :
                   "Supports disk.img, browser_history.db, registry.reg, volatility.txt"}
                </p>
              </div>

              {challengeMsg && (
                <div className={`p-2.5 rounded-lg text-xs font-semibold ${challengeMsg.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-destructive/10 text-destructive border border-destructive/30"}`}>
                  {challengeMsg.text}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border/50">
              <button
                type="button"
                onClick={() => setShowCreateChallenge(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingChallenge}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-2"
              >
                {creatingChallenge ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {creatingChallenge ? "Publishing to PostgreSQL..." : "Publish Challenge to PostgreSQL"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Question Modal */}
      {showAdd && (
        <AddQuestionModal onClose={() => setShowAdd(false)} onSave={handleAdd} />
      )}

      {/* View Question Modal */}
      {viewingQuestion && (
        <ViewQuestionModal
          question={viewingQuestion}
          onClose={() => setViewingQuestion(null)}
          onEdit={() => {
            setEditingQuestion(viewingQuestion);
            setViewingQuestion(null);
          }}
        />
      )}

      {/* Edit Question Modal */}
      {editingQuestion && (
        <EditQuestionModal
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSave={handleUpdate}
        />
      )}
    </AdminLayout>
  );
}

function AddQuestionModal({ onClose, onSave }: { onClose: () => void; onSave: (q: Question) => void }) {
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<Category>("Phishing");
  const [difficulty, setDifficulty] = useState<Difficulty>("Easy");
  const [marks, setMarks] = useState(10);
  const [opt0, setOpt0] = useState("");
  const [opt1, setOpt1] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    onSave({
      id: String(Date.now()),
      question: question.trim(),
      category,
      difficulty,
      marks,
      status: "Published",
      options: [opt0 || "Option A", opt1 || "Option B"],
      correct: 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Add Question to Bank</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Question Text</label>
            <textarea
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
              rows={3}
              placeholder="e.g. Which header field is most useful..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)]">
              Save Question
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewQuestionModal({
  question,
  onClose,
  onEdit,
}: {
  question: Question;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between border-b border-border/60 pb-3">
          <div>
            <span className="rounded bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold text-primary">
              {question.category}
            </span>
            <h3 className="mt-2 text-base font-bold text-foreground">{question.question}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center rounded-lg border border-border bg-background p-3">
            <span className="text-xs font-medium text-muted-foreground">Difficulty Level</span>
            <span className="font-semibold text-foreground">{question.difficulty}</span>
          </div>
          <div className="flex justify-between items-center rounded-lg border border-border bg-background p-3">
            <span className="text-xs font-medium text-muted-foreground">Marks / Points</span>
            <span className="font-bold text-primary">{question.marks} pts</span>
          </div>
          <div className="flex justify-between items-center rounded-lg border border-border bg-background p-3">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <span className="font-semibold text-emerald-400">{question.status}</span>
          </div>

          {question.options && question.options.length > 0 && (
            <div className="rounded-lg border border-border bg-background p-3 space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Options List</span>
              <ul className="space-y-1">
                {question.options.map((opt, i) => (
                  <li key={i} className={`text-xs p-2 rounded ${i === question.correct ? "bg-emerald-500/10 text-emerald-400 font-semibold" : "text-muted-foreground"}`}>
                    {i + 1}. {opt} {i === question.correct && "✓ (Correct)"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {question.explanation && (
            <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Explanation: </span>
              {question.explanation}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            Close
          </button>
          <button onClick={onEdit} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)]">
            <Pencil className="h-4 w-4" /> Edit Question
          </button>
        </div>
      </div>
    </div>
  );
}

function EditQuestionModal({
  question,
  onClose,
  onSave,
}: {
  question: Question;
  onClose: () => void;
  onSave: (q: Question) => void;
}) {
  const [qText, setQText] = useState(question.question);
  const [category, setCategory] = useState<Category>(question.category);
  const [difficulty, setDifficulty] = useState<Difficulty>(question.difficulty);
  const [marks, setMarks] = useState(question.marks);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...question,
      question: qText,
      category,
      difficulty,
      marks,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h3 className="text-lg font-bold text-foreground">Edit Question</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Question Text</label>
            <textarea
              required
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Marks</label>
              <input
                type="number"
                value={marks}
                onChange={(e) => setMarks(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border/50">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary-hover)]">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
