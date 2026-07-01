import brandLogo from "@/assets/brand-logo.png";

/**
 * Branded loading screen — logo with elegant orbit ring + shimmer + gradient wordmark.
 * Pure CSS, fully transparent, no image background.
 */
export function BrandLoader({ label = "StudentsPlug" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background">
      <div className="sp-loader-wrap">
        {/* outer orbit ring */}
        <span className="sp-ring sp-ring-1" aria-hidden />
        <span className="sp-ring sp-ring-2" aria-hidden />
        {/* orbiting dot */}
        <span className="sp-orbit" aria-hidden>
          <span className="sp-dot" />
        </span>
        {/* logo with shimmer sweep */}
        <div className="sp-logo-holder">
          <img
            src={brandLogo}
            alt=""
            width={112}
            height={112}
            className="sp-logo-img"
            draggable={false}
          />
          <span className="sp-shimmer" aria-hidden />
        </div>
      </div>

      <div className="sp-blob-text font-display font-bold text-xl tracking-tight mt-3" aria-label={label}>
        {label}
      </div>

      <style>{`
        .sp-loader-wrap {
          position: relative;
          width: 168px;
          height: 168px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sp-ring {
          position: absolute;
          border-radius: 9999px;
          border: 2px solid transparent;
          border-top-color: hsl(var(--primary));
          border-right-color: hsl(var(--primary) / 0.4);
        }
        .sp-ring-1 { inset: 0; animation: spRingSpin 1.8s cubic-bezier(.6,.1,.4,.9) infinite; }
        .sp-ring-2 { inset: 14px; border-top-color: hsl(var(--primary) / 0.5); border-right-color: transparent; border-left-color: hsl(var(--primary) / 0.3); animation: spRingSpin 2.6s linear infinite reverse; }

        .sp-orbit {
          position: absolute;
          inset: -6px;
          border-radius: 9999px;
          animation: spRingSpin 2.2s linear infinite;
        }
        .sp-dot {
          position: absolute;
          top: -4px;
          left: 50%;
          width: 10px;
          height: 10px;
          margin-left: -5px;
          border-radius: 9999px;
          background: hsl(var(--primary));
          box-shadow: 0 0 12px hsl(var(--primary) / 0.9), 0 0 24px hsl(var(--primary) / 0.5);
        }

        .sp-logo-holder {
          position: relative;
          width: 112px;
          height: 112px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: spLogoBreathe 2.4s ease-in-out infinite;
        }
        .sp-logo-img {
          width: 112px;
          height: 112px;
          object-fit: contain;
          filter: drop-shadow(0 6px 18px hsl(var(--primary) / 0.35));
        }
        .sp-shimmer {
          position: absolute;
          inset: 0;
          border-radius: 20px;
          background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%);
          mix-blend-mode: overlay;
          transform: translateX(-120%);
          animation: spShimmer 2.4s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes spRingSpin { to { transform: rotate(360deg); } }
        @keyframes spLogoBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes spShimmer {
          0%   { transform: translateX(-120%); opacity: 0; }
          20%  { opacity: 1; }
          60%  { opacity: 1; }
          100% { transform: translateX(120%); opacity: 0; }
        }

        .sp-blob-text {
          background-image:
            radial-gradient(circle at 20% 40%, #3b82f6 0%, transparent 40%),
            radial-gradient(circle at 70% 30%, #eab308 0%, transparent 40%),
            radial-gradient(circle at 40% 70%, #22c55e 0%, transparent 40%),
            radial-gradient(circle at 80% 80%, #ef4444 0%, transparent 40%),
            radial-gradient(circle at 55% 50%, #a855f7 0%, transparent 45%),
            linear-gradient(90deg, #3b82f6, #eab308, #22c55e, #ef4444, #a855f7, #3b82f6);
          background-size: 220% 220%, 220% 220%, 220% 220%, 220% 220%, 220% 220%, 400% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-fill-color: transparent;
          animation: spBlobMove 6s ease-in-out infinite, spHueShift 8s linear infinite;
        }
        @keyframes spBlobMove {
          0%   { background-position: 0% 0%, 100% 0%, 50% 100%, 0% 100%, 50% 50%, 0% 50%; }
          50%  { background-position: 100% 100%, 0% 100%, 100% 0%, 0% 0%, 70% 30%, 80% 50%; }
          100% { background-position: 0% 0%, 100% 0%, 50% 100%, 0% 100%, 50% 50%, 100% 50%; }
        }
        @keyframes spHueShift { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
      `}</style>
    </div>
  );
}
