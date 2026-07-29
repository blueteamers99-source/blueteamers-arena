import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, ArrowRight, CheckCircle, AlertCircle, Loader2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  component: StudentForgotPassword,
  head: () => ({
    meta: [{ title: "Forgot Password — Blueteamers Arena" }],
  }),
});

function StudentForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/v1/auth/forgot-password/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSentSuccess(true);
    } catch {
      setSentSuccess(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background relative flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <Link to="/login" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Forgot Password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your registered email address to receive password reset instructions.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/80 p-8 shadow-2xl backdrop-blur-xl space-y-6">
          {sentSuccess ? (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto" />
              <h3 className="text-lg font-bold">Check Your Inbox</h3>
              <p className="text-xs text-muted-foreground">
                We have sent password reset instructions to <span className="font-semibold text-foreground">{email}</span>.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"
              >
                Return to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Registered Email</label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@college.ac.in"
                    className="w-full rounded-xl border border-border/60 bg-background/80 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send Reset Instructions <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
