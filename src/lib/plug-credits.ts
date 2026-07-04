/** Plug Credit formatting — up to 3 decimals (0.001), trims trailing zeros. */
export const PC_LABEL = "Plug Credits";
export const PC_SHORT = "PC";

export function formatPC(value: number | string | null | undefined, opts: { withLabel?: boolean; short?: boolean } = {}): string {
  const n = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  if (!Number.isFinite(n)) return opts.withLabel ? `0 ${opts.short ? PC_SHORT : PC_LABEL}` : "0";
  // Show up to 3 decimals, strip trailing zeros.
  const s = n.toFixed(3).replace(/\.?0+$/, "");
  const num = s === "" ? "0" : s;
  if (opts.withLabel) return `${num} ${opts.short ? PC_SHORT : PC_LABEL}`;
  return num;
}
