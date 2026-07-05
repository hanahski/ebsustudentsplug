import { useCallback, useEffect, useRef, useState } from "react";
import { avatarDataUri } from "@/lib/avatars";
import { cn } from "@/lib/utils";

// Per-avatar signature animation. Each key gets its own personality.
const ANIM_BY_KEY: Record<string, { cls: string; hearts?: boolean; label: string }> = {
  "boy-1": { cls: "av-anim-wave", label: "waves" },
  "boy-2": { cls: "av-anim-tilt", label: "nods" },
  "boy-3": { cls: "av-anim-wave", label: "waves" },
  "boy-4": { cls: "av-anim-bounce", label: "bounces" },
  "boy-5": { cls: "av-anim-jump", label: "jumps" },
  "girl-1": { cls: "av-anim-kiss", hearts: true, label: "blows a kiss" },
  "girl-2": { cls: "av-anim-sway", label: "sways" },
  "girl-3": { cls: "av-anim-wiggle", label: "wiggles" },
  "girl-4": { cls: "av-anim-spin", label: "spins" },
};

const DEFAULT_ANIM = { cls: "av-anim-bounce", label: "bounces" };

export function AvatarDisplay({
  avatarKey,
  size = 40,
  online,
  className,
  interactive = false,
}: {
  avatarKey: string;
  size?: number;
  online?: boolean;
  className?: string;
  /** When true, tapping the avatar triggers a 5s personality animation. */
  interactive?: boolean;
  /** Deprecated: Google/external photos are intentionally never displayed. */
  photoUrl?: string | null;
}) {
  const savedAvatar = avatarKey?.trim();
  const isUrl = savedAvatar?.startsWith("http");
  const src = savedAvatar
    ? isUrl
      ? savedAvatar
      : avatarDataUri(savedAvatar)
    : avatarDataUri("boy-1");
  const dotSize = Math.max(size * 0.26, 9);
  const ringPad = Math.max(size * 0.05, 2);

  const anim = ANIM_BY_KEY[savedAvatar ?? ""] ?? DEFAULT_ANIM;
  const [playing, setPlaying] = useState(false);
  const [hearts, setHearts] = useState<number[]>([]);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const play = useCallback(() => {
    if (!interactive || playing) return;
    setPlaying(true);
    if (anim.hearts) {
      const ids = [0, 1, 2, 3].map((i) => Date.now() + i);
      setHearts(ids);
      ids.forEach((id, i) => {
        window.setTimeout(() => setHearts((h) => h.filter((x) => x !== id)), 1400 + i * 350);
      });
    }
    timer.current = window.setTimeout(() => setPlaying(false), 5000);
  }, [interactive, playing, anim.hearts]);

  const Wrapper: any = interactive ? "button" : "div";

  return (
    <Wrapper
      type={interactive ? "button" : undefined}
      onClick={interactive ? play : undefined}
      aria-label={interactive ? `Avatar ${anim.label}` : undefined}
      className={cn(
        "relative inline-block shrink-0 align-middle",
        interactive && "cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* Gradient ring frame */}
      <div
        className={cn("absolute inset-0 rounded-full transition-transform", playing && anim.cls)}
        style={{
          padding: ringPad,
          background:
            "conic-gradient(from 140deg, var(--primary), var(--accent), oklch(0.65 0.22 15), var(--primary))",
          boxShadow:
            "0 8px 24px -10px color-mix(in oklab, var(--primary) 50%, transparent), 0 2px 8px -2px color-mix(in oklab, var(--foreground) 18%, transparent)",

        }}
        aria-hidden
      >
        <div className="w-full h-full rounded-full bg-card p-[1.5px]">
          <img
            src={src}
            alt=""
            width={size}
            height={size}
            referrerPolicy="no-referrer"
            draggable={false}
            className="block w-full h-full rounded-full object-cover aspect-square bg-muted"
            style={{ filter: "saturate(1.08) contrast(1.03)" }}
            onError={(e) => {
              const fallback = avatarDataUri("boy-1");
              if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
            }}
          />
        </div>
      </div>

      {/* Glossy highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(120% 70% at 30% 15%, hsl(0 0% 100% / 0.24), transparent 55%)",
          mixBlendMode: "screen",
        }}
      />

      {/* Floating hearts for kiss animation */}
      {hearts.map((id, i) => (
        <span
          key={id}
          className="av-heart text-lg"
          style={{
            animationDelay: `${i * 0.28}s`,
            color: "hsl(340 90% 60%)",
            fontSize: Math.max(size * 0.28, 16),
            filter: "drop-shadow(0 2px 4px hsl(340 90% 40% / 0.5))",
          }}
          aria-hidden
        >
          ♥
        </span>
      ))}

      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-card bg-success shadow"
          style={{
            width: dotSize,
            height: dotSize,
            boxShadow: "0 0 0 2px hsl(var(--card)), 0 0 12px hsl(var(--success) / 0.7)",
          }}
          aria-label="Online"
        >
          <span className="absolute inset-0 rounded-full animate-ping bg-success/60" aria-hidden />
        </span>
      )}
    </Wrapper>
  );
}
