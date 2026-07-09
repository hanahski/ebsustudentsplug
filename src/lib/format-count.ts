// Compact number formatter for like/comment/view counts (e.g. 1.2K, 3.4M).
export function formatCount(n: number | null | undefined): string {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v < 1000) return String(v);
  if (v < 1_000_000) return (v / 1000).toFixed(v < 10_000 ? 1 : 0).replace(/\.0$/, "") + "K";
  if (v < 1_000_000_000) return (v / 1_000_000).toFixed(v < 10_000_000 ? 1 : 0).replace(/\.0$/, "") + "M";
  return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
}
