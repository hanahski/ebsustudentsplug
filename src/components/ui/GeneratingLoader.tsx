/**
 * "Generating…" loader — inspired by Uiverse.io (joao-canais / pradip_1434),
 * re-tinted to StudentsPlug tokens. Used when Plug AI is thinking, when a
 * book chapter is being written, or anywhere an AI response is streaming.
 */
export function GeneratingLoader({
  label = "Generating",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const letters = label.split("");
  return (
    <div
      className={`gen-wrap ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`${label}…`}
    >
      {letters.map((ch, i) => (
        <span key={i} className="gen-letter" style={{ animationDelay: `${i * 0.09}s` }}>
          {ch}
        </span>
      ))}
      <span className="gen-letter" style={{ animationDelay: `${letters.length * 0.09}s` }}>.</span>
      <span className="gen-letter" style={{ animationDelay: `${(letters.length + 1) * 0.09}s` }}>.</span>
      <span className="gen-letter" style={{ animationDelay: `${(letters.length + 2) * 0.09}s` }}>.</span>
      <span className="gen-orb" aria-hidden />
      <style>{`
        .gen-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: color-mix(in oklab, var(--foreground) 88%, transparent);
          user-select: none;
          font-weight: 500;
          font-size: 0.85rem;
          letter-spacing: 0.02em;
        }
        .gen-letter {
          display: inline-block;
          opacity: 0.4;
          transform: translateY(0);
          animation: gen-letter-anim 2s infinite;
        }
        @keyframes gen-letter-anim {
          0%, 100% { opacity: 0.4; transform: translateY(0); }
          20%      { opacity: 1;   transform: scale(1.18); }
          40%      { opacity: 0.7; transform: translateY(0); }
        }
        .gen-orb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          margin-left: 4px;
          animation: gen-orb-rotate 1.5s linear infinite;
          box-shadow:
            0 1px 1px 0 color-mix(in oklab, var(--foreground) 20%, transparent) inset,
            0 3px 5px 0 color-mix(in oklab, var(--primary) 80%, transparent) inset,
            0 4px 4px 0 color-mix(in oklab, var(--accent) 70%, transparent) inset;
        }
        @keyframes gen-orb-rotate {
          0%   { transform: rotate(90deg); }
          50%  { transform: rotate(270deg);
            box-shadow:
              0 1px 1px 0 color-mix(in oklab, var(--foreground) 20%, transparent) inset,
              0 3px 5px 0 color-mix(in oklab, var(--accent) 90%, transparent) inset,
              0 4px 4px 0 color-mix(in oklab, var(--primary) 70%, transparent) inset;
          }
          100% { transform: rotate(450deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gen-letter, .gen-orb { animation: none !important; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
