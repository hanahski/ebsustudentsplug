import { useEffect, useState } from "react";
import { ReactReader } from "react-reader";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

/**
 * Fullscreen EPUB reader modal. Persists last location per bookId in
 * localStorage so users resume where they left off.
 */
export function EpubReader({
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
  const locKey = `epub-loc:${bookId}`;
  const [location, setLocation] = useState<string | number | null>(null);

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
      <div className="flex-1 relative">
        <ReactReader
          url={url}
          location={location}
          locationChanged={(loc: string) => {
            setLocation(loc);
            try { window.localStorage.setItem(locKey, loc); } catch { /* ignore */ }
          }}
          epubOptions={{ flow: "paginated" }}
          title={title}
        />
      </div>
    </div>
  );
}
