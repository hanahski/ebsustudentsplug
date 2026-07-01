// Unified media renderer for posts. Plays uploaded images, audio, video,
// or remote video links (YouTube, Vimeo, mp4 URLs, etc.) inline.
// - Only one media plays at a time across the whole app (global coordinator).
// - Video preview is large & responsive regardless of source resolution.
// - Native video/audio are downloadable; video has a fullscreen button.
import { useEffect, useId, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { Download, Maximize2, ExternalLink } from "lucide-react";
import { AudioAnimation, type AudioAnimationId } from "./AudioAnimations";
import { getSocialEmbed } from "@/lib/video-embed";
import { AvatarVisualizer } from "./AvatarVisualizer";
import { parseTimeFragment } from "@/lib/trim";
import { resolveStorageUrl } from "@/lib/storage-url";

/** Resolve a possibly-private Supabase storage URL to a signed URL once. */
function useResolvedUrl(url: string): string | null {
  const [resolved, setResolved] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    resolveStorageUrl(url).then((u) => { if (alive) setResolved(u ?? url); });
    return () => { alive = false; };
  }, [url]);
  return resolved;
}

/**
 * Lazy-mount a <video> only when it scrolls near the viewport. Cuts feed
 * jank because we don't keep dozens of video elements alive at once — each
 * <video> with preload="metadata" otherwise spawns a network request and
 * a decoder on render. Once mounted, the element fills its 16:9 container.
 */
