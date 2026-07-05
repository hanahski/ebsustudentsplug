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
  const dotSize = Math.max(size * 0.28, 10);

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
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        draggable={false}
        style={{ width: size, height: size }}
        className={cn(
          "block rounded-full border-2 border-card shadow-card object-cover aspect-square bg-muted",
          playing && anim.cls,
        )}
        onError={(e) => {
          const fallback = avatarDataUri("boy-1");
          if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
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
          className="online-dot absolute bottom-0 right-0 block rounded-full bg-success border-2 border-card"
          style={{ width: dotSize, height: dotSize }}
          aria-label="Online"
        />
      )}
    </Wrapper>
  );
}
