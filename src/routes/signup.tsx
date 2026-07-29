import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/AuthCard";

export const Route = createFileRoute("/signup")({
  component: StudentSignup,
  head: () => ({
    meta: [
      { title: "Student Signup — Blueteamers Arena" },
      { name: "description", content: "Create a student account to participate in university CTF competitions and cybersecurity training." },
    ],
  }),
});

function StudentSignup() {
  return (
    <main className="min-h-screen bg-background relative flex items-center justify-center p-4 py-8 md:py-12 overflow-hidden">
      <AuthCard initialMode="signup" />
    </main>
  );
}
