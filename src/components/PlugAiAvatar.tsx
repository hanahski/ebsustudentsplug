/**
 * Plug AI avatar — a soft glowing orb with a subtle "spark" glyph. Replaces
 * the generic `Sparkles` icon used in Chat Plug so the assistant has a
 * distinctive on-brand identity that reads as "alive AI".
 */
export function PlugAiAvatar({
  size = 36,
  pulsing = false,
  className = "",
}: {
  size?: number;
  pulsing?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`plug-ai-orb ${pulsing ? "is-pulsing" : ""} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 40 40" width={size} height={size} className="plug-ai-orb__svg">
        <defs>
          <radialGradient id="plugAiCore" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="color-mix(in oklab, var(--primary-foreground) 90%, var(--primary))" />
            <stop offset="55%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="color-mix(in oklab, var(--accent) 80%, var(--primary))" />
          </radialGradient>
          <radialGradient id="plugAiHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="color-mix(in oklab, var(--primary) 55%, transparent)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <circle cx="20" cy="20" r="19" fill="url(#plugAiHalo)" className="plug-ai-orb__halo" />
        <circle cx="20" cy="20" r="13" fill="url(#plugAiCore)" />
        <path
          d="M20 11 L22.2 18 L29 20 L22.2 22 L20 29 L17.8 22 L11 20 L17.8 18 Z"
          fill="color-mix(in oklab, var(--primary-foreground) 92%, transparent)"
          opacity="0.9"
        />
        <circle cx="15" cy="15" r="1.6" fill="color-mix(in oklab, var(--primary-foreground) 90%, transparent)" opacity="0.8" />
      </svg>
      <style>{`
        .plug-ai-orb {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          filter: drop-shadow(0 0 8px color-mix(in oklab, var(--primary) 40%, transparent));
        }
        .plug-ai-orb__halo {
          transform-origin: 20px 20px;
          animation: plug-ai-halo 3.5s ease-in-out infinite;
        }
        .plug-ai-orb.is-pulsing { animation: plug-ai-bob 2.2s ease-in-out infinite; }
        @keyframes plug-ai-halo {
          0%,100% { opacity: 0.55; transform: scale(1); }
          50%     { opacity: 0.9;  transform: scale(1.12); }
        }
        @keyframes plug-ai-bob {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-2px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .plug-ai-orb__halo, .plug-ai-orb { animation: none !important; }
        }
      `}</style>
    </span>
  );
}
