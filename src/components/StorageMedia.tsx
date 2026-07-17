// Drop-in <img>/<video> that lazily signs Supabase storage URLs so private
// buckets render in the feed without changing policies.
import { useEffect, useState } from "react";
import { resolveStorageUrl, isVideoUrl } from "@/lib/storage-url";

type Props = {
  url: string | null | undefined;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
  /** Force a particular renderer; otherwise auto-detect by extension. */
  as?: "img" | "video";
  /** Render videos as silent preview (no controls, muted) — for feed cards. */
  videoAsPoster?: boolean;
};

export function StorageMedia({ url, alt, className, loading = "eager", as, videoAsPoster }: Props) {
  const [resolved, setResolved] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    resolveStorageUrl(url).then((u) => { if (alive) setResolved(u); });
    return () => { alive = false; };
  }, [url]);
  if (!resolved) return <div className={className} aria-hidden />;
  const kind = as ?? (isVideoUrl(resolved) ? "video" : "img");
  if (kind === "video") {
    if (videoAsPoster) {
      return (
        <video
          src={`${resolved}#t=0.1`}
          className={className}
          muted
          playsInline
          preload="metadata"
        />
      );
    }
    return (
      <video
        src={resolved}
        className={className}
        controls
        playsInline
        preload="metadata"
      />
    );
  }
  return <img src={resolved} alt={alt ?? ""} loading={loading} className={className} />;
}
