import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Laptop, GraduationCap, Users, Linkedin, Instagram, Youtube } from "lucide-react";

import { Navbar } from "@/components/Navbar";

export const Route = createFileRoute("/about")({
    head: () => ({
        meta: [
            { title: "About Us — Blueteamers Arena" },
            { name: "description", content: "Learn about Blueteamers Arena, the hands-on SOC training platform for the next generation of blue team defenders." },
            { property: "og:title", content: "About Us — Blueteamers Arena" },
            { property: "og:description", content: "Learn about Blueteamers Arena, the hands-on SOC training platform for the next generation of blue team defenders." },
            { property: "og:type", content: "website" },
            { name: "twitter:card", content: "summary" },
        ],
    }),
    component: AboutPage,
});

const values = [
    {
        icon: Lock,
        title: "Practical Defense",
        description: "We focus on real-world SOC workflows, not theory. Every challenge is built from incident patterns blue teams face daily.",
    },
    {
        icon: Laptop,
        title: "AI-Powered Training",
        description: "We integrate AI tools the way modern security operations use them, teaching analysts to validate and act on machine-generated insights.",
    },
    {
        icon: GraduationCap,
        title: "Scenario-Based Learning",
        description: "From phishing to forensics, each investigation is a complete narrative with evidence, questions, and clear objectives.",
    },
    {
        icon: Users,
        title: "Community Competitions",
        description: "Colleges and events use our arena to run live CTF-style competitions that rank participants on speed, accuracy, and completeness.",
    },
];

function AboutPage() {
    return (
        <main className="min-h-screen bg-background text-foreground">
            <Navbar />

            {/* Hero / Main Section (2-Column Layout matching MySocLabs) */}
            <section className="mx-auto max-w-7xl px-6 pt-8 pb-16 lg:pt-12 lg:pb-24">
                <div className="grid gap-12 lg:gap-20 lg:grid-cols-12 lg:items-center">
                    {/* Left Column: Heading & Paragraph Content */}
                    <div className="lg:col-span-6">
                        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.1]">
                            About <span className="text-primary">Blueteamers Arena</span>
                        </h1>
                        <p className="mt-6 text-base sm:text-lg leading-relaxed text-muted-foreground">
                            Blueteamers Arena is a hands-on cybersecurity training platform built for students, SOC analysts, and aspiring blue team defenders.
                        </p>

                        <div className="mt-6 border-l-2 border-primary/60 pl-4 py-1 text-sm sm:text-base font-medium text-muted-foreground">
                            We turn complex security operations into practical, gamified investigations that can be practiced solo or run as live competitions at colleges and events.
                        </div>
                    </div>

                    {/* Right Column: 2x2 Feature Cards Grid */}
                    <div className="lg:col-span-6">
                        <div className="grid gap-5 sm:grid-cols-2">
                            {values.map((v) => (
                                <div
                                    key={v.title}
                                    className="group rounded-xl border border-border bg-card p-6 shadow-lg shadow-black/30 transition-all duration-300 hover:border-primary/50 hover:shadow-primary/10"
                                >
                                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                        <v.icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="mt-4 text-base font-semibold text-foreground">{v.title}</h3>
                                    <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-muted-foreground">{v.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="border-y border-border bg-[var(--surface)]/40">
                <div className="mx-auto max-w-7xl px-6 py-12">
                    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="text-center">
                            <div className="text-3xl font-extrabold text-primary">5+</div>
                            <div className="mt-1 text-sm font-medium text-muted-foreground">Investigation Scenarios</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-extrabold text-primary">1000</div>
                            <div className="mt-1 text-sm font-medium text-muted-foreground">Max Points Per Competition</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-extrabold text-primary">60</div>
                            <div className="mt-1 text-sm font-medium text-muted-foreground">Minutes Per Event</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-extrabold text-primary">500+</div>
                            <div className="mt-1 text-sm font-medium text-muted-foreground">Students Trained</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="mx-auto max-w-7xl px-6 py-20">
                <div className="rounded-2xl border border-border bg-card p-8 sm:p-12 shadow-xl shadow-black/40">
                    <div className="mx-auto max-w-2xl text-center">
                        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready to train like a defender?</h2>
                        <p className="mt-4 text-muted-foreground">
                            Join an upcoming competition, practice challenges at your own pace, or bring Blueteamers Arena to your college event.
                        </p>
                        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                            <Link
                                to="/arena"
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-[var(--primary-hover)] hover:shadow-primary/20 focus:outline-none"
                            >
                                Enter Arena
                            </Link>
                            <Link
                                to="/"
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-all hover:bg-accent"
                            >
                                Back to Home
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-border">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 px-6 py-10 text-center">
                    <div className="flex items-center gap-4 text-muted-foreground">
                        <a href="#" aria-label="LinkedIn" className="transition-colors hover:text-primary">
                            <Linkedin className="h-5 w-5" />
                        </a>
                        <a href="#" aria-label="Instagram" className="transition-colors hover:text-primary">
                            <Instagram className="h-5 w-5" />
                        </a>
                        <a href="#" aria-label="YouTube" className="transition-colors hover:text-primary">
                            <Youtube className="h-5 w-5" />
                        </a>
                    </div>
                    <div className="text-xs text-muted-foreground/70">
                        © 2026 Blueteamers Arena. All rights reserved.
                    </div>
                </div>
            </footer>
        </main>
    );
}
