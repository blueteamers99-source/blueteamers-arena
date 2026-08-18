import { useState } from "react";
import { Shield, ArrowRight, Loader2 } from "lucide-react";
import { setAdminAuth } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/config";

interface AdminPortalLoginProps {
  onSuccess?: () => void;
}

export function AdminPortalLogin({ onSuccess }: AdminPortalLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const loginInput = username.trim();
    if (!loginInput || !password) {
      setError("Please enter both username/email and password.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/admin/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username_or_email: loginInput,
          password: password,
        }),
      });

      const resData = await res.json();
      if (res.ok && resData.success && resData.data?.tokens) {
        const { tokens, user } = resData.data;
        setAdminAuth(tokens, {
          id: user.id,
          email: user.email,
          username: user.username,
          full_name: user.full_name,
          role: "ADMIN",
        });
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.href = "/admin/dashboard";
        }
      } else {
        setError(resData.message || "Invalid credentials.");
      }
    } catch {
      setError("Unable to connect to authentication service.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-sm">
              <Shield className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Admin Portal</h1>
            <p className="text-xs text-muted-foreground">Blueteamers Arena Administrator Access</p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 text-center font-medium">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Username or Email</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin@blueteamers.io"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-[var(--primary-hover)] shadow-md disabled:opacity-50 mt-2 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Sign In to Admin Portal <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
