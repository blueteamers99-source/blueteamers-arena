import { createFileRoute, redirect } from "@tanstack/react-router";
import { isStudentLoggedIn } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (isStudentLoggedIn()) {
      throw redirect({ to: "/dashboard" });
    }
    throw redirect({ to: "/arena" });
  },
  component: () => null,
});
