import { Link } from "@tanstack/react-router";

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
  return (
    <header className="sticky top-0 z-30 border-b-2 border-border/80 bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-6 py-4">
        <Link to="/" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>
      </nav>
    </header>
  );
}

