import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import ChallengesPage from "@/components/ChallengesPage";

export const Route = createFileRoute("/challenges")({
  component: ChallengesRoute,
  head: () => ({
    meta: [
      { title: "Challenges — Blueteamers Arena" },
      { name: "description", content: "Select and complete SOC investigation challenges." },
      { property: "og:title", content: "Challenges — Blueteamers Arena" },
      { property: "og:description", content: "SOC investigation challenges." },
    ],
  }),
});

/**
 * Standalone challenges page. Renders the SAME shared ChallengesPage used by
 * the dashboard's Challenges tab so the universal event timer, score, and
 * start-on-arrival behavior are identical everywhere (this route previously
 * had its own divergent implementation with per-challenge timers).
 */
function ChallengesRoute() {
  const navigate = useNavigate();

  useEffect(() => {
    const eventCode = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("arena.selectedEventCode") : null;
    if (!eventCode) {
      navigate({ to: "/arena" });
    }
  }, [navigate]);

  return <ChallengesPage />;
}
