import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy URL — permanently forwards to /admin/login.
export const Route = createFileRoute("/admin-login")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/login", replace: true });
  },
});
