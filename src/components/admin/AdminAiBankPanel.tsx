// AI Bank status dashboard for admins — battery UI, health, latency, local mute toggles.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { aiBankStatus, type BankSource } from "@/lib/ai-bank-status.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Activity, RefreshCw, BatteryFull, Zap, AlertTriangle, CheckCircle2,
  Copy, Timer, Search, ArrowDownUp, Circle, Waves, Signal,
} from "lucide-react";
import { toast } from "sonner";

const MUTE_KEY = "ai-bank-muted-v1";
const REFRESH_KEY = "ai-bank-refresh-v1";

function loadMuted(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(MUTE_KEY) || "{}"); } catch { return {}; }
}
function saveMuted(v: Record<string, boolean>) {
  try { localStorage.setItem(MUTE_KEY, JSON.stringify(v)); } catch {}
}

// Latency → health score 0..100. <300ms = 100, >1500ms = 0. Down = 0.
function healthScore(s: BankSource): number {
  if (!s.ok || !s.enabled) return 0;
  const l = s.latency_ms ?? 1500;
  if (l <= 300) return 100;
  if (l >= 1500) return 15;
  return Math.round(100 - ((l - 300) / 1200) * 85);
}

function healthColor(pct: number, muted: boolean) {
  if (muted) return "bg-muted-foreground/40";
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 40) return "bg-amber-500";
  if (pct > 0) return "bg-orange-500";
  return "bg-red-500";
}

