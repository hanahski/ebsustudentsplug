import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Heart, MessageCircle, Share2, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveStorageUrl } from "@/lib/storage-url";

export const Route = createFileRoute("/watch/$id")({
  head: () => ({
    meta: [
      { title: "Watch — StudentsPlug" },
      { name: "description", content: "Full-screen vertical video feed." },
    ],
  }),
  component: WatchRoute,
});

type Clip = {
  id: string;
  media_url: string | null;
  title: string | null;
  body: string | null;
  like_count: number;
  comment_count: number;
  author?: { display_name: string | null; avatar_key: string | null } | null;
};

function useClips(startId: string) {
  return useQuery({
    queryKey: ["watch-feed", startId],
    queryFn: async (): Promise<Clip[]> => {
      // Anchor post first, then fill with the newest 30 video posts.
      const { data: anchor } = await supabase
        .from("posts")
        .select("id,title,body,media_url,media_type,like_count,comment_count,author:profiles!posts_author_id_fkey(display_name,avatar_key)")
        .eq("id", startId)
        .maybeSingle();
      const { data: rest } = await supabase
        .from("posts")
        .select("id,title,body,media_url,media_type,like_count,comment_count,author:profiles!posts_author_id_fkey(display_name,avatar_key)")
        .eq("media_type", "video")
        .not("media_url", "is", null)
        .neq("id", startId)
        .order("created_at", { ascending: false })
        .limit(30);
      const combined = [anchor, ...(rest ?? [])].filter(Boolean) as any[];
      return combined as Clip[];
    },
    staleTime: 60_000,
  });
}

function VerticalClip({
  clip,
  active,
  muted,
  onToggleMute,
}: {
  clip: Clip;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!clip.media_url) return;
    let alive = true;
    resolveStorageUrl(clip.media_url).then((u) => { if (alive) setSrc(u ?? clip.media_url); });
    return () => { alive = false; };
  }, [clip.media_url]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) { v.currentTime = 0; v.play().catch(() => {}); }
    else { v.pause(); }
  }, [active, src]);

  return (
    <section className="relative h-[100dvh] w-full snap-start bg-black overflow-hidden">
      {src && (
        <video
          ref={ref}
          src={src}
          loop
          muted={muted}
          playsInline
          preload={active ? "auto" : "metadata"}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => { setBuffering(false); setPaused(false); }}
          onPause={() => setPaused(true)}
          onClick={() => {
            const v = ref.current; if (!v) return;
            if (v.paused) v.play().catch(() => {}); else v.pause();
          }}
          className="absolute inset-0 h-full w-full object-contain"
        />
      )}
      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

      {buffering && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-12 w-12 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      )}
      {paused && !buffering && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="grid place-items-center h-20 w-20 rounded-full bg-black/45 backdrop-blur border border-white/30">
            <svg viewBox="0 0 24 24" className="h-10 w-10 fill-white ml-1"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      )}

      {/* Right rail actions */}
      <div className="absolute right-3 bottom-28 z-10 flex flex-col items-center gap-4 text-white">
        <button onClick={onToggleMute} className="grid place-items-center h-11 w-11 rounded-full bg-white/10 border border-white/20 backdrop-blur" aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <Link to="/post/$id" params={{ id: clip.id }} className="grid place-items-center h-11 w-11 rounded-full bg-white/10 border border-white/20 backdrop-blur">
          <Heart className="h-5 w-5" />
        </Link>
        <div className="text-[10px] font-bold tabular-nums -mt-3">{clip.like_count ?? 0}</div>
        <Link to="/post/$id" params={{ id: clip.id }} className="grid place-items-center h-11 w-11 rounded-full bg-white/10 border border-white/20 backdrop-blur">
          <MessageCircle className="h-5 w-5" />
        </Link>
        <div className="text-[10px] font-bold tabular-nums -mt-3">{clip.comment_count ?? 0}</div>
        <button
          onClick={() => {
            const url = `${window.location.origin}/post/${clip.id}`;
            if (navigator.share) navigator.share({ url }).catch(() => {});
            else navigator.clipboard?.writeText(url);
          }}
          className="grid place-items-center h-11 w-11 rounded-full bg-white/10 border border-white/20 backdrop-blur"
          aria-label="Share"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>

      {/* Bottom caption */}
      <div className="absolute inset-x-0 bottom-6 z-10 px-4 pr-20 text-white">
        <div className="text-sm font-bold truncate">@{clip.author?.display_name ?? "student"}</div>
        {clip.title && <div className="mt-1 text-sm font-semibold line-clamp-2">{clip.title}</div>}
        {clip.body && <div className="mt-0.5 text-xs opacity-85 line-clamp-2">{clip.body}</div>}
      </div>
    </section>
  );
}

function WatchRoute() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: clips = [] } = useClips(id);
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Detect the currently-visible clip via IntersectionObserver on each section.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const sections = Array.from(container.querySelectorAll<HTMLElement>("[data-clip]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.7) {
            const i = Number((e.target as HTMLElement).dataset.idx);
            if (Number.isFinite(i)) setActiveIdx(i);
          }
        }
      },
      { root: container, threshold: [0, 0.7, 1] },
    );
    for (const s of sections) io.observe(s);
    return () => io.disconnect();
  }, [clips.length]);

  const list = useMemo(() => clips.filter((c) => !!c.media_url), [clips]);

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      <button
        onClick={() => navigate({ to: "/" })}
        className="absolute top-4 left-4 z-20 grid place-items-center h-10 w-10 rounded-full bg-white/10 border border-white/20 backdrop-blur"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div
        ref={containerRef}
        className="h-[100dvh] w-full overflow-y-auto snap-y snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {list.length === 0 && (
          <div className="h-full grid place-items-center text-sm opacity-70">Loading clips…</div>
        )}
        {list.map((c, i) => (
          <div key={c.id} data-clip data-idx={i}>
            <VerticalClip
              clip={c}
              active={i === activeIdx}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