function trimVideoPositions(max: number) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("video-pos:")) keys.push(k);
    }
    if (keys.length <= max) return;
    // Drop oldest by insertion order (localStorage doesn't track time, so this
    // is best-effort: remove the first overflow keys).
    for (let i = 0; i < keys.length - max; i++) localStorage.removeItem(keys[i]);
  } catch {}
}
function LazyVideo({
  videoRef,
  url,
  trim,
  postId,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  url: string;
  trim: { start?: number; end?: number };
  postId?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [muted, setMuted] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [seekHint, setSeekHint] = useState<null | { dir: "fwd" | "back"; key: number }>(null);
  const lastTapRef = useRef<number>(0);
  const hideTimerRef = useRef<number | null>(null);

  const resumeKey = `video-pos:${url}`;

  useEffect(() => {
    if (mounted) return;
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setMounted(true); return; }
    const io = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) { setMounted(true); io.disconnect(); break; } },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const v = videoRef.current;
    const box = boxRef.current;
    if (!v || !box) return;

    try {
      const saved = localStorage.getItem(resumeKey);
      if (saved) {
        const t = Number(saved);
        if (Number.isFinite(t) && t > 0) {
          const apply = () => { try { v.currentTime = t; } catch {} };
          if (v.readyState >= 1) apply();
          else v.addEventListener("loadedmetadata", apply, { once: true });
        }
      }
    } catch {}

    const persist = () => {
      try {
        if (!Number.isFinite(v.currentTime) || v.currentTime < 1) return;
        localStorage.setItem(resumeKey, String(v.currentTime));
        trimVideoPositions(60);
      } catch {}
    };
    const onTime = () => {
      setCurrent(v.currentTime);
      if (v.buffered.length) {
        try { setBuffered(v.buffered.end(v.buffered.length - 1)); } catch {}
      }
      persist();
    };
    const onMeta = () => setDuration(v.duration || 0);
    const onWait = () => setBuffering(true);
    const onPlay = () => { setBuffering(false); setPlaying(true); };
    const onPause = () => { setPlaying(false); persist(); };

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("pause", onPause);
    v.addEventListener("waiting", onWait);
    v.addEventListener("stalled", onWait);
    v.addEventListener("playing", onPlay);
    v.addEventListener("canplay", onPlay);
    v.addEventListener("play", onPlay);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) v.play().catch(() => {});
          else if (!v.paused) { persist(); v.pause(); }
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(box);

    const onHide = () => { if (!v.paused) { persist(); v.pause(); } };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", persist);

    return () => {
      io.disconnect();
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("waiting", onWait);
      v.removeEventListener("stalled", onWait);
      v.removeEventListener("playing", onPlay);
      v.removeEventListener("canplay", onPlay);
      v.removeEventListener("play", onPlay);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", persist);
      persist();
    };
  }, [mounted, videoRef, resumeKey]);

  const revealControls = () => {
    setShowControls(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setShowControls(false), 2400);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); setMuted(false); v.muted = false; }
    else v.pause();
    revealControls();
  };

  const doubleSeek = (dir: "fwd" | "back") => {
    const v = videoRef.current;
    if (!v) return;
    const delta = dir === "fwd" ? 5 : -5;
    v.currentTime = Math.max(0, Math.min((v.duration || 0), v.currentTime + delta));
    setSeekHint({ dir, key: Date.now() });
    window.setTimeout(() => setSeekHint(null), 500);
  };

  const onTapZone = (e: React.MouseEvent, zone: "left" | "center" | "right") => {
    e.stopPropagation();
    const now = Date.now();
    const isDouble = now - lastTapRef.current < 280;
    lastTapRef.current = now;
    if (isDouble && zone !== "center") { doubleSeek(zone === "right" ? "fwd" : "back"); return; }
    if (zone === "center") togglePlay();
    else revealControls();
  };

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const pct = Number(e.target.value) / 1000;
    v.currentTime = pct * duration;
    revealControls();
  };

  const fmt = (s: number) => {
    if (!Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${r}`;
  };

  const progressPct = duration ? (current / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={boxRef}
      className="relative w-full overflow-hidden rounded-2xl p-[2px] bg-gradient-to-br from-primary/60 via-accent/40 to-primary/60 shadow-card"
    >
      <div className="relative w-full overflow-hidden rounded-[14px] bg-black aspect-[9/16] max-h-[80vh] mx-auto">
        {mounted ? (
          <>
            <video src={url} muted playsInline preload="metadata" aria-hidden tabIndex={-1}
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-70 pointer-events-none" />
            <div className="absolute inset-0 bg-black/30 pointer-events-none" />
            <video
              ref={videoRef as React.RefObject<HTMLVideoElement>}
              src={url}
              playsInline
              muted={muted}
              loop={false}
              preload="auto"
              onLoadedMetadata={(e) => { if (trim.start) e.currentTarget.currentTime = trim.start; }}
              onTimeUpdate={(e) => {
                const el = e.currentTarget;
                if (trim.end !== undefined && el.currentTime >= trim.end) { el.pause(); el.currentTime = trim.start ?? 0; }
                if (trim.start !== undefined && el.currentTime < trim.start - 0.2) el.currentTime = trim.start;
              }}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ colorScheme: "dark", background: "transparent" }}
            />

            {/* Tap zones: left = -5s, center = play/pause, right = +5s (double-tap for seek) */}
            <div className="absolute inset-0 z-[5] grid grid-cols-3">
              <button type="button" aria-label="Seek back" onClick={(e) => onTapZone(e, "left")} className="h-full w-full" />
              <button type="button" aria-label="Play or pause" onClick={(e) => onTapZone(e, "center")} className="h-full w-full" />
              <button type="button" aria-label="Seek forward" onClick={(e) => onTapZone(e, "right")} className="h-full w-full" />
            </div>

            {/* Seek hint animation */}
            {seekHint && (
              <div key={seekHint.key} className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${seekHint.dir === "fwd" ? "right-6" : "left-6"} z-10 rounded-full bg-black/60 backdrop-blur px-3 py-2 text-white text-xs font-bold animate-scale-in`}>
                {seekHint.dir === "fwd" ? "+5s ⏩" : "⏪ -5s"}
              </div>
            )}

            {/* Center play glyph when paused */}
            {!playing && !buffering && (
              <div className="pointer-events-none absolute inset-0 z-[6] grid place-items-center">
                <div className="grid place-items-center h-16 w-16 rounded-full bg-black/45 backdrop-blur border border-white/25 shadow-lg animate-scale-in">
                  <svg viewBox="0 0 24 24" className="h-8 w-8 fill-white ml-1"><path d="M8 5v14l11-7z"/></svg>
                </div>
              </div>
            )}

            {buffering && (
              <div className="absolute inset-0 z-[7] grid place-items-center pointer-events-none">
                <div className="h-10 w-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              </div>
            )}

            {/* Bottom control bar — glass, progress + scrub + mute + open feed */}
            <div className={`absolute inset-x-0 bottom-0 z-10 px-3 pt-6 pb-2 bg-gradient-to-t from-black/70 via-black/40 to-transparent transition-opacity duration-200 ${showControls || !playing ? "opacity-100" : "opacity-0"}`}>
              {/* Buffered + progress track */}
              <div className="relative h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${bufferedPct}%` }} />
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent" style={{ width: `${progressPct}%` }} />
                <input
                  type="range" min={0} max={1000} step={1}
                  value={Math.round(progressPct * 10)}
                  onChange={onScrub}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                  aria-label="Video progress"
                />
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[11px] font-medium text-white/90">
                <span className="tabular-nums">{fmt(current)} / {fmt(duration)}</span>
                <div className="flex-1" />
                {postId && (
                  <a
                    href={`/watch/${postId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 px-2.5 py-1 backdrop-blur"
                    aria-label="Open full-screen viewer"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current"><path d="M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm16 0h-2v4h-4v2h6v-6z"/></svg>
                    Fullscreen feed
                  </a>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 backdrop-blur"
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted ? "🔇" : "🔊"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs text-white/60">
            <span>Loading video…</span>
          </div>
        )}
      </div>
    </div>
  );
}


type Props = {
  url: string;
  type?: string | null; // "image" | "video" | "audio" | mime fragment
  title?: string;
  /** Author avatar — drives the rich audio visualizer. */
  avatarKey?: string;
  /** Post id for the "Fullscreen feed" TikTok-style viewer. */
  postId?: string;
};

function parseAnim(url: string): string | null {
  const m = url.match(/[#?&]anim=([a-z]+)/);
  return m?.[1] ?? null;
}


function detectType(url: string, type?: string | null): "image" | "video" | "audio" | "unknown" {
  if (type === "image" || type === "video" || type === "audio") return type;
  const u = url.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/.test(u)) return "image";
  if (/\.(mp3|wav|m4a|ogg|aac|flac)(\?|$)/.test(u)) return "audio";
  if (/\.(mp4|webm|mov|mkv|avi)(\?|$)/.test(u)) return "video";
  if (/(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|twitch\.tv|facebook\.com|fb\.watch|instagram\.com|tiktok\.com|twitter\.com|x\.com|reddit\.com|streamable\.com|soundcloud\.com)/.test(u)) return "video";
  return "unknown";
}

// --- Global single-playback coordinator -----------------------------------
// All players (native <video>/<audio> AND embedded ReactPlayer) announce
// when they start through a window CustomEvent. Every other player listens
// and stops itself. This guarantees one-at-a-time playback even across
// different player implementations.
const MEDIA_EVENT = "studentsplug:media-play";

function announcePlay(id: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MEDIA_EVENT, { detail: { id } }));
}

function useSinglePlayback(
  ref: React.RefObject<HTMLMediaElement>,
  id: string,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onPlay = () => announcePlay(id);
    const onForeign = (e: Event) => {
      const other = (e as CustomEvent<{ id: string }>).detail?.id;
      if (other && other !== id && !el.paused) el.pause();
    };
    el.addEventListener("play", onPlay);
    window.addEventListener(MEDIA_EVENT, onForeign);
    return () => {
      el.removeEventListener("play", onPlay);
      window.removeEventListener(MEDIA_EVENT, onForeign);
    };
  }, [ref, id]);
}

/** Hook for non-native players (ReactPlayer). Returns a `playing` boolean
 *  that flips to false when another player starts. */
function useEmbedSingle(id: string) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const onForeign = (e: Event) => {
      const other = (e as CustomEvent<{ id: string }>).detail?.id;
      if (other && other !== id) setPlaying(false);
    };
    window.addEventListener(MEDIA_EVENT, onForeign);
    return () => window.removeEventListener(MEDIA_EVENT, onForeign);
  }, [id]);
  return {
    playing,
    onPlay: () => {
      announcePlay(id);
      setPlaying(true);
    },
    onPause: () => setPlaying(false),
    onEnded: () => setPlaying(false),
  };
}

function isNativeFile(url: string) {
  return /\.(mp4|webm|mov|mkv|avi|mp3|wav|m4a|ogg|aac|flac)(\?|$)/i.test(url);
}

export function MediaPlayer({ url: rawUrl, type, title, avatarKey }: Props) {
  const resolved = useResolvedUrl(rawUrl);
  const url = resolved ?? rawUrl;
  const kind = detectType(url, type);
  const playerId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  useSinglePlayback(videoRef as React.RefObject<HTMLMediaElement>, playerId);
  useSinglePlayback(audioRef as React.RefObject<HTMLMediaElement>, playerId);
  const embed = useEmbedSingle(playerId);

  if (!resolved) {
    return <div className="w-full aspect-video rounded-2xl bg-muted animate-pulse" aria-hidden />;
  }

  if (kind === "image") {

    return (
      <img
        src={url}
        alt={title ?? "media"}
        loading="lazy"
        className="w-full rounded-2xl border bg-muted object-contain max-h-[80vh]"
      />
    );
  }

  if (kind === "audio") {
    return (
      <AudioCard
        audioRef={audioRef as React.RefObject<HTMLAudioElement | null>}
        url={url}
        title={title}
        anim={parseAnim(url)}
        avatarKey={avatarKey}
      />
    );
  }


  if (kind === "video") {
    // Native files: use a real <video> so we control playback, fullscreen & download.
    if (isNativeFile(url)) {
      const trim = parseTimeFragment(url);
      const goFullscreen = () => {
        const el = videoRef.current;
        if (!el) return;
        if (el.requestFullscreen) el.requestFullscreen();
        // @ts-expect-error iOS Safari
        else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen();
      };
      return (
        <div className="space-y-2">
          <LazyVideo videoRef={videoRef} url={url} trim={trim} />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={goFullscreen}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Maximize2 className="w-3.5 h-3.5" /> Fullscreen
            </button>
            <a
              href={url}
              download
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Download className="w-3.5 h-3.5" /> Download video
            </a>
          </div>
        </div>
      );
    }
    // Social-platform embeds (Instagram, TikTok, Facebook, X, Reddit, …)
    const embedInfo = getSocialEmbed(url);
    if (embedInfo) {
      return (
        <div className="space-y-2">
          <div
            className="relative w-full overflow-hidden rounded-2xl border bg-black shadow-card"
            style={{ aspectRatio: String(embedInfo.aspect) }}
          >
            <iframe
              src={embedInfo.src}
              title={title ?? `${embedInfo.platform} video`}
              loading="lazy"
              allow={embedInfo.allow ?? "autoplay; encrypted-media; picture-in-picture; fullscreen"}
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 w-full h-full"
            />
          </div>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open on {embedInfo.platform}
          </a>
        </div>
      );
    }
    // YouTube / Vimeo / mp4 streams via ReactPlayer — TikTok-style portrait frame.
    return (
      <div className="relative w-full aspect-[9/16] max-h-[80vh] mx-auto overflow-hidden rounded-2xl border bg-black shadow-card">
        <ReactPlayer
          src={url}
          controls
          playing={embed.playing}
          onPlay={embed.onPlay}
          onPause={embed.onPause}
          onEnded={embed.onEnded}
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0 }}
        />
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block text-sm text-primary underline break-all"
    >
      {url}
    </a>
  );
}

/** Rich themed audio card: avatar visualizer on top + ambient scene behind
 *  + custom-styled native controls. */
function AudioCard({
  audioRef,
  url,
  title,
  anim,
  avatarKey,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  url: string;
  title?: string;
  anim?: string | null;
  avatarKey?: string;
}) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const p = () => setPlaying(true);
    const s = () => setPlaying(false);
    el.addEventListener("play", p);
    el.addEventListener("pause", s);
    el.addEventListener("ended", s);
    return () => {
      el.removeEventListener("play", p);
      el.removeEventListener("pause", s);
      el.removeEventListener("ended", s);
    };
  }, [audioRef]);
  return (
    <div className="relative rounded-2xl border bg-gradient-to-br from-primary/15 via-card to-accent/25 p-3 space-y-3 shadow-card overflow-hidden">
      {title && (
        <p className="text-xs font-semibold truncate flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          {title}
        </p>
      )}
      <div className="relative h-40 w-full rounded-xl overflow-hidden border border-primary/15">
        {/* Ambient backdrop scene */}
        <div className="absolute inset-0 opacity-50">
          <AudioAnimation
            id={(anim ?? "dance") as AudioAnimationId}
            playing={playing}
            className="h-full w-full bg-gradient-to-br from-primary/10 via-transparent to-accent/15"
          />
        </div>
        {/* Avatar character front and centre */}
        <AvatarVisualizer
          avatarKey={avatarKey ?? "boy-1"}
          playing={playing}
          size={88}
          className="absolute inset-0 h-full w-full bg-transparent"
        />
      </div>
      <audio ref={audioRef} controls src={url} className="w-full rounded-lg" style={{ colorScheme: "light dark" }}>
        Your browser does not support audio playback.
      </audio>
      <a href={url} download className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
        <Download className="w-3.5 h-3.5" /> Download audio
      </a>
    </div>
  );
}

