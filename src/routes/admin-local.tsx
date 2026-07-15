import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy URL — permanently forwards to /admin.
export const Route = createFileRoute("/admin-local")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", replace: true });
  },
});
