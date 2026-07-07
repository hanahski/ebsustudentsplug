import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ArrowLeft, ScanLine, Search, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceHash } from "@/lib/device-hash";
import { toast } from "sonner";

export const Route = createFileRoute("/earn-credits/battle/scan")({
  component: ScanPage,
  head: () => ({ meta: [{ title: "Scan for Battle" }] }),
});

type Profile = { id: string; display_name: string | null; avatar_key: string | null };

function ScanPage() {
  const nav = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [challenging, setChallenging] = useState(false);
  const cancelRef = useRef<() => void>(() => {});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  // Realtime: watch pending match become coin_flip → navigate to play
  useEffect(() => {
    if (!matchId) return;
    const ch = supabase
      .channel("battle-scan-" + matchId)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "battle_matches", filter: `id=eq.${matchId}` },
        (payload: any) => {
          const s = payload.new?.status;
          if (s === "coin_flip" || s === "active") {
            nav({ to: "/earn-credits/battle/play/$matchId", params: { matchId } });
          }
        },
      )
      .subscribe();
    cancelRef.current = () => supabase.removeChannel(ch);
    return () => {
      supabase.removeChannel(ch);
    };
  }, [matchId, nav]);

  async function startRandom() {
    if (searching) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.rpc("battle_matchmake", { _device_hash: getDeviceHash() });
      if (error) throw error;
      const id = data as unknown as string;
      // If we joined as player_b, status already advanced → navigate immediately
      const { data: m } = await supabase.from("battle_matches").select("status,player_b").eq("id", id).maybeSingle();
      if (m && (m.status === "coin_flip" || m.status === "active")) {
        nav({ to: "/earn-credits/battle/play/$matchId", params: { matchId: id } });
        return;
      }
      setMatchId(id);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("INSUFFICIENT_CREDITS")) toast.error("You need at least 10 PC to battle.");
      else toast.error(msg);
      setSearching(false);
    }
  }

  async function cancelSearch() {
    if (matchId) {
      await supabase.rpc("battle_cancel", { _match_id: matchId });
    }
    setMatchId(null);
    setSearching(false);
  }

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim();
      if (term.length < 2) {
        setResults([]);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_key")
        .ilike("display_name", "%" + term + "%")
        .neq("id", uid ?? "")
        .limit(8);
      setResults((data as Profile[]) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, uid]);

  async function challenge(id: string, name: string) {
    if (challenging) return;
    setChallenging(true);
    try {
      const { data, error } = await supabase.rpc("battle_challenge", {
        _opponent: id,
        _device_hash: getDeviceHash(),
      });
      if (error) throw error;
      toast.success("Challenge sent to " + name);
      nav({ to: "/earn-credits/battle/play/$matchId", params: { matchId: data as unknown as string } });
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setChallenging(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <Link to="/earn-credits/battle" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Battle
        </Link>

        <div className="relative overflow-hidden rounded-3xl border p-8 text-center bg-gradient-to-br from-primary/10 via-card to-card shadow-card">
          <div className="absolute inset-0 opacity-60 [background:radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.3),transparent_60%)]" />
          <div className="relative">
            <div className="mx-auto w-28 h-28 rounded-full flex items-center justify-center relative">
              <div className={"absolute inset-0 rounded-full border-2 border-primary/40 " + (searching ? "animate-ping" : "")} />
              <div className={"absolute inset-2 rounded-full border border-primary/60 " + (searching ? "animate-spin [animation-duration:3s]" : "")} />
              <ScanLine className="w-10 h-10 text-primary relative" />
            </div>
            <h1 className="mt-4 text-xl font-bold font-display">
              {searching ? "Scanning for opponent…" : "Scan for Battle"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {searching
                ? "Matching you with a random player. Stake will be held once both sides pick heads or tails."
                : "Tap start to find a random 1v1 opponent for 10 PC."}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              {!searching ? (
                <Button size="lg" onClick={startRandom} className="rounded-full px-8">
                  <ScanLine className="w-4 h-4 mr-2" /> Start scan
                </Button>
              ) : (
                <Button size="lg" variant="outline" onClick={cancelSearch} className="rounded-full px-8">
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            <div className="font-semibold text-sm">Or challenge a friend</div>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by display name…"
              className="pl-9"
            />
          </div>
          {results.length > 0 && (
            <div className="space-y-1 max-h-64 overflow-auto">
              {results.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted">
                  <div className="text-sm font-medium truncate">{p.display_name || "Anonymous"}</div>
                  <Button size="sm" disabled={challenging} onClick={() => challenge(p.id, p.display_name || "player")}>
                    {challenging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Challenge"}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Matches with the same person more than 3 times in 24h are de-prioritised, and lopsided win-rates
            get flagged for admin review.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
