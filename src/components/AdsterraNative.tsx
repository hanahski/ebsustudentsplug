import { useEffect, useRef } from "react";

const CONTAINER_ID = "container-6fae7be33a6081af1acf8d43a397e48c";
const SCRIPT_SRC =
  "https://pl30192003.effectivecpmnetwork.com/6fae7be33a6081af1acf8d43a397e48c/invoke.js";

/**
 * Adsterra native banner. Renders a labeled slot with the required container id
 * and injects the invoke.js loader once per mount. Safe to place inside articles.
 */
export function AdsterraNative({ className = "" }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = hostRef.current;
    if (!host) return;
    // Ensure container div exists inside our host (invoke.js targets by id).
    if (!document.getElementById(CONTAINER_ID)) {
      const div = document.createElement("div");
      div.id = CONTAINER_ID;
      host.appendChild(div);
    }
    const s = document.createElement("script");
    s.async = true;
    (s as any)["data-cfasync"] = "false";
    s.src = SCRIPT_SRC;
    host.appendChild(s);
    return () => {
      try { host.innerHTML = ""; } catch {}
    };
  }, []);

  return (
    <aside
      className={`my-6 not-prose rounded-2xl border border-white/20 dark:border-white/10 bg-card/60 backdrop-blur-xl p-3 ${className}`}
      aria-label="Sponsored"
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
        Sponsored
      </div>
      <div ref={hostRef} className="min-h-[90px]" />
    </aside>
  );
}

let popunderLoaded = false;
const POPUNDER_SRC =
  "https://pl30191443.effectivecpmnetwork.com/42/2e/9c/422e9c1120d4e5695c47b9c2d592ca75.js";

/** Loads the Adsterra popunder script once per browser session. */
export function AdsterraPopunder() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (popunderLoaded) return;
    popunderLoaded = true;
    const s = document.createElement("script");
    s.src = POPUNDER_SRC;
    s.async = true;
    document.body.appendChild(s);
  }, []);
  return null;
}
