import { ReactNode } from "react";

/**
 * Ticket-shaped wrapper: two semicircular notches on the sides + a dashed
 * perforation line, produced with CSS masks so the notch reveals whatever
 * page background sits behind the card (works on any theme).
 *
 * Use as a horizontal ticket card. The left "stub" holds the price / icon,
 * the right side holds the event info.
 */
export function TicketShape({
  children,
  className = "",
  notchAt = "34%",
}: {
  children: ReactNode;
  className?: string;
  /** Where the perforation notch sits, from the left edge. */
  notchAt?: string;
}) {
  // Two circular subtractive masks (one on each edge of the notch line) plus
  // one full rectangle so the rest of the card renders normally.
  const maskCommon =
    "radial-gradient(circle 10px at " +
    notchAt +
    " 0%, transparent 98%, black 100%)," +
    "radial-gradient(circle 10px at " +
    notchAt +
    " 100%, transparent 98%, black 100%)";

  return (
    <div
      className={`relative ${className}`}
      style={{
        WebkitMaskImage: maskCommon,
        maskImage: maskCommon,
        WebkitMaskComposite: "source-in",
        maskComposite: "intersect",
        filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.15))",
      }}
    >
      {children}
      {/* perforation dashed line */}
      <div
        className="pointer-events-none absolute top-3 bottom-3 border-l-2 border-dashed border-border/70"
        style={{ left: notchAt }}
        aria-hidden
      />
    </div>
  );
}
