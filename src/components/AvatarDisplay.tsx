import { avatarDataUri } from "@/lib/avatars";
import { cn } from "@/lib/utils";

export function AvatarDisplay({
  avatarKey,
  size = 40,
  online,
  className,
}: {
  avatarKey: string;
  size?: number;
  online?: boolean;
  className?: string;
  /** Deprecated: Google/external photos are intentionally never displayed. */
  photoUrl?: string | null;
}) {
  // Only the saved upload/chosen in-app avatar is displayed. Google photos are
  // never used as a visual fallback, so OAuth sign-ins cannot override choices.
  const savedAvatar = avatarKey?.trim();
  const src = savedAvatar ? avatarDataUri(savedAvatar) : avatarDataUri("boy-1");
  const dotSize = Math.max(size * 0.26, 9);
  const ringPad = Math.max(size * 0.05, 2);

  return (
    <div
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {/* Gradient ring frame */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          padding: ringPad,
          background:
            "conic-gradient(from 140deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))",
          boxShadow:
            "0 6px 20px -8px hsl(var(--primary) / 0.45), 0 2px 6px -2px hsl(var(--foreground) / 0.15)",
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
            className="block w-full h-full rounded-full object-cover aspect-square bg-muted"
            style={{
              filter:
                "saturate(1.05) contrast(1.02)",
            }}
            onError={(e) => {
              const generatedFallback = avatarDataUri("boy-1");
              if (e.currentTarget.src !== generatedFallback) {
                e.currentTarget.src = generatedFallback;
              }
            }}
          />
        </div>
      </div>

      {/* Subtle inner glossy highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(120% 70% at 30% 15%, hsl(0 0% 100% / 0.22), transparent 55%)",
          mixBlendMode: "screen",
        }}
      />

      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-card bg-success shadow"
          style={{
            width: dotSize,
            height: dotSize,
            boxShadow:
              "0 0 0 2px hsl(var(--card)), 0 0 12px hsl(var(--success) / 0.7)",
          }}
          aria-label="Online"
        >
          <span
            className="absolute inset-0 rounded-full animate-ping bg-success/60"
            aria-hidden
          />
        </span>
      )}
    </div>
  );
}
