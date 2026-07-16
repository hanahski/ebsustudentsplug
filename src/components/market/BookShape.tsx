import { ReactNode } from "react";

/**
 * Wraps a book cover in a card that actually looks like a book:
 *  - a darker "spine" strip on the left
 *  - a subtle inner shadow that hints at page depth on the right
 *  - a soft ground shadow so it sits like an object, not a tile
 *
 * The children slot is the cover (image or fallback) that fills the "front".
 */
export function BookShape({
  children,
  className = "",
  spineTone = "from-emerald-800 via-emerald-700 to-emerald-900",
}: {
  children: ReactNode;
  className?: string;
  spineTone?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {/* ground shadow */}
      <div className="absolute -bottom-1.5 left-1 right-1 h-2 rounded-full bg-black/25 blur-md" aria-hidden />
      <div
        className="relative w-full h-full overflow-hidden rounded-[3px] rounded-r-md shadow-[0_4px_12px_-6px_rgba(0,0,0,0.35)]"
        style={{ perspective: "600px" }}
      >
        {/* spine */}
        <div
          className={`absolute inset-y-0 left-0 w-[7%] min-w-[6px] bg-gradient-to-b ${spineTone} shadow-[inset_-2px_0_3px_rgba(0,0,0,0.35)] z-10`}
          aria-hidden
        />
        {/* pages / fore-edge on the right */}
        <div
          className="absolute inset-y-1 right-0 w-[3px] bg-gradient-to-b from-white/70 via-white/40 to-white/70 z-10"
          aria-hidden
        />
        <div
          className="absolute inset-y-1 right-[3px] w-px bg-black/10 z-10"
          aria-hidden
        />
        {/* cover face */}
        <div className="absolute inset-0 pl-[7%]">
          {children}
        </div>
        {/* glossy sheen */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/5 to-white/15" aria-hidden />
      </div>
    </div>
  );
}
