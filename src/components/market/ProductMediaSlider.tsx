import { useRef, useState, useEffect } from "react";
import { StorageMedia } from "@/components/StorageMedia";
import { isVideoUrl } from "@/lib/storage-url";
import { Package, Play } from "lucide-react";

/**
 * Horizontal snap-scroll media slider for a product card. Supports images and
 * videos (auto-detected inside StorageMedia). Shows dot indicators and swipe
 * hint arrows on the sides.
 */
export function ProductMediaSlider({
  photos,
  title,
  aspect = "aspect-[4/5]",
}: {
  photos: (string | null | undefined)[] | null | undefined;
  title: string;
  aspect?: string;
}) {
  const list = (photos ?? []).filter(Boolean) as string[];
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      setActive(idx);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [list.length]);

  if (list.length === 0) {
    return (
      <div className={`w-full ${aspect} bg-muted flex items-center justify-center`}>
        <Package className="w-12 h-12 opacity-30" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className={`w-full ${aspect} overflow-x-auto snap-x snap-mandatory flex scrollbar-none scroll-smooth`}
      >
        {list.map((url, i) => (
          <div key={i} className="snap-start shrink-0 w-full h-full bg-muted">
            <StorageMedia
              url={url}
              alt={`${title} ${i + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
      {list.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1 pointer-events-none">
          {list.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-4 bg-white" : "w-1.5 bg-white/60"
              } shadow`}
            />
          ))}
        </div>
      )}
      {list.length > 1 && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur text-white text-[10px] font-semibold">
          {active + 1}/{list.length}
        </div>
      )}
    </div>
  );
}
