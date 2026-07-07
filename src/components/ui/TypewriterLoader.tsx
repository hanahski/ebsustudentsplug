/**
 * Typewriter-style animated loader for AI writing/generation. Shows the label
 * with a blinking caret and a subtle progress bar. Uses semantic tokens.
 */
export function TypewriterLoader({ label = "Writing" }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <span className="tw-text font-medium">{label}</span>
      <span className="tw-caret" aria-hidden />
      <style>{`
        .tw-text {
          background: linear-gradient(90deg,
            color-mix(in oklab, var(--foreground) 60%, transparent) 0%,
            var(--primary) 50%,
            color-mix(in oklab, var(--foreground) 60%, transparent) 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
                  background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: tw-shimmer 2s ease-in-out infinite;
        }
        .tw-caret {
          display: inline-block;
          width: 2px;
          height: 1em;
          background: var(--primary);
          animation: tw-blink 0.9s steps(2, start) infinite;
        }
        @keyframes tw-shimmer {
          0%,100% { background-position: 0% 50%; }
          50%     { background-position: 100% 50%; }
        }
        @keyframes tw-blink {
          to { visibility: hidden; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tw-text, .tw-caret { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
