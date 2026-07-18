import { useEffect, useRef } from "react";

const AD_CLIENT = "ca-pub-3085170424128475";
const LOADER_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;

function ensureLoader() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]`)) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = LOADER_SRC;
  s.crossOrigin = "anonymous";
  document.head.appendChild(s);
}

/**
 * In-article AdSense unit. Only rendered inside news articles.
 * Uses auto-relaxed format so it adapts to any container width.
 */
export function InArticleAd({ slot }: { slot?: string }) {
  const insRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    ensureLoader();
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* noop */
    }
  }, []);

  return (
    <div className="my-6 not-prose">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">Advertisement</div>
      <ins
        ref={insRef as any}
        className="adsbygoogle"
        style={{ display: "block", textAlign: "center" }}
        data-ad-layout="in-article"
        data-ad-format="fluid"
        data-ad-client={AD_CLIENT}
        {...(slot ? { "data-ad-slot": slot } : { "data-ad-slot": "0000000000" })}
      />
    </div>
  );
}
