import { Link, useNavigate } from "@tanstack/react-router";

const navLinks = [
  { label: "Dashboard", to: "/dashboard" as const },
  { label: "Events", to: "/stuevents" as const },
  { label: "Challenges", to: "/challenges" as const },
  { label: "Leaderboard", to: "/leaderboard" as const },
  { label: "About Us", to: "/about" as const },
];

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-card shadow-xs">
        <span className="text-lg font-bold text-primary">B</span>
      </div>
      <div className="leading-tight">
        <div className="text-sm font-bold tracking-wide">BLUETEAMERS</div>
        <div className="text-xs font-semibold tracking-widest text-primary">ARENA</div>
      </div>
    </div>
  );
}

export function Navbar() {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-6 py-4">
        <Link to="/" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>
        <ul className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <li key={l.label}>
              <Link
                to={l.to}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-sm font-semibold text-primary" }}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="hidden text-sm font-medium text-foreground transition-colors hover:text-muted-foreground sm:inline"
          >
            Log in
          </Link>
          <button
            onClick={() => navigate({ to: "/login" })}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--primary-hover)] focus:outline-none"
          >
            Enter Arena
          </button>
        </div>
      </nav>
    </header>
  );
}
