import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ShieldCheck,
  Brain,
  Trophy,
  Target,
  Siren,
  FileText,
  Mail,
  LineChart,
  Linkedin,
  Instagram,
  Youtube,
} from "lucide-react";
import heroCyberImage from "@/assets/hero-cyber.jpg";

import { Navbar } from "@/components/Navbar";

export const Route = createFileRoute("/")({
  component: Landing,
});

const features = [
  {
    icon: ShieldCheck,
    title: "Real Challenges",
    description: "Solve practical SOC scenarios based on real incidents.",
    tint: "bg-blue-500/10 text-blue-400",
  },
  {
    icon: Brain,
    title: "AI Assisted",
    description: "Use AI tools the way professionals do in SOC.",
    tint: "bg-emerald-500/10 text-emerald-400",
  },
  {
    icon: Trophy,
    title: "Live Competition",
    description: "Compete with students across multiple colleges.",
    tint: "bg-amber-500/10 text-amber-400",
  },
];

const categories = [
  { icon: ShieldCheck, label: "AI with SOC", tint: "text-blue-400" },
  { icon: Target, label: "Threat Hunting", tint: "text-emerald-400" },
  { icon: Siren, label: "Incident Response", tint: "text-red-400" },
  { icon: FileText, label: "Log Analysis", tint: "text-orange-400" },
  { icon: Mail, label: "Phishing Analysis", tint: "text-violet-400" },
  { icon: LineChart, label: "SIEM & Tools", tint: "text-sky-400" },
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-card">
        <span className="text-lg font-bold text-primary">B</span>
      </div>
      <div className="leading-tight">
        <div className="text-sm font-bold tracking-wide">BLUETEAMERS</div>
        <div className="text-xs font-semibold tracking-widest text-primary">ARENA</div>
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={onClick ?? (() => navigate({ to: "/login" }))}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--primary-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${className}`}
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={onClick ?? (() => navigate({ to: "/challenges" }))}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-card ${className}`}
    >
      {children}
    </button>
  );
}



function AppPreview() {
  return (
    <div className="relative mx-auto max-w-xl overflow-hidden rounded-2xl border border-border/80 bg-card p-2 shadow-2xl shadow-black/60 group">
      <img
        src={heroCyberImage}
        alt="Blueteamers Arena Cybersecurity Shield & Defender Operations"
        className="max-h-[460px] w-full rounded-xl object-cover shadow-inner transition-transform duration-500 group-hover:scale-[1.02]"
      />
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-12 px-6 pt-14 pb-16 lg:grid-cols-2 lg:pt-20 lg:pb-22">
      <div>
        <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          <span className="block">Train Like a</span>
          <span className="block">SOC Analyst.</span>
          <span className="mt-2 block text-primary">Compete Like a Defender.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
          Practice real-world cybersecurity challenges using AI-powered SOC scenarios
          for the next generation of blue teams.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <PrimaryButton>
            Enter Arena <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
          <GhostButton>View Challenges</GhostButton>
        </div>
      </div>
      <div className="lg:-ml-3">
        <AppPreview />
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="border-y border-border bg-[var(--surface)]/40">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-6 py-16 md:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="flex items-start gap-4">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${f.tint}`}>
              <f.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {f.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Categories() {
  return (
    <section id="challenges" className="mx-auto max-w-[1400px] px-6 py-20">
      <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
        Challenge Categories
      </h2>
      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((c) => (
          <div
            key={c.label}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-5 transition-colors hover:border-primary/40"
          >
            <c.icon className={`h-5 w-5 shrink-0 ${c.tint}`} />
            <span className="text-sm font-medium">{c.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 pb-20">
      <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-border bg-card px-6 py-10 sm:flex-row sm:justify-between sm:px-12">
        <h3 className="text-xl font-semibold sm:text-2xl">Ready to test your skills?</h3>
        <PrimaryButton>Enter Arena</PrimaryButton>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <div className="text-sm font-bold tracking-widest">BLUETEAMERS ARENA</div>
        <div className="text-sm text-muted-foreground">© 2026 All rights reserved.</div>
        <div className="flex items-center gap-4 text-muted-foreground">
          <span className="text-sm">Follow us</span>
          <a href="#" aria-label="LinkedIn" className="hover:text-foreground">
            <Linkedin className="h-4 w-4" />
          </a>
          <a href="#" aria-label="Instagram" className="hover:text-foreground">
            <Instagram className="h-4 w-4" />
          </a>
          <a href="#" aria-label="YouTube" className="hover:text-foreground">
            <Youtube className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}

function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <Features />
      <Categories />
      <FinalCTA />
      <Footer />
    </main>
  );
}
