import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Calendar,
  HelpCircle,
  Users,
  Trophy,
  Settings,
  ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Blueteamers Arena" },
      { name: "description", content: "Manage events, students, and challenges from the Blueteamers Arena admin dashboard." },
      { property: "og:title", content: "Admin Dashboard — Blueteamers Arena" },
      { property: "og:description", content: "Manage events, students, and challenges from the Blueteamers Arena admin dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/admin/dashboard" },
  { title: "Events", icon: Calendar, href: "/admin/events" },
  { title: "Questions", icon: HelpCircle, href: "/admin/questions" },
  { title: "Participants", icon: Users, href: "/admin/participants" },
  { title: "Leaderboard", icon: Trophy, href: "/leaderboard" },
  { title: "Settings", icon: Settings, href: "/admin/settings" },
];

const stats = [
  { label: "Total Events", value: "12" },
  { label: "Participants", value: "486" },
  { label: "Active Events", value: "3" },
  { label: "Questions", value: "125" },
];

const recentEvents = [
  { event: "CBIT AI with SOC", college: "CBIT", participants: 84, status: "Live", date: "22 Jul 2026" },
  { event: "VNR Cyber Workshop", college: "VNR", participants: 62, status: "Completed", date: "20 Jul 2026" },
  { event: "ACE Engineering", college: "ACE", participants: 95, status: "Upcoming", date: "25 Jul 2026" },
];

const recentActivity = [
  "Rahul joined CBIT event",
  "New Event Created",
  "5 Challenges Completed",
  "Leaderboard Updated",
  "Anjali submitted Incident Zero",
  "CBIT event timer extended",
];

function AdminDashboard() {
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
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Back to Home
            </Link>
            <Link to="/admin/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Sign Out
            </Link>
          </div>
        </nav>
      </header>

      <div className="mx-auto flex max-w-7xl items-start gap-6 px-6 py-10">
        <aside className="sticky top-6 hidden w-60 shrink-0 rounded-xl border border-border bg-card p-4 lg:block">
          <div className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Menu
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.title}
                to={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-[var(--surface)] hover:text-foreground"
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage events, participants, and challenges.</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-5">
                <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
                <div className="mt-3 text-3xl font-bold">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Recent Events</h2>
                <button className="text-xs font-medium text-primary hover:text-[var(--primary-hover)]">
                  View All
                </button>
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-[var(--surface)] text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Event</th>
                      <th className="px-4 py-3 text-left font-medium">College</th>
                      <th className="px-4 py-3 text-right font-medium">Participants</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEvents.map((row) => (
                      <tr key={row.event} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-3 font-medium">{row.event}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.college}</td>
                        <td className="px-4 py-3 text-right">{row.participants}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{row.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold">Recent Activity</h2>
              <ul className="mt-4 space-y-3">
                {recentActivity.map((activity, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {activity}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "Live"
      ? "bg-emerald-500/10 text-emerald-400"
      : status === "Completed"
      ? "bg-primary/10 text-primary"
      : "bg-amber-500/10 text-amber-400";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {status}
    </span>
  );
}
