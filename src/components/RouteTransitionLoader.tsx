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
  const [isDark, setIsDark] = useState(false);
  const startedAt = useRef<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

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

  const src = animatedLogo.url;
  const bg = isDark ? "#000" : "#fff";

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center pointer-events-auto"
      style={{ backgroundColor: bg, animation: "spLoaderFade 180ms ease-out" }}
      aria-hidden
    >
      <div className="relative flex items-center justify-center">
        <img
          src={src}
          alt=""
          className="object-contain relative"
          style={{ width: 160, height: 160 }}
          draggable={false}
        />
      </div>

      <div className="-mt-4 sp-blob-text font-display font-bold text-xl tracking-tight" aria-label="StudentsPlug">
        StudentsPlug
      </div>
      <style>{`
        @keyframes spLoaderFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes spLoaderSpin { to { transform: rotate(360deg) } }
        .sp-blob-text {
          background-image:
            radial-gradient(circle at 20% 40%, #3b82f6 0%, transparent 40%),
            radial-gradient(circle at 70% 30%, #eab308 0%, transparent 40%),
            radial-gradient(circle at 40% 70%, #22c55e 0%, transparent 40%),
            radial-gradient(circle at 80% 80%, #ef4444 0%, transparent 40%),
            radial-gradient(circle at 55% 50%, #a855f7 0%, transparent 45%),
            linear-gradient(90deg, #3b82f6, #eab308, #22c55e, #ef4444, #a855f7, #3b82f6);
          background-size: 220% 220%, 220% 220%, 220% 220%, 220% 220%, 220% 220%, 400% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: spBlobMove 6s ease-in-out infinite, spHueShift 8s linear infinite;
        }
        @keyframes spBlobMove {
          0%   { background-position: 0% 0%, 100% 0%, 50% 100%, 0% 100%, 50% 50%, 0% 50%; }
          25%  { background-position: 60% 20%, 40% 80%, 20% 40%, 80% 60%, 30% 70%, 40% 50%; }
          50%  { background-position: 100% 100%, 0% 100%, 100% 0%, 0% 0%, 70% 30%, 80% 50%; }
          75%  { background-position: 30% 80%, 70% 20%, 80% 60%, 20% 40%, 40% 60%, 60% 50%; }
          100% { background-position: 0% 0%, 100% 0%, 50% 100%, 0% 100%, 50% 50%, 100% 50%; }
        }
        @keyframes spHueShift { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
      `}</style>

    </div>
  );
}
