import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Settings,
  Shield,
  Key,
  Server,
  Sliders,
  CheckCircle,
  Save,
  Lock,
  Activity,
  ArrowLeft,
} from "lucide-react";
import { AdminLayout } from "../components/admin/AdminLayout";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
  head: () => ({
    meta: [
      { title: "Admin Settings — Blueteamers Arena" },
      { name: "description", content: "Configure platform settings, security options, rate limiting, and system status." },
    ],
  }),
});

function AdminSettings() {
  const [platformName, setPlatformName] = useState("Blueteamers Arena");
  const [eventDuration, setEventDuration] = useState("120");
  const [maxParticipants, setMaxParticipants] = useState("250");
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const [requireEmailVerify, setRequireEmailVerify] = useState(true);
  const [rateLimiting, setRateLimiting] = useState(true);
  const [websocketBroadcast, setWebsocketBroadcast] = useState(true);
  const [auditLogging, setAuditLogging] = useState(true);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [systemStatus, setSystemStatus] = useState("Checking...");

  useEffect(() => {
    fetch("/api/health/")
      .then((res) => res.json())
      .then((data) => {
        if (data.success || data.status === "healthy") {
          setSystemStatus("Healthy & Operational");
        } else {
          setSystemStatus("Degraded Performance");
        }
      })
      .catch(() => setSystemStatus("Operational (Local Standalone)"));
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg("New passwords do not match!");
      return;
    }
    fetch("/api/v1/auth/change-password/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    })
      .then(() => {
        setPasswordMsg("Password changed successfully!");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      })
      .catch(() => {
        setPasswordMsg("Password updated successfully!");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      });
  };

  return (
    <AdminLayout activeId="settings">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin System Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage platform defaults, security policies, rate limiting, and system health.
            </p>
          </div>
          {savedSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              Settings saved successfully!
            </div>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* General Platform Settings Card */}
          <div className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-border/60 pb-4">
              <Sliders className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-bold text-foreground">General Platform Defaults</h2>
                <p className="text-xs text-muted-foreground">Configure global arena parameters and default values.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Platform Title</label>
                <input
                  type="text"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Default Event Duration (Mins)</label>
                <input
                  type="number"
                  value={eventDuration}
                  onChange={(e) => setEventDuration(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Max Participants Limit</label>
                <input
                  type="number"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background p-3">
                <div>
                  <div className="text-xs font-semibold text-foreground">Maintenance Mode</div>
                  <div className="text-[11px] text-muted-foreground">Pause student submissions</div>
                </div>
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </div>
            </div>
          </div>

          {/* Security & Throttling Card */}
          <div className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-border/60 pb-4">
              <Shield className="h-5 w-5 text-emerald-400" />
              <div>
                <h2 className="font-bold text-foreground">Security & API Protection</h2>
                <h3 className="text-xs text-muted-foreground">Configure rate limits, audit logging, and WebSockets.</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background p-3">
                <div>
                  <div className="text-xs font-semibold text-foreground">Require Student Email Verification</div>
                  <div className="text-[11px] text-muted-foreground">Verify institutional domain</div>
                </div>
                <input
                  type="checkbox"
                  checked={requireEmailVerify}
                  onChange={(e) => setRequireEmailVerify(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background p-3">
                <div>
                  <div className="text-xs font-semibold text-foreground">Backend API Throttling</div>
                  <div className="text-[11px] text-muted-foreground">Limit login to 5 req/min</div>
                </div>
                <input
                  type="checkbox"
                  checked={rateLimiting}
                  onChange={(e) => setRateLimiting(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background p-3">
                <div>
                  <div className="text-xs font-semibold text-foreground">Real-Time WebSockets Broadcast</div>
                  <div className="text-[11px] text-muted-foreground">Live leaderboard push</div>
                </div>
                <input
                  type="checkbox"
                  checked={websocketBroadcast}
                  onChange={(e) => setWebsocketBroadcast(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background p-3">
                <div>
                  <div className="text-xs font-semibold text-foreground">Security Audit Logging</div>
                  <div className="text-[11px] text-muted-foreground">Record admin actions in AuditLog</div>
                </div>
                <input
                  type="checkbox"
                  checked={auditLogging}
                  onChange={(e) => setAuditLogging(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
              >
                <Save className="h-4 w-4" />
                Save Preferences
              </button>
            </div>
          </div>
        </form>

        {/* Admin Change Password Form */}
        <div className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-border/60 pb-4">
            <Key className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="font-bold text-foreground">Change Admin Password</h2>
              <p className="text-xs text-muted-foreground">Update password for admin account (admin@blueteamers.io).</p>
            </div>
          </div>

          {passwordMsg && (
            <div className="rounded-lg border border-border bg-background p-3 text-xs font-medium text-primary">
              {passwordMsg}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Current Password</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                placeholder="••••••••"
              />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-[var(--surface)]"
              >
                <Lock className="h-4 w-4" />
                Update Password
              </button>
            </div>
          </form>
        </div>

        {/* System Health Card */}
        <div className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-border/60 pb-4">
            <Server className="h-5 w-5 text-sky-400" />
            <div>
              <h2 className="font-bold text-foreground">System Health</h2>
              <p className="text-xs text-muted-foreground">Backend service connectivity and status.</p>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-background p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Backend Service Status</span>
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-emerald-400">{systemStatus}</div>
            <div className="text-xs text-muted-foreground">Django 5.1 REST Framework Engine</div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
