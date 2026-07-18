import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveStorageUrl } from "@/lib/storage-url";

type BookCoverProps = {
  title: string;
  author?: string | null;
  src?: string | null;
  className?: string;
  imageClassName?: string;
};

export function BookCover({ title, author, src, className, imageClassName }: BookCoverProps) {
  const [failed, setFailed] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(src ?? null);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setResolvedSrc(src ?? null);
    resolveStorageUrl(src).then((url) => {
      if (!alive) return;
      setResolvedSrc(url ?? src ?? null);
      if (url) {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
      }
    });
    return () => {
      alive = false;
    };
  }, [src]);

  if (resolvedSrc && !failed) {
    return (
      <div className={cn("overflow-hidden bg-muted", className)}>
        <img
          src={resolvedSrc}
          alt={`Cover of ${title}`}
          loading="eager"
          decoding="async"
          onError={() => setFailed(true)}
          className={cn("h-full w-full object-cover", imageClassName)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex overflow-hidden bg-gradient-to-br from-primary/90 via-accent to-primary bg-[length:200%_200%] gradient-pan p-3 text-primary-foreground",
        className,
      )}
      aria-busy="true"
      aria-label={`Loading cover for ${title || "book"}`}
    >
      {/* moving shine sweep to signal loading */}
      <div
        className="pointer-events-none absolute inset-0 -translate-x-full animate-[route-loader-slide_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent"
        aria-hidden="true"
      />
      <BookOpen className="absolute -right-3 -bottom-3 h-20 w-20 opacity-15" aria-hidden="true" />
      <div className="relative mt-auto min-w-0">
        <p className="line-clamp-4 text-sm font-bold leading-tight font-display shimmer-text [background:linear-gradient(90deg,rgba(255,255,255,0.75)_0%,#fff_50%,rgba(255,255,255,0.75)_100%)] [background-size:200%_100%] [-webkit-background-clip:text] [background-clip:text] text-transparent">
          {title || "Untitled book"}
        </p>
        {author && <p className="mt-2 line-clamp-2 text-[10px] opacity-80 text-primary-foreground">{author}</p>}
      </div>
    </div>
  );
}
