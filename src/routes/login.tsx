import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/AuthCard";

export const Route = createFileRoute("/login")({
  component: StudentLogin,
  head: () => ({
    meta: [
      { title: "Student Login — Blueteamers Arena" },
      { name: "description", content: "Sign in to access CTF cybersecurity challenges, track your progress, and view live leaderboards." },
    ],
  }),
});

function StudentLogin() {
  return (
    <main className="min-h-screen bg-background relative flex items-center justify-center p-4 py-8 md:py-12 overflow-hidden">
      <AuthCard initialMode="login" />
    </main>
  );
}
