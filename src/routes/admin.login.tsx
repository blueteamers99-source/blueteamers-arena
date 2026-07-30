import { createFileRoute } from "@tanstack/react-router";
import { AdminPortalLogin } from "@/components/admin/AdminPortalLogin";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginRoute,
  head: () => ({
    meta: [
      { title: "Admin Portal — Blueteamers Arena" },
      { name: "description", content: "Administrator authentication portal." },
    ],
  }),
});

function AdminLoginRoute() {
  return <AdminPortalLogin onSuccess={() => (window.location.href = "/admin/dashboard")} />;
}
