import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/books_/composer")({
  component: ComposerLayout,
});

function ComposerLayout() {
  // Register the composer service worker so the editor keeps working when the
  // network drops. Registration is idempotent and safe to call on every mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/composer-sw.js", { scope: "/books/composer" })
      .catch(() => undefined);
  }, []);
  return <Outlet />;
}
