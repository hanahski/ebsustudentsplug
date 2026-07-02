import brandLogo from "@/assets/brand-logo.png";

/**
 * Professional branded loader.
 * - Opaque, always on top (z-index max) so it never sits behind app chrome.
 * - Uses raw CSS custom properties (oklch) — no hsl() wrapping that would
 *   silently invalidate colors with this design system's tokens.
 * - Composition: soft radial aura, dual conic progress rings (counter-rotating),
 *   crisp arc sweep, breathing logo core, and a shimmer wordmark.
 */
export function BrandLoader({ label = "StudentsPlug" }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        zIndex: 2147483000,
        background: "var(--background)",
        isolation: "isolate",
      }}
      role="status"
      aria-live="polite"
      aria-label={`${label} loading`}
    >
      {/* Subtle radial aura */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 42%, color-mix(in oklab, var(--primary) 14%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="sp-loader" aria-hidden>
        {/* Outer conic ring */}
        <div className="sp-ring sp-ring--outer" />
        {/* Inner conic ring, reversed */}
        <div className="sp-ring sp-ring--inner" />
        {/* Crisp sweeping arc */}
        <svg className="sp-arc" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="spArcGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="url(#spArcGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="80 210"
          />
        </svg>

        {/* Logo core */}
        <div className="sp-core">
          <img src={brandLogo} alt="" width={72} height={72} draggable={false} />
        </div>
      </div>

      <div className="sp-word font-display mt-7" aria-hidden>
        {label}
      </div>
      <div className="sp-caption">preparing your workspace</div>

      <style>{`
        .sp-loader {
          position: relative;
          width: 152px;
          height: 152px;
          display: grid;
          place-items: center;
        }
        .sp-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          padding: 2px;
          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
                  mask-composite: exclude;
        }
        .sp-ring--outer {
          background: conic-gradient(from 0deg,
            transparent 0deg,
            color-mix(in oklab, var(--primary) 80%, transparent) 140deg,
            var(--primary) 220deg,
            transparent 360deg);
          animation: spSpin 2.2s linear infinite;
          filter: drop-shadow(0 0 10px color-mix(in oklab, var(--primary) 55%, transparent));
        }
        .sp-ring--inner {
          inset: 14px;
          background: conic-gradient(from 180deg,
            transparent 0deg,
            color-mix(in oklab, var(--accent) 70%, transparent) 160deg,
            var(--accent) 240deg,
            transparent 360deg);
          animation: spSpin 3.4s linear infinite reverse;
          opacity: 0.85;
        }
        .sp-arc {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          animation: spSpin 1.6s cubic-bezier(0.65, 0, 0.35, 1) infinite;
        }
        .sp-core {
          position: relative;
          width: 82px;
          height: 82px;
          border-radius: 9999px;
          display: grid;
          place-items: center;
          background: var(--background);
          box-shadow:
            0 10px 30px -10px color-mix(in oklab, var(--primary) 55%, transparent),
            inset 0 0 0 1px color-mix(in oklab, var(--foreground) 8%, transparent);
          animation: spBreathe 2.4s ease-in-out infinite;
        }
        .sp-core img {
          width: 72px;
          height: 72px;
          object-fit: contain;
        }

        @keyframes spSpin { to { transform: rotate(360deg); } }
        @keyframes spBreathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.05); }
        }

        .sp-word {
          font-size: 1.75rem;
          letter-spacing: -0.01em;
          font-style: italic;
          background: linear-gradient(100deg,
            var(--foreground) 0%,
            color-mix(in oklab, var(--primary) 85%, var(--foreground)) 45%,
            var(--foreground) 100%);
          background-size: 220% 100%;
          -webkit-background-clip: text;
                  background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: spShimmer 3.2s ease-in-out infinite;
        }
        @keyframes spShimmer {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        .sp-caption {
          margin-top: 0.5rem;
          font-size: 0.7rem;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: color-mix(in oklab, var(--foreground) 55%, transparent);
        }

        @media (prefers-reduced-motion: reduce) {
          .sp-ring, .sp-arc, .sp-core, .sp-word { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
