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

export const Route = createFileRoute("/admin/questions")({
  component: AdminQuestions,
  head: () => ({
    meta: [
      { title: "Question Bank — Blueteamers Arena Admin" },
      { name: "description", content: "Manage the question bank across phishing, SIEM, AI, incident response, and digital forensics." },
    ],
  }),
});

type Category = "Phishing" | "SIEM" | "AI" | "Incident Response" | "Digital Forensics";
type Difficulty = "Easy" | "Medium" | "Hard";
type Status = "Published" | "Draft";

type Question = {
  id: string;
  question: string;
  evidence?: string;
  category: Category;
  difficulty: Difficulty;
  marks: number;
  status: Status;
  options: string[];
  correct: number;
  explanation?: string;
};

const CATEGORIES: Category[] = ["Phishing", "SIEM", "AI", "Incident Response", "Digital Forensics"];

const seed: Question[] = [
  {
    id: "1",
    question: "Which header field is most useful to verify the true sender of an email?",
    category: "Phishing",
    difficulty: "Easy",
    marks: 10,
    status: "Published",
    options: ["From", "Reply-To", "Return-Path", "Subject"],
    correct: 2,
    explanation: "Return-Path shows the actual envelope sender used for bounces.",
  },
  {
    id: "2",
    question: "In Wazuh, which rule level typically indicates a critical security alert?",
    category: "SIEM",
    difficulty: "Medium",
    marks: 15,
    status: "Published",
    options: ["Level 3", "Level 7", "Level 12", "Level 15"],
    correct: 3,
  },
  {
    id: "3",
    question: "What is the primary risk of blindly trusting an AI-generated incident summary?",
    category: "AI",
    difficulty: "Medium",
    marks: 15,
    status: "Draft",
    options: ["Slower triage", "Hallucinated indicators", "Higher CPU usage", "Lower cost"],
    correct: 1,
  },
  {
    id: "4",
    question: "Which NIST IR phase includes evidence preservation and root cause analysis?",
    category: "Incident Response",
    difficulty: "Hard",
    marks: 25,
    status: "Published",
    options: ["Preparation", "Detection", "Containment, Eradication & Recovery", "Post-Incident Activity"],
    correct: 2,
  },
  {
    id: "5",
    question: "Which artifact best proves execution of a binary on a Windows host?",
    category: "Digital Forensics",
    difficulty: "Hard",
    marks: 20,
    status: "Published",
    options: ["Prefetch", "MFT", "Recycle Bin", "Event ID 4624"],
    correct: 0,
  },
  {
    id: "6",
    question: "A URL uses punycode 'xn--pple-43d.com'. What technique is this?",
    category: "Phishing",
    difficulty: "Medium",
    marks: 15,
    status: "Published",
    options: ["Typosquatting", "Homograph attack", "Open redirect", "Clickjacking"],
    correct: 1,
  },
];

const CATEGORY_FILTERS: ("All" | Category)[] = ["All", ...CATEGORIES];

function AdminQuestions() {
  const [questions, setQuestions] = useState<Question[]>(seed);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<"All" | Category>("All");
  const [showAdd, setShowAdd] = useState(false);
  const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  useEffect(() => {
    fetch("/api/v1/admin/questions/")
      .then((res) => res.json())
      .then((resData) => {
        if (resData && (resData.success || resData.results)) {
          const list = resData.data?.results || resData.results || resData.data;
          if (Array.isArray(list) && list.length > 0) {
            setQuestions(
              list.map((q: any) => ({
                id: String(q.id),
                question: q.question_text || q.question || "Question prompt",
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
        }
      })
      .catch(() => {});
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
      fetch(`/api/v1/admin/questions/${id}/`, { method: "DELETE" }).catch(() => {});
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    }
  };

  const handleDuplicate = (id: string) => {
    setQuestions((prev) => {
      const src = prev.find((q) => q.id === id);
      if (!src) return prev;
      const dup: Question = { ...src, id: `${Date.now()}`, question: `${src.question} (Copy)`, status: "Draft" };
      fetch("/api/v1/admin/questions/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dup),
      }).catch(() => {});
      return [dup, ...prev];
    });
  };

  const handleAdd = (q: Question) => {
    fetch("/api/v1/admin/questions/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_text: q.question,
        category: q.category,
        difficulty: q.difficulty,
        default_points: q.marks,
        status: q.status,
        options_json: q.options,
        correct_option_index: q.correct,
        explanation: q.explanation,
      }),
    }).catch(() => {});
    setQuestions((prev) => [q, ...prev]);
  };

  const handleUpdate = (updated: Question) => {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
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
      const res = await fetch("/api/v1/admin/questions/import/", {
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
