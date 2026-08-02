import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, KeyRound, Loader2, AlertCircle, Check } from "lucide-react";
import { useValidateEventCode } from "@/hooks/useValidateEventCode";

export const Route = createFileRoute("/arena")({
  component: Arena,
  head: () => ({
    meta: [
      { title: "Enter Event Code — Blueteamers Arena" },
      { name: "description", content: "Enter your event code to join the Blueteamers Arena workshop." },
      { property: "og:title", content: "Enter Event Code — Blueteamers Arena" },
      { property: "og:description", content: "Enter your event code to join the Blueteamers Arena workshop." },
    ],
  }),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card">
              <span className="text-lg font-bold text-primary">B</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-wide">BLUETEAMERS</div>
              <div className="text-xs font-semibold tracking-widest text-primary">ARENA</div>
            </div>
          </Link>
          <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Back to Home
          </Link>
        </nav>
      </header>
      <div className="mx-auto flex max-w-7xl items-center justify-center px-6 py-16">
        {children}
      </div>
    </main>
  );
}

function Arena() {
  const [code, setCode] = useState(() => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("saved_event_code") || "";
    }
    return "";
  });
  const navigate = useNavigate();

  // Centralized Single Source of Truth Validation Hook
  const { loading, error, success, validateCode, reset } = useValidateEventCode();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    const res = await validateCode(code);
    if (res.success) {
      setTimeout(() => {
        navigate({ to: "/dashboard" });
      }, 500);
    }
  };

  return (
    <Shell>
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-8 shadow-2xl backdrop-blur-xl transition-all">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 border border-primary/20">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-foreground">Enter Event Code</h1>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Enter the event access code provided by your college coordinator
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                reset();
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                setCode(pasted.toUpperCase().trim());
                reset();
              }}
              placeholder="e.g. CBIT-3154 or JNTU-6227"
              disabled={loading || success}
              className="w-full rounded-xl border border-border/80 bg-background px-4 py-3 font-mono text-center text-lg font-bold tracking-widest text-primary uppercase placeholder:normal-case placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-inner transition-all"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive animate-in shake duration-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-400 animate-in fade-in duration-200">
              <Check className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>Event code verified! Entering Arena...</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || success || !code.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                Continue to Arena <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Don't have a code? Contact your college coordinator.
        </p>
      </div>
    </Shell>
  );
}
