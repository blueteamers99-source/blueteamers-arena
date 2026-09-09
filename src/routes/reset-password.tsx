import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: (search.token as string) || undefined,
  }),
  component: StudentResetPassword,
  head: () => ({
    meta: [{ title: "Reset Password — Blueteamers Arena" }],
  }),
});

function StudentResetPassword() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const token = searchParams.token;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Invalid or missing reset token. Please request a new password reset link.");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setSuccess(true);
      } else {
        setError(data.message || "Failed to reset password. The token may be invalid or expired.");
      }
    } catch {
      setError("Unable to connect to authentication service. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background relative flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Set New Password</h1>
          <p className="text-sm text-muted-foreground">
            Please enter and confirm your new account password.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/80 p-8 shadow-2xl backdrop-blur-xl space-y-6">
          {success ? (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto" />
              <h3 className="text-lg font-bold">Password Reset Complete</h3>
              <p className="text-xs text-muted-foreground">
                Your password has been updated. You can now log in with your new credentials.
              </p>
              <button
                onClick={() => navigate({ to: "/" })}
                className="w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground"
              >
                Proceed to Home
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 text-center font-medium">
                  {error}
                </div>
              )}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Password</label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-border/60 bg-background/80 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm New Password</label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-border/60 bg-background/80 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Update Password <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
