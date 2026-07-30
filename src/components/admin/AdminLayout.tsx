import { Link, useLocation } from "@tanstack/react-router";
import { useState, ReactNode } from "react";
import {
  LayoutDashboard,
  Calendar,
  HelpCircle,
  Users,
  Trophy,
  Settings,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  Home,
  LogOut,
} from "lucide-react";
import { isAdminLoggedIn, clearAdminAuth } from "@/lib/auth";
import { AdminPortalLogin } from "./AdminPortalLogin";

export type AdminNavItemId = "dashboard" | "events" | "questions" | "participants" | "leaderboard" | "settings";

interface AdminLayoutProps {
  children: ReactNode;
  activeId?: AdminNavItemId;
  onTabChange?: (tabId: string) => void;
  pageTitle?: string;
}

export const navItems = [
  { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard, href: "/admin/dashboard" },
  { id: "events" as const, label: "Events", icon: Calendar, href: "/admin/events" },
  { id: "questions" as const, label: "Questions", icon: HelpCircle, href: "/admin/questions" },
  { id: "participants" as const, label: "Participants", icon: Users, href: "/admin/participants" },
  { id: "leaderboard" as const, label: "Leaderboard", icon: Trophy, href: "/admin/dashboard?tab=leaderboard" },
  { id: "settings" as const, label: "Settings", icon: Settings, href: "/admin/settings" },
];

export function AdminLayout({ children, activeId, onTabChange, pageTitle }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isAuthed, setIsAuthed] = useState(() => isAdminLoggedIn());
  const location = useLocation();

  if (!isAuthed) {
    return <AdminPortalLogin onSuccess={() => setIsAuthed(true)} />;
  }

  const currentPath = location.pathname;
  const searchTab = new URLSearchParams(location.search).get("tab");

  const computedActiveId = activeId || (
    searchTab === "leaderboard" ? "leaderboard" :
    currentPath.includes("/admin/events") ? "events" :
    currentPath.includes("/admin/questions") ? "questions" :
    currentPath.includes("/admin/participants") ? "participants" :
    currentPath.includes("/admin/settings") ? "settings" :
    "dashboard"
  );

  const activeItemObj = navItems.find((item) => item.id === computedActiveId);
  const headingText = pageTitle || (computedActiveId === "dashboard" ? "Admin Dashboard" : activeItemObj?.label || "Admin Dashboard");

  const handleNavClick = (item: typeof navItems[number]) => {
    if ((item.id === "dashboard" || item.id === "leaderboard") && onTabChange) {
      onTabChange(item.id);
    }
  };

  const handleSignOut = () => {
    clearAdminAuth();
    setIsAuthed(false);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Background Glow Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(37,99,235,0.1),rgba(255,255,255,0))]" />

      {/* Flush Edge Sidebar (same as /dashboard) */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-40 bg-card border-r border-border/80 flex flex-col justify-between transition-all duration-300 ${
          collapsed ? "w-16 p-3" : "w-64 p-5"
        }`}
      >
        <div>
          {/* Sidebar Top Header with Brand & Collapse Button */}
          <div className="mb-6 flex items-center justify-between">
            {!collapsed ? (
              <Link to="/" className="group flex items-center gap-3 transition-opacity hover:opacity-80">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-card shadow-sm">
                  <span className="text-base font-bold text-primary">B</span>
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-extrabold tracking-wider text-foreground">BLUETEAMERS</div>
                  <div className="text-[10px] font-bold tracking-widest text-primary">ARENA</div>
                </div>
              </Link>
            ) : (
              <Link to="/" className="mx-auto flex items-center justify-center">
                <div className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card shadow-sm">
                  <span className="text-base font-bold text-primary">B</span>
                </div>
              </Link>
            )}

            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${
                collapsed ? "mt-2 mx-auto" : ""
              }`}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {/* Nav Items */}
          <nav className="mt-4">
            <ul className="space-y-1.5 font-medium text-sm">
              {navItems.map((item) => {
                const isActive = computedActiveId === item.id;
                const Icon = item.icon;

                if ((item.id === "dashboard" || item.id === "leaderboard") && onTabChange) {
                  return (
                    <li key={item.id}>
                      <button
                        title={collapsed ? item.label : undefined}
                        onClick={() => handleNavClick(item)}
                        className={`group w-full flex items-center gap-3 rounded-xl transition-all duration-200 cursor-pointer ${
                          collapsed ? "justify-center px-2 py-3" : "px-3.5 py-2.5"
                        } ${
                          isActive
                            ? "bg-primary/10 text-primary font-semibold shadow-sm"
                            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                        {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                      </button>
                    </li>
                  );
                }

                return (
                  <li key={item.id}>
                    <Link
                      to={item.href}
                      title={collapsed ? item.label : undefined}
                      className={`group w-full flex items-center gap-3 rounded-xl transition-all duration-200 cursor-pointer ${
                        collapsed ? "justify-center px-2 py-3" : "px-3.5 py-2.5"
                      } ${
                        isActive
                          ? "bg-primary/10 text-primary font-semibold shadow-sm"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                      {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="border-t border-border/60 pt-4 space-y-1">
          <Link
            to="/"
            title={collapsed ? "Back to Home" : undefined}
            className={`flex items-center gap-3 rounded-xl text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground ${
              collapsed ? "justify-center p-2.5" : "px-3.5 py-2.5"
            }`}
          >
            <Home className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Back to Home</span>}
          </Link>
          <button
            onClick={handleSignOut}
            title={collapsed ? "Sign Out" : undefined}
            className={`w-full flex items-center gap-3 rounded-xl text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 ${
              collapsed ? "justify-center p-2.5" : "px-3.5 py-2.5"
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area (Dynamic Margin based on sidebar state) */}
      <main className={`relative z-10 transition-all duration-300 ${collapsed ? "pl-16" : "pl-64"}`}>
        {/* Top Header Navigation Bar */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-card hover:text-foreground border border-border/60"
              title="Toggle sidebar"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{headingText}</h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">Admin portal</span>
          </div>
        </header>

        {/* Page Content Body */}
        <div className="p-6 lg:p-8 space-y-6 w-full max-w-[1600px]">
          {children}
        </div>
      </main>
    </div>
  );
}
