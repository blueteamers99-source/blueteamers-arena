import { createFileRoute } from "@tanstack/react-router";
import ChallengesPage from "@/components/ChallengesPage";

export const Route = createFileRoute("/challenges")({
  component: ChallengesPage,
  head: () => ({
    meta: [
      { title: "Challenges — Blueteamers Arena" },
      { name: "description", content: "Select and complete SOC investigation challenges." },
      { property: "og:title", content: "Challenges — Blueteamers Arena" },
      { property: "og:description", content: "SOC investigation challenges." },
    ],
  }),
});
