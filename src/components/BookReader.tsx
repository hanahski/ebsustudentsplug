import { lazy, Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";

// react-book-reader is browser-only (foliate-js touches window/DOM at import
// time). Load it lazily so it never lands in the SSR bundle.
const ReactReader = lazy(async () => {
  const mod = await import("react-book-reader");
  return { default: mod.ReactReader };
});

/**
 * Universal fullscreen book reader. Wraps react-book-reader (foliate-js) so
 * every format — EPUB, MOBI, KF8/AZW3, FB2, CBZ, PDF — opens in the same
 * high-quality reader with TOC, pagination, keyboard/touch navigation, and
 * per-book resume via localStorage.
 */
export function BookReader({
  url,
  title,
  bookId,
  onClose,
}: {
  url: string;
  title: string;
  bookId: string;
  onClose: () => void;
}) {
  const locKey = `book-loc:${bookId}`;
  const [location, setLocation] = useState<string | number | undefined>(undefined);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(locKey);
      if (saved) setLocation(saved);
    } catch { /* ignore */ }
  }, [locKey]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-background flex flex-col"
      style={{ zIndex: 2147482900 }}
      role="dialog"
      aria-label={`Reading ${title}`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b bg-card shrink-0">
        <p className="text-sm font-semibold font-display truncate pr-2">{title}</p>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close reader">
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 relative bg-white dark:bg-zinc-900">
        <Suspense
          fallback={
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading reader…
            </div>
          }
        >
          <ReactReader
            url={url}
            title={title}
            location={location as never}
            locationChanged={(loc: string) => {
              setLocation(loc);
              try { window.localStorage.setItem(locKey, loc); } catch { /* ignore */ }
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
