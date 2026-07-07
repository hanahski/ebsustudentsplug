// Lightweight device fingerprint used only for Battle anti-collusion.
// Not a security control — just helps us avoid re-matching the same device.
export function getDeviceHash(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const KEY = "sp:device-hash";
    const cached = localStorage.getItem(KEY);
    if (cached) return cached;
    const parts = [
      navigator.userAgent,
      navigator.language,
      String(screen.width) + "x" + String(screen.height),
      String(new Date().getTimezoneOffset()),
      String(navigator.hardwareConcurrency || 0),
    ].join("|");
    let h = 0;
    for (let i = 0; i < parts.length; i++) h = (h * 31 + parts.charCodeAt(i)) | 0;
    const rand = Math.random().toString(36).slice(2, 8);
    const hash = Math.abs(h).toString(36) + "-" + rand;
    localStorage.setItem(KEY, hash);
    return hash;
  } catch {
    return "anon-" + Math.random().toString(36).slice(2, 10);
  }
}
