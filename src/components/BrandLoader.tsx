/**
 * Fullscreen branded loader for first-time users.
 * Interior animation is the Uiverse "pencil" SVG (by @gustavofusco), re-tinted
 * to the StudentsPlug design tokens so it stays on-brand in light + dark mode.
 * Kept the surrounding aura + wordmark shimmer so the surface still feels like
 * StudentsPlug, not a generic widget.
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

      {/* Pencil (Uiverse.io / gustavofusco) — re-tinted to our tokens */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="180"
        width="180"
        viewBox="0 0 200 200"
        className="sp-pencil"
        aria-hidden
      >
        <defs>
          <clipPath id="sp-pencil-eraser">
            <rect height="30" width="30" ry="5" rx="5" />
          </clipPath>
        </defs>
        <circle
          transform="rotate(-113,100,100)"
          strokeLinecap="round"
          strokeDashoffset="439.82"
          strokeDasharray="439.82 439.82"
          strokeWidth="2"
          stroke="var(--primary)"
          fill="none"
          r="70"
          className="sp-pencil__stroke"
        />
        <g transform="translate(100,100)" className="sp-pencil__rotate">
          <g fill="none">
            <circle
              transform="rotate(-90)"
              strokeDashoffset="402"
              strokeDasharray="402.12 402.12"
              strokeWidth="30"
              stroke="var(--primary)"
              r="64"
              className="sp-pencil__body1"
            />
            <circle
              transform="rotate(-90)"
              strokeDashoffset="465"
              strokeDasharray="464.96 464.96"
              strokeWidth="10"
              stroke="color-mix(in oklab, var(--primary) 70%, var(--background))"
              r="74"
              className="sp-pencil__body2"
            />
            <circle
              transform="rotate(-90)"
              strokeDashoffset="339"
              strokeDasharray="339.29 339.29"
              strokeWidth="10"
              stroke="color-mix(in oklab, var(--primary) 55%, var(--foreground))"
              r="54"
              className="sp-pencil__body3"
            />
          </g>
          <g transform="rotate(-90) translate(49,0)" className="sp-pencil__eraser">
            <g className="sp-pencil__eraser-skew">
              <rect
                height="30"
                width="30"
                ry="5"
                rx="5"
                fill="color-mix(in oklab, var(--accent) 85%, var(--background))"
              />
              <rect
                clipPath="url(#sp-pencil-eraser)"
                height="30"
                width="5"
                fill="color-mix(in oklab, var(--accent) 65%, var(--foreground))"
              />
              <rect height="20" width="30" fill="color-mix(in oklab, var(--foreground) 8%, var(--background))" />
              <rect height="20" width="15" fill="color-mix(in oklab, var(--foreground) 28%, var(--background))" />
              <rect height="20" width="5" fill="color-mix(in oklab, var(--foreground) 18%, var(--background))" />
              <rect height="2" width="30" y="6" fill="color-mix(in oklab, var(--foreground) 20%, transparent)" />
              <rect height="2" width="30" y="13" fill="color-mix(in oklab, var(--foreground) 20%, transparent)" />
            </g>
          </g>
          <g transform="rotate(-90) translate(49,-30)" className="sp-pencil__point">
            <polygon points="15 0,30 30,0 30" fill="color-mix(in oklab, var(--accent) 75%, var(--background))" />
            <polygon points="15 0,6 30,0 30" fill="var(--accent)" />
            <polygon points="15 0,20 10,10 10" fill="var(--foreground)" />
          </g>
        </g>
      </svg>

      <div className="sp-word font-display mt-6" aria-hidden>
        {label}
      </div>
      <div className="sp-caption">preparing your workspace</div>

      <style>{`
        .sp-pencil {
          filter: drop-shadow(0 8px 24px color-mix(in oklab, var(--primary) 40%, transparent));
        }
        .sp-pencil__stroke {
          animation: spPencilStroke 3s ease-in-out infinite;
          transform-origin: 100px 100px;
        }
        .sp-pencil__rotate {
          animation: spPencilRotate 3s linear infinite;
          transform-origin: 100px 100px;
        }
        .sp-pencil__body1 { animation: spPencilBody1 3s ease-in-out infinite; }
        .sp-pencil__body2 { animation: spPencilBody2 3s ease-in-out infinite; }
        .sp-pencil__body3 { animation: spPencilBody3 3s ease-in-out infinite; }
        .sp-pencil__eraser {
          animation: spPencilEraser 3s cubic-bezier(0.65, 0, 0.35, 1) infinite;
          transform: rotate(-90deg) translate(49px, 0);
        }
        .sp-pencil__eraser-skew { animation: spPencilEraserSkew 3s ease-in-out infinite; }
        .sp-pencil__point {
          animation: spPencilPoint 3s cubic-bezier(0.65, 0, 0.35, 1) infinite;
          transform: rotate(-90deg) translate(49px, -30px);
        }

        @keyframes spPencilStroke {
          0%   { stroke-dashoffset: 439.82; transform: rotate(-113deg); }
          50%  { stroke-dashoffset: 219.91; transform: rotate(-113deg); }
          100% { stroke-dashoffset: 439.82; transform: rotate(247deg); }
        }
        @keyframes spPencilRotate {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(720deg); }
        }
        @keyframes spPencilBody1 {
          0%,100% { stroke-dashoffset: 402.12; }
          50%     { stroke-dashoffset: 0; }
        }
        @keyframes spPencilBody2 {
          0%,100% { stroke-dashoffset: 464.96; }
          50%     { stroke-dashoffset: 0; }
        }
        @keyframes spPencilBody3 {
          0%,100% { stroke-dashoffset: 339.29; }
          50%     { stroke-dashoffset: 0; }
        }
        @keyframes spPencilEraser {
          0%,100% { transform: rotate(-45deg) translate(49px, 0); }
          50%     { transform: rotate(0deg)  translate(49px, 0); }
        }
        @keyframes spPencilEraserSkew {
          0%,100% { transform: skewX(0); }
          50%     { transform: skewX(30deg); }
        }
        @keyframes spPencilPoint {
          0%,100% { transform: rotate(-45deg) translate(49px, -30px); }
          50%     { transform: rotate(0deg)  translate(49px, -30px); }
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
          0%,100% { background-position: 0% 50%; }
          50%     { background-position: 100% 50%; }
        }
        .sp-caption {
          margin-top: 0.5rem;
          font-size: 0.7rem;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: color-mix(in oklab, var(--foreground) 55%, transparent);
        }

        @media (prefers-reduced-motion: reduce) {
          .sp-pencil__stroke, .sp-pencil__rotate,
          .sp-pencil__body1, .sp-pencil__body2, .sp-pencil__body3,
          .sp-pencil__eraser, .sp-pencil__eraser-skew, .sp-pencil__point,
          .sp-word {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
