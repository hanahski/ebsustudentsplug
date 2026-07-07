import { useTheme } from "@/components/ThemeToggle";

/**
 * Animated sun/moon theme switch — Uiverse.io (@athulknr) reworked to our
 * palette. Wired to the existing useTheme() hook so behaviour is identical
 * to the previous ThemeToggle; only the visual control changed.
 */
export function ThemeSwitch({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <label
      className={`theme-switch ${className}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={isDark}
        onChange={() => toggle()}
      />
      <span className="theme-switch__track" data-dark={isDark ? "1" : "0"}>
        <span className="theme-switch__thumb">
          <span className="theme-switch__sun" aria-hidden />
          <span className="theme-switch__moon" aria-hidden>
            <span className="theme-switch__crater a" />
            <span className="theme-switch__crater b" />
            <span className="theme-switch__crater c" />
          </span>
        </span>
        <span className="theme-switch__stars" aria-hidden>
          <span /><span /><span /><span />
        </span>
      </span>
      <style>{`
        .theme-switch { display: inline-flex; cursor: pointer; }
        .theme-switch__track {
          position: relative;
          width: 56px;
          height: 30px;
          border-radius: 9999px;
          background: linear-gradient(120deg,
            color-mix(in oklab, var(--primary) 30%, var(--background)),
            color-mix(in oklab, var(--accent) 30%, var(--background)));
          box-shadow:
            inset 0 1px 2px color-mix(in oklab, var(--foreground) 15%, transparent),
            0 2px 6px color-mix(in oklab, var(--primary) 20%, transparent);
          transition: background 0.5s ease;
          overflow: hidden;
        }
        .theme-switch__track[data-dark="1"] {
          background: linear-gradient(120deg,
            color-mix(in oklab, var(--foreground) 65%, var(--background)),
            color-mix(in oklab, var(--primary) 40%, var(--background)));
        }
        .theme-switch__thumb {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 24px;
          height: 24px;
          border-radius: 9999px;
          transition: transform 0.45s cubic-bezier(0.65, 0, 0.35, 1);
          transform: translateX(0);
        }
        .theme-switch__track[data-dark="1"] .theme-switch__thumb {
          transform: translateX(26px);
        }
        .theme-switch__sun,
        .theme-switch__moon {
          position: absolute; inset: 0;
          border-radius: 9999px;
          transition: opacity 0.35s ease, transform 0.35s ease;
        }
        .theme-switch__sun {
          background: radial-gradient(circle at 35% 35%,
            #fff8c8 0%, #fbe27a 55%, #f4c534 100%);
          box-shadow: 0 0 10px color-mix(in oklab, #f4c534 70%, transparent);
          opacity: 1;
        }
        .theme-switch__moon {
          background: radial-gradient(circle at 35% 35%,
            color-mix(in oklab, var(--foreground) 5%, #d5e6f0) 0%,
            color-mix(in oklab, var(--foreground) 20%, #a6cad0) 70%);
          opacity: 0;
          transform: scale(0.6) rotate(-45deg);
        }
        .theme-switch__track[data-dark="1"] .theme-switch__sun { opacity: 0; transform: scale(0.6) rotate(45deg); }
        .theme-switch__track[data-dark="1"] .theme-switch__moon { opacity: 1; transform: scale(1) rotate(0); }
        .theme-switch__moon .theme-switch__crater {
          position: absolute;
          background: color-mix(in oklab, var(--foreground) 35%, #a6cad0);
          border-radius: 50%;
          opacity: 0.85;
        }
        .theme-switch__moon .a { width: 5px; height: 5px; top: 5px;  left: 6px; }
        .theme-switch__moon .b { width: 3px; height: 3px; top: 12px; left: 14px; }
        .theme-switch__moon .c { width: 4px; height: 4px; top: 15px; left: 5px; }
        .theme-switch__stars {
          position: absolute; inset: 0; pointer-events: none;
          opacity: 0; transition: opacity 0.4s ease;
        }
        .theme-switch__track[data-dark="1"] .theme-switch__stars { opacity: 1; }
        .theme-switch__stars > span {
          position: absolute; width: 2px; height: 2px; border-radius: 50%;
          background: #e2f4ff;
          box-shadow: 0 0 4px #cfe9ff;
          animation: theme-star 2.2s ease-in-out infinite;
        }
        .theme-switch__stars > span:nth-child(1) { top: 6px;  left: 8px;  animation-delay: 0s; }
        .theme-switch__stars > span:nth-child(2) { top: 18px; left: 4px;  animation-delay: 0.4s; }
        .theme-switch__stars > span:nth-child(3) { top: 4px;  left: 22px; animation-delay: 0.8s; }
        .theme-switch__stars > span:nth-child(4) { top: 22px; left: 20px; animation-delay: 1.2s; }
        @keyframes theme-star { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .theme-switch__thumb, .theme-switch__sun, .theme-switch__moon,
          .theme-switch__stars, .theme-switch__stars > span { transition: none !important; animation: none !important; }
        }
      `}</style>
    </label>
  );
}
