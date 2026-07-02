import brandLogo from "@/assets/brand-logo.png";

/**
 * Particle-constellation branded loader.
 * SVG particles orbit + connect with faint lines around a breathing logo.
 * Pure CSS animation, fully transparent, works over any background.
 */
export function BrandLoader({ label = "StudentsPlug" }: { label?: string }) {
  // 12 particles distributed on 3 orbital radii
  const particles = Array.from({ length: 12 }).map((_, i) => {
    const ring = i % 3; // 0,1,2
    const radius = 78 + ring * 22; // 78, 100, 122
    const baseAngle = (i / 12) * 360;
    const duration = 8 + ring * 2.5; // 8s, 10.5s, 13s
    const reverse = ring === 1;
    const size = ring === 0 ? 6 : ring === 1 ? 4 : 3;
    return { i, radius, baseAngle, duration, reverse, size };
  });

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background overflow-hidden">
      {/* Ambient mesh backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-mesh opacity-70" aria-hidden />

      <div className="sp-const-wrap" aria-hidden>
        {/* Connecting lines — subtle rotating rings */}
        <svg className="sp-const-svg" viewBox="-160 -160 320 320">
          <defs>
            <radialGradient id="spCore" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="0" cy="0" r="150" fill="url(#spCore)" />
          <circle cx="0" cy="0" r="78" fill="none" stroke="hsl(var(--primary) / 0.18)" strokeDasharray="2 6" />
          <circle cx="0" cy="0" r="100" fill="none" stroke="hsl(var(--accent) / 0.18)" strokeDasharray="2 8" />
          <circle cx="0" cy="0" r="122" fill="none" stroke="hsl(var(--success) / 0.18)" strokeDasharray="2 10" />
        </svg>

        {/* Orbiting particles */}
        {particles.map(({ i, radius, baseAngle, duration, reverse, size }) => (
          <span
            key={i}
            className="sp-orb"
            style={{
              width: size,
              height: size,
              animation: `spOrb ${duration}s linear infinite ${reverse ? "reverse" : ""}`,
              transform: `rotate(${baseAngle}deg) translateX(${radius}px)`,
              // @ts-expect-error CSS var
              "--sp-radius": `${radius}px`,
              "--sp-start": `${baseAngle}deg`,
            }}
          />
        ))}

        {/* Logo core */}
        <div className="sp-const-logo">
          <img src={brandLogo} alt="" width={104} height={104} draggable={false} />
        </div>
      </div>

      <div className="sp-wordmark font-display mt-6" aria-label={label}>
        {label}
      </div>
      <div className="sp-loading-caption">loading your plug…</div>

      <style>{`
        .sp-const-wrap {
          position: relative;
          width: 300px;
          height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sp-const-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          animation: spSlowSpin 40s linear infinite;
        }
        .sp-const-logo {
          position: relative;
          width: 104px;
          height: 104px;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: spBreathe 2.6s ease-in-out infinite;
          filter: drop-shadow(0 8px 22px hsl(var(--primary) / 0.35));
        }
        .sp-const-logo img {
          width: 104px;
          height: 104px;
          object-fit: contain;
        }
        .sp-orb {
          position: absolute;
          top: 50%;
          left: 50%;
          margin: -3px 0 0 -3px;
          border-radius: 9999px;
          background: hsl(var(--primary));
          box-shadow:
            0 0 6px hsl(var(--primary) / 0.9),
            0 0 14px hsl(var(--primary) / 0.5);
        }
        .sp-orb:nth-child(3n+2) { background: hsl(var(--accent)); box-shadow: 0 0 6px hsl(var(--accent) / 0.9), 0 0 14px hsl(var(--accent) / 0.5); }
        .sp-orb:nth-child(3n+3) { background: hsl(var(--success)); box-shadow: 0 0 6px hsl(var(--success) / 0.9), 0 0 14px hsl(var(--success) / 0.5); }

        @keyframes spOrb {
          from { transform: rotate(var(--sp-start)) translateX(var(--sp-radius)); }
          to   { transform: rotate(calc(var(--sp-start) + 360deg)) translateX(var(--sp-radius)); }
        }
        @keyframes spSlowSpin { to { transform: rotate(360deg); } }
        @keyframes spBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }

        .sp-wordmark {
          font-size: 2rem;
          font-style: italic;
          letter-spacing: -0.02em;
          background: linear-gradient(100deg,
            hsl(var(--primary)) 0%,
            hsl(var(--accent)) 45%,
            hsl(var(--success)) 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: spWordShift 4s ease-in-out infinite;
        }
        @keyframes spWordShift {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        .sp-loading-caption {
          margin-top: 0.35rem;
          font-size: 0.72rem;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: hsl(var(--muted-foreground));
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}
