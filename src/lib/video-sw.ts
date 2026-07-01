// Registers the video-caching service worker and exposes helpers.
// Safe on SSR (no-ops when window is undefined).

let registered = false;

export function registerVideoSW() {
  if (typeof window === "undefined") return;
  if (registered) return;
  if (!("serviceWorker" in navigator)) return;
  registered = true;
  // Register after load so it doesn't compete with first paint.
  const doRegister = () => {
    navigator.serviceWorker
      .register("/video-sw.js", { scope: "/" })
      .catch(() => {
        // Silent — SW is a progressive enhancement.
      });
  };
  if (document.readyState === "complete") doRegister();
  else window.addEventListener("load", doRegister, { once: true });
}

/** Ask the service worker to prefetch a video URL (next-in-feed). */
export function prefetchVideo(url: string | null | undefined) {
  if (!url || typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => {
      const target = reg.active || navigator.serviceWorker.controller;
      target?.postMessage({ type: "prefetch-video", url });
    })
    .catch(() => {});
}
