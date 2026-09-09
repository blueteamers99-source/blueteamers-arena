import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Home,
  Trophy,
  Target,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { studentAuthFetch } from "@/lib/auth";

export const Route = createFileRoute("/review")({
  component: Review,
  validateSearch: (search: Record<string, unknown>) => ({
    challenge: (search.challenge as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Review My Answers — Blueteamers Arena" },
      { name: "description", content: "Review your submitted answers for all challenges." },
      { property: "og:title", content: "Review My Answers — Blueteamers Arena" },
      { property: "og:description", content: "Review your submitted answers for all challenges." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

interface QuestionReview {
  question_id: string;
  position: number;
  question_text: string;
  category: string;
  difficulty: string;
  kind: string;
  options_json: string[];
  student_answer: string | number | null;
  correct_answer: string;
  correct_option_index: number | null;
  explanation: string | null;
  default_points: number;
  points_earned: number;
  is_correct: boolean;
  feedback_note: string;
}

interface ChallengeReview {
  challenge_number: number;
  challenge_name: string;
  challenge_slug: string;
  status: "completed" | "not_completed";
  score_earned: number;
  max_possible_score: number;
  is_passing: boolean;
  submitted_at: string | null;
  questions: QuestionReview[];
}

interface ReviewsData {
  challenges: ChallengeReview[];
}

function Review() {
  const { challenge: challengeSlug } = useSearch({ from: "/review" });
  const [reviewsData, setReviewsData] = useState<ReviewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollTargets = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    studentAuthFetch(`${API_BASE_URL}/challenges/reviews/`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch review data");
        }
        return res.json();
      })
      .then((data) => {
        if (data.success && data.data) {
          const challenges = data.data.challenges || [];
          setReviewsData({ challenges });
          if (challengeSlug) {
            setTimeout(() => {
              const el = scrollTargets.current[challengeSlug];
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 150);
          }
        } else {
          throw new Error(data.message || "No review data available");
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load review data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [challengeSlug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background px-6 py-12">
        <div className="mx-auto max-w-3xl flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          <p className="text-muted-foreground">Loading review data...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-4">
            <Link
              to="/competition-complete"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <span className="text-muted-foreground/40">•</span>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Home className="h-4 w-4" /> Back to Home
            </Link>
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">
            Review My Answers
          </h1>
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
            <AlertCircle className="h-5 w-5 flex-none text-amber-400" />
            <p className="text-sm text-amber-400">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!reviewsData) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            to="/competition-complete"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <span className="text-muted-foreground/40">•</span>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Home className="h-4 w-4" /> Back to Home
          </Link>
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight">
          Review My Answers
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your submitted answers for all challenges
        </p>

        {/* All Challenge Reviews */}
        <div className="mt-8 space-y-10">
          {reviewsData.challenges.length === 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
              <AlertCircle className="h-5 w-5 flex-none text-amber-400" />
              <p className="text-sm text-amber-400">
                No challenge reviews available yet.
              </p>
            </div>
          )}

          {reviewsData.challenges.map((ch) => (
            <section
              key={ch.challenge_slug}
              ref={(el) => {
                scrollTargets.current[ch.challenge_slug] = el;
              }}
              className="scroll-mt-24"
            >
              {/* Challenge Heading */}
              <div className="flex items-center justify-between gap-3 border-b-2 border-border pb-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-primary">
                    Challenge {ch.challenge_number}
                  </div>
                  <h2 className="mt-1 text-xl font-bold tracking-tight">
                    {ch.challenge_name}
                  </h2>
                </div>
                {ch.status === "not_completed" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" /> Not Completed
                  </span>
                ) : ch.is_passing ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Passing
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400">
                    <XCircle className="h-3.5 w-3.5" /> Not Passing
                  </span>
                )}
              </div>

              {ch.status === "not_completed" ? (
                <div className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                  This challenge has not been completed yet. Submit your answers
                  to unlock the review.
                </div>
              ) : (
                <>
                  {/* Score Summary */}
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Trophy className="h-4 w-4 text-emerald-400" />
                        Score
                      </div>
                      <div className="mt-2 text-2xl font-bold">
                        {ch.score_earned}/{ch.max_possible_score}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Target className="h-4 w-4 text-emerald-400" />
                        Percentage
                      </div>
                      <div className="mt-2 text-2xl font-bold">
                        {ch.max_possible_score > 0
                          ? Math.round((ch.score_earned / ch.max_possible_score) * 100)
                          : 0}
                        %
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {ch.is_passing ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-400" />
                        )}
                        Status
                      </div>
                      <div
                        className={`mt-2 text-2xl font-bold ${
                          ch.is_passing ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {ch.is_passing ? "Passing" : "Not Passing"}
                      </div>
                    </div>
                  </div>

                  {/* Questions */}
                  <div className="mt-6 space-y-4">
                    {ch.questions.map((q) => (
                      <QuestionCard key={q.question_id} question={q} />
                    ))}
                  </div>
                </>
              )}
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-10 flex justify-center">
          <Link
            to="/competition-complete"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
          >
            Back to Results
          </Link>
        </div>
      </div>
    </main>
  );
}

function QuestionCard({ question }: { question: QuestionReview }) {
  const isCorrect = question.is_correct;
  // Partial credit: points were awarded but the answer wasn't a full match.
  const isPartial = !isCorrect && question.points_earned > 0;

  const formatAnswer = (answer: string | number | null): string => {
    if (answer === null || answer === undefined) return "No answer";
    if (typeof answer === "number" && question.kind === "mcq") {
      return question.options_json[answer] || `Option ${answer}`;
    }
    return String(answer);
  };

  const formatCorrectAnswer = (q: QuestionReview): string => {
    if (q.kind === "mcq" && q.correct_option_index !== null) {
      return q.options_json[q.correct_option_index] || `Option ${q.correct_option_index}`;
    }
    return q.correct_answer || "N/A";
  };

  return (
    <div
      className={`rounded-xl border p-4 ${
        isCorrect
          ? "border-emerald-500/30 bg-emerald-500/5"
          : isPartial
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-rose-500/30 bg-rose-500/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Q{question.position}
            </span>
            <span className="text-xs text-muted-foreground/50">•</span>
            <span className="text-xs text-muted-foreground">
              {question.category}
            </span>
            <span className="text-xs text-muted-foreground/50">•</span>
            <span className="text-xs text-muted-foreground">
              {question.default_points} pts
            </span>
          </div>
          <p className="mt-2 text-sm font-medium">{question.question_text}</p>
        </div>
        <div className="flex items-center gap-1">
          {isCorrect ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : isPartial ? (
            <AlertCircle className="h-5 w-5 text-amber-400" />
          ) : (
            <XCircle className="h-5 w-5 text-rose-400" />
          )}
          <span
            className={`text-sm font-semibold ${
              isCorrect ? "text-emerald-400" : isPartial ? "text-amber-400" : "text-rose-400"
            }`}
          >
            {question.points_earned}/{question.default_points}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {/* Student's Answer */}
        <div
          className={`rounded-lg p-3 ${
            isCorrect
              ? "bg-emerald-500/10 border border-emerald-500/20"
              : "bg-rose-500/10 border border-rose-500/20"
          }`}
        >
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Your Answer
          </p>
          <p
            className={`text-sm ${
              isCorrect ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {formatAnswer(question.student_answer)}
          </p>
        </div>

        {/* Correct Answer (only shown if wrong) */}
        {!isCorrect && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Correct Answer
            </p>
            <p className="text-sm text-emerald-400">
              {formatCorrectAnswer(question)}
            </p>
          </div>
        )}

        {/* MCQ Options */}
        {question.kind === "mcq" && question.options_json.length > 0 && (
          <div className="mt-2 space-y-1">
            {question.options_json.map((opt, idx) => {
              const isStudentChoice =
                question.student_answer === idx;
              const isCorrectChoice =
                question.correct_option_index === idx;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    isCorrectChoice
                      ? "bg-emerald-500/10 border border-emerald-500/20"
                      : isStudentChoice && !isCorrect
                      ? "bg-rose-500/10 border border-rose-500/20"
                      : "bg-card border border-border"
                  }`}
                >
                  <span className="text-xs text-muted-foreground w-5">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <span className="flex-1">{opt}</span>
                  {isCorrectChoice && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  )}
                  {isStudentChoice && !isCorrect && (
                    <XCircle className="h-4 w-4 text-rose-400" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Feedback Note */}
        {question.feedback_note && (
          <p className="text-xs text-muted-foreground italic mt-2">
            {question.feedback_note}
          </p>
        )}

        {/* Explanation */}
        {question.explanation && (
          <div className="mt-2 rounded-lg bg-card border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Explanation
            </p>
            <p className="text-sm text-muted-foreground">
              {question.explanation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}