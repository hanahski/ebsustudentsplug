import { useEffect } from "react";
import { registerVideoSW } from "@/lib/video-sw";

/**
 * Registers the video-caching service worker once, after mount.
 * Rendered inside the client-only Root component so it never runs during SSR.
 */
export function VideoSWRegister() {
  useEffect(() => {
    registerVideoSW();
  }, []);
  return null;
}
