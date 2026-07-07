import { useEffect, useRef, useState } from "react";

/**
 * Reveals `text` character-by-character on first mount, then renders `children`
 * (usually a full markdown component) once done. Skips animation on
 * reduced-motion or when `text` is short/empty.
 */
export function TypewriterReveal({
  text,
  speed = 12,
  children,
}: {
  text: string;
  speed?: number;
  children: React.ReactNode;
}) {
  const [i, setI] = useState(0);
  const done = i >= text.length;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduced || text.length < 8) { setI(text.length); return; }
    setI(0);
    const step = () => {
      setI((v) => {
        if (v >= text.length) return v;
        // reveal in small chunks so it feels smooth even on long replies
        const chunk = Math.max(1, Math.floor(text.length / 400));
        const next = Math.min(text.length, v + chunk);
        if (next < text.length) timer.current = setTimeout(step, speed);
        return next;
      });
    };
    timer.current = setTimeout(step, speed);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text, speed, reduced]);

  if (done) return <>{children}</>;
  return (
    <span className="whitespace-pre-wrap break-words text-sm">
      {text.slice(0, i)}
      <span
        aria-hidden
        className="inline-block w-[2px] h-[1em] align-[-2px] ml-[1px] bg-primary animate-pulse"
      />
    </span>
  );
}
