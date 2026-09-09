import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, AlertCircle, Award, CheckCircle2, Trophy, Building2, Calendar, FileText } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { getAuthToken } from "@/lib/mock-challenges";

export const Route = createFileRoute("/verify")({
  component: VerifyPage,
  validateSearch: (search: Record<string, unknown>) => ({
    id: (search.id as string) || "",
  }),
});

function VerifyPage() {
  const search = useSearch({ from: "/verify" });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const verificationId = search.id || "CERT-BLUETEAM-SYSTEM";

  useEffect(() => {
    if (!verificationId) {
      setLoading(false);
      return;
    }

    const token = getAuthToken();
    fetch(`${API_BASE_URL}/certificate/verify/${verificationId}/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        const resData = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
          setNeedsAuth(true);
          setError(resData.message || "Please log in or re-enter your event code to view this certificate.");
        } else if (resData.verified) {
          setData(resData);
        } else {
          setError(resData.message || "This certificate was not issued by Blueteamers Arena.");
        }
      })
      .catch((err) => setError("Failed to verify credential. Please try again."))
      .finally(() => setLoading(false));
  }, [verificationId]);

  const handleDownload = async () => {
    if (!data?.verification_id || downloading) return;
    setDownloading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/certificate/download/${data.verification_id}/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message || "Certificate download failed. Please re-enter your event code and try again.");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `certificate_${data.verification_id}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Certificate download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl rounded-2xl border border-border/80 bg-card p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Blueteamers Arena</h1>
              <p className="text-xs text-muted-foreground">Official Credential Verification Portal</p>
            </div>
          </div>
          {data?.verified && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
              <ShieldCheck className="h-4 w-4" /> VERIFIED
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
            Verifying certificate signature in PostgreSQL...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center space-y-2">
            <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
            <h2 className="text-base font-bold text-destructive">Invalid Certificate</h2>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Credential Holder</span>
              <h2 className="text-2xl font-extrabold text-primary">{data.name}</h2>
              <p className="text-xs text-muted-foreground">{data.college}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/60 bg-[var(--surface)] p-4 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground">Event / Workshop</span>
                <p className="font-bold text-foreground">{data.event}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">Final Score</span>
                <p className="font-bold text-emerald-400">{data.score} PTS (Rank #{data.rank})</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">Verification ID</span>
                <p className="font-mono font-bold text-amber-400">{data.verification_id}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">Issued Date</span>
                <p className="font-bold text-foreground">{data.issued_date}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p className="font-bold text-foreground">{data.issuer}</p>
                <p>Digitally Signed & Validated via PostgreSQL</p>
              </div>
              {data.qr_code_url && (
                <img src={data.qr_code_url} alt="QR Code" className="h-16 w-16 rounded border border-border" />
              )}
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary/90 transition-all disabled:opacity-60"
              >
                {downloading ? "Preparing certificate..." : "🎓 Download Official High-Res Vector PDF Certificate"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
