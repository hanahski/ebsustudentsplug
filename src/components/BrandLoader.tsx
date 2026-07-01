import brandLogo from "@/assets/brand-logo.png";

/**
 * Branded loading screen — centered logo + animated blob-gradient wordmark.
 */
export function BrandLoader({ label = "StudentsPlug" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background">
      <div className="relative flex items-center justify-center">
        <span
          aria-hidden
          className="absolute inset-0 -m-3 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, hsl(var(--primary)/0.0), hsl(var(--primary)/0.6), hsl(var(--primary)/0.0))",
            animation: "brandSpin 1.4s linear infinite",
            filter: "blur(8px)",
          }}
        />
        <img
          src={brandLogo}
          alt=""
          width={96}
          height={96}
          className="relative object-contain"
          style={{ width: 96, height: 96, animation: "brandPulse 1.6s ease-in-out infinite" }}
        />
      </div>

      <div className="sp-blob-text text-2xl font-extrabold tracking-wide -mt-4" aria-label={label}>
        {label}
      </div>

      <style>{`
        @keyframes brandSpin { to { transform: rotate(360deg); } }
        @keyframes brandPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 hsl(var(--primary)/0.0)); }
          50% { transform: scale(1.08); filter: drop-shadow(0 8px 18px hsl(var(--primary)/0.45)); }
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
          25%  { background-position: 60% 20%, 40% 80%, 20% 40%, 80% 60%, 30% 70%, 40% 50%; }
          50%  { background-position: 100% 100%, 0% 100%, 100% 0%, 0% 0%, 70% 30%, 80% 50%; }
          75%  { background-position: 30% 80%, 70% 20%, 80% 60%, 20% 40%, 40% 60%, 60% 50%; }
          100% { background-position: 0% 0%, 100% 0%, 50% 100%, 0% 100%, 50% 50%, 100% 50%; }
        }
        @keyframes spHueShift { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
      `}</style>
    </div>
  );
}
