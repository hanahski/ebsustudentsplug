import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { BrandLoader } from "@/components/BrandLoader";

/**
 * Full-screen branded animated logo shown during route transitions.
 * Visible only while the router is actually loading the next route, with a
 * minimum 400ms presence so very fast navigations still get a brand moment.
 */
const MIN_VISIBLE_MS = 400;

export function RouteTransitionLoader() {
  const isLoading = useRouterState({ select: (s) => s.isLoading });
  const [visible, setVisible] = useState(false);
  const startedAt = useRef<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);


  useEffect(() => {
    if (isLoading) {
      if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
      if (!visible) {
        startedAt.current = Date.now();
        setVisible(true);
      }
    } else if (visible) {
      const elapsed = startedAt.current ? Date.now() - startedAt.current : MIN_VISIBLE_MS;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      hideTimer.current = setTimeout(() => {
        setVisible(false);
        startedAt.current = null;
      }, remaining);
    }
    return () => {
      if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    };
  }, [isLoading, visible]);

  if (!visible) return null;

  return (
    <div style={{ animation: "spLoaderFade 180ms ease-out" }}>
      <BrandLoader />
      <style>{`@keyframes spLoaderFade { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  );
}

