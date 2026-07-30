import { useState } from "react";
import { Shield, ArrowRight, Loader2 } from "lucide-react";
import { setAdminAuth } from "@/lib/auth";

interface AdminPortalLoginProps {
  onSuccess?: () => void;
}

export function AdminPortalLogin({ onSuccess }: AdminPortalLoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const userLoginName = username.trim() || "Admin";

    // Set admin auth session for any username and password
    const adminUser = {
      id: `admin-${Date.now()}`,
      email: `${userLoginName.toLowerCase()}@blueteamers.io`,
      username: userLoginName,
      full_name: userLoginName,
      role: "ADMIN" as const,
    };

    setAdminAuth({ access: "admin-access-token", refresh: "admin-refresh-token" }, adminUser);

    setTimeout(() => {
      setLoading(false);
      if (onSuccess) {
        onSuccess();
      } else {
        window.location.href = "/admin/dashboard";
      }
    }, 200);
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
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