function relTime(iso: string | null) {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function AdminAiBankPanel() {
  const fetchStatus = useServerFnTS(aiBankStatus);
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [autoRefresh, setAutoRefresh] = useState<boolean>(() => localStorage.getItem(REFRESH_KEY) !== "off");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"label" | "latency" | "health">("health");
  const [history, setHistory] = useState<Record<string, number[]>>({});

  useEffect(() => { setMuted(loadMuted()); }, []);
  useEffect(() => { localStorage.setItem(REFRESH_KEY, autoRefresh ? "on" : "off"); }, [autoRefresh]);

  const { data, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["ai-bank-status"],
    queryFn: () => fetchStatus({}),
    refetchInterval: autoRefresh ? 10_000 : false,
  });

  // Track latency history for sparklines (keep last 20 per source).
  useEffect(() => {
    if (!data?.sources) return;
    setHistory((prev) => {
      const next = { ...prev };
      for (const s of data.sources) {
        const arr = next[s.label] ? [...next[s.label]] : [];
        arr.push(s.latency_ms ?? 0);
        if (arr.length > 20) arr.shift();
        next[s.label] = arr;
      }
      return next;
    });
  }, [data?.probedAt]);

  const toggleMute = (label: string) => {
    setMuted((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      saveMuted(next);
      return next;
    });
  };

  const sources = useMemo(() => {
    const list = (data?.sources ?? []).filter((s) =>
      !query || s.label.toLowerCase().includes(query.toLowerCase()),
    );
    const scored = list.map((s) => ({ s, score: healthScore(s), m: !!muted[s.label] }));
    scored.sort((a, b) => {
      if (sort === "label") return a.s.label.localeCompare(b.s.label);
      if (sort === "latency") return (a.s.latency_ms ?? 9999) - (b.s.latency_ms ?? 9999);
      return b.score - a.score;
    });
    return scored;
  }, [data?.sources, query, sort, muted]);

  const total = data?.sources?.length ?? 0;
  const upCount = data?.sources?.filter((s) => s.ok && s.enabled).length ?? 0;
  const avgLatency = total
    ? Math.round((data!.sources.reduce((n, s) => n + (s.latency_ms ?? 0), 0) / total))
    : 0;
  const overall = total ? Math.round(sources.reduce((n, x) => n + x.score, 0) / sources.length) : 0;

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="bg-card border rounded-3xl p-5 shadow-card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold font-display flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> AI Bank Health
            </h2>
            <p className="text-sm text-muted-foreground">
              Live status of every routing source powering Plug AI.
              {data?.probedAt && <> Last probe {relTime(data.probedAt)}.</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs bg-muted px-3 py-1.5 rounded-full">
              <Circle className={`w-2 h-2 fill-current ${autoRefresh ? "text-emerald-500" : "text-muted-foreground"}`} />
              Auto refresh
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            </div>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <SummaryTile icon={Signal} label="Sources online" value={`${upCount}/${total}`} />
          <SummaryTile icon={Zap} label="Avg latency" value={`${avgLatency}ms`} />
          <SummaryTile icon={BatteryFull} label="Fleet health" value={`${overall}%`} />
          <SummaryTile icon={Timer} label="Round trip" value={`${data?.roundTripMs ?? 0}ms`} />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-full border bg-background text-sm"
            placeholder="Search source…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => setSort(sort === "health" ? "latency" : sort === "latency" ? "label" : "health")}
          className="px-3 py-2 rounded-full border text-sm inline-flex items-center gap-1.5 bg-background"
        >
          <ArrowDownUp className="w-3.5 h-3.5" /> Sort: {sort}
        </button>
      </div>

      {/* Battery grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {isFetching && !data && <p className="text-sm text-muted-foreground">Probing bank…</p>}
        {sources.map(({ s, score, m }) => (
          <BatteryCard
            key={s.label}
            source={s}
            score={score}
            muted={m}
            history={history[s.label] ?? []}
            onToggle={() => toggleMute(s.label)}
            onCopy={() => { navigator.clipboard?.writeText(s.label); toast.success("Copied"); }}
          />
        ))}
        {!isFetching && sources.length === 0 && (
          <p className="text-sm text-muted-foreground">No sources match.</p>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Enable/disable toggles are stored locally for your admin view. To globally suspend a source,
        update it directly in the AI Bank project.
      </p>
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-muted/40 border rounded-2xl p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-lg font-bold font-display">{value}</div>
    </div>
  );
}

function BatteryCard({
  source, score, muted, history, onToggle, onCopy,
}: {
  source: BankSource; score: number; muted: boolean; history: number[];
  onToggle: () => void; onCopy: () => void;
}) {
  const effectiveScore = muted ? 0 : score;
  const bars = 6;
  const filled = Math.round((effectiveScore / 100) * bars);
  const color = healthColor(effectiveScore, muted);
  const cooldownActive = source.cooldown_until && new Date(source.cooldown_until) > new Date();

  const label = muted ? "Muted" : !source.enabled ? "Disabled" : !source.ok ? "Down" : effectiveScore >= 75 ? "Excellent" : effectiveScore >= 40 ? "OK" : "Poor";
  const StatusIcon = !source.ok || muted ? AlertTriangle : CheckCircle2;

  return (
    <div className={`bg-card border rounded-2xl p-4 shadow-card transition ${muted ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{source.label}</h3>
            <button onClick={onCopy} className="text-muted-foreground hover:text-foreground" title="Copy">
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <div className={`inline-flex items-center gap-1 text-xs mt-0.5 ${
            muted ? "text-muted-foreground" : source.ok ? "text-emerald-600" : "text-red-600"
          }`}>
            <StatusIcon className="w-3 h-3" /> {label} · HTTP {source.status || "—"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{muted ? "off" : "on"}</span>
          <Switch checked={!muted} onCheckedChange={onToggle} />
        </div>
      </div>

      {/* Battery UI */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex items-center flex-1">
          <div className="flex-1 flex items-center gap-[3px] p-1.5 rounded-lg border-2 border-foreground/60 bg-background">
            {Array.from({ length: bars }).map((_, i) => (
              <div
                key={i}
                className={`h-6 flex-1 rounded-sm transition-all ${i < filled ? color : "bg-muted"}`}
                style={{ opacity: i < filled ? 1 - (i * 0.05) : 0.35 }}
              />
            ))}
          </div>
          <div className="w-1.5 h-3 rounded-r-sm bg-foreground/60 ml-[2px]" />
        </div>
        <div className="text-right min-w-[56px]">
          <div className="text-lg font-bold font-display leading-none">{effectiveScore}%</div>
          <div className="text-[10px] text-muted-foreground">{source.latency_ms ?? 0}ms</div>
        </div>
      </div>

      {/* Sparkline */}
      {history.length > 1 && (
        <div className="mt-3 flex items-center gap-1 h-6" title="Recent latency">
          <Waves className="w-3 h-3 text-muted-foreground" />
          {history.map((v, i) => {
            const h = Math.min(100, Math.max(6, ((v || 0) / 1500) * 100));
            const c = v > 1200 ? "bg-red-500" : v > 700 ? "bg-amber-500" : "bg-emerald-500";
            return <div key={i} className={`flex-1 rounded-sm ${c}`} style={{ height: `${h}%` }} />;
          })}
        </div>
      )}

      {/* Meta line */}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>Last OK: {relTime(source.last_ok_at)}</span>
        {cooldownActive && (
          <span className="text-amber-600 inline-flex items-center gap-1">
            <Timer className="w-3 h-3" /> Cooldown until {new Date(source.cooldown_until!).toLocaleTimeString()}
          </span>
        )}
        {source.last_error && (
          <span className="text-red-600 truncate max-w-full" title={source.last_error}>
            Err: {source.last_error}
          </span>
        )}
      </div>
    </div>
  );
}
