import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/earn-credits/battle")({
  component: BattleLayout,
  head: () => ({ meta: [{ title: "Battle — 1v1 for Plug Credits" }] }),
});

function BattleLayout() {
  return <Outlet />;
}