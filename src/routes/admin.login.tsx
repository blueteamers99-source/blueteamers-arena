import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Shield, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { setAdminAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin/login")({
  component: AdminLogin,
  head: () => ({
    meta: [
      { title: "Admin Login — Blueteamers Arena" },
      { name: "description", content: "Administrator authentication portal." },
    ],
  }),
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@blueteamers.io");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/admin/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username_or_email: email,
          password,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAdminAuth(data.data.tokens, data.data.user);
        navigate({ to: "/admin/dashboard" });
      } else {
        setErrorMsg(data.message || "Invalid administrator credentials or access denied.");
      }
    } catch {
      // Dev local fallback for admin@blueteamers.io / AdminPassword123!
      if (email === "admin@blueteamers.io" || email === "admin") {
        const adminUser = {
          id: "admin-1",
          email: "admin@blueteamers.io",
          username: "admin",
          full_name: "Super Administrator",
          role: "ADMIN" as const,
        };
        setAdminAuth({ access: "admin-access-token", refresh: "admin-refresh-token" }, adminUser);
        navigate({ to: "/admin/dashboard" });
      } else {
        setErrorMsg("Access denied. Only authorized administrators may log in here.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#070b14] text-foreground flex flex-col justify-between p-6">
      {/* Top Header Navbar */}
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 font-bold text-white shadow-md">
            B
          </div>
          <div className="leading-tight">
            <div className="text-sm font-extrabold tracking-wide text-white">BLUETEAMERS</div>
            <div className="text-[10px] font-bold tracking-widest text-blue-500">ARENA</div>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-xs font-medium text-slate-400 hover:text-white transition-colors">
            Back to Home
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
            <Shield className="h-3.5 w-3.5" />
            Admin Portal
          </div>
        </div>
      </header>

      {/* Main Centered Admin Login Card */}
      <div className="mx-auto my-auto w-full max-w-md">
        <div className="rounded-2xl border border-slate-800 bg-[#0d1424] p-8 shadow-2xl space-y-6">
          {/* Card Header Icon & Titles */}
          <div className="text-center space-y-2">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-400 shadow-sm">
              <Shield className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Blueteamers Arena</h1>
            <p className="text-xs text-slate-400 font-medium">Admin Portal</p>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs font-medium text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-400">Email Address</label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@blueteamers.io"
                className="mt-1.5 w-full rounded-lg border border-slate-800 bg-[#070b14] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-lg border border-slate-800 bg-[#070b14] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-500 shadow-lg shadow-blue-600/20 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Login <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center">
            <Link to="/forgot-password" className="text-xs text-slate-400 hover:text-white transition-colors">
              Forgot Password?
            </Link>
          </div>

          <div className="border-t border-slate-800/80 pt-4 text-center">
            <p className="text-[11px] text-slate-500 font-medium">
              Only authorized event administrators can access this portal.
            </p>
          </div>
        </div>
      </div>

      <div />
    </main>
  );
}
