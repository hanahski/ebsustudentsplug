import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Sparkles, Check, X, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminListPendingSubmissions,
  adminReviewNewsSubmission,
  adminListVerifiedSources,
  adminSearchSourceCandidates,
  adminSetSourceFlags,
} from "@/lib/ebsu-manual-post.functions";

export function NewsSubmissionsPanel() {
  const listPending = useServerFn(adminListPendingSubmissions);
  const review = useServerFn(adminReviewNewsSubmission);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["admin", "ebsu", "pending"],
    queryFn: () => listPending(),
    refetchInterval: 30_000,
  });

  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(id: string, decision: "approve" | "reject") {
    let reason: string | undefined;
    if (decision === "reject") {
      reason = window.prompt("Reason (optional, shown to the source)") ?? undefined;
    }
    setBusyId(id);
    try {
      await review({ data: { articleId: id, decision, reason } });
      toast.success(decision === "approve" ? "Approved & published" : "Rejected");
      qc.invalidateQueries({ queryKey: ["admin", "ebsu", "pending"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally { setBusyId(null); }
  }

  const rows = (q.data?.rows ?? []) as any[];
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h3 className="font-display font-black text-lg">Pending news submissions</h3>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} awaiting</span>
      </div>
      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">No pending submissions.</div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="p-3 rounded-xl border border-border bg-background/40">
              <div className="flex gap-3">
                {r.image_url ? (
                  <img src={r.image_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{r.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    by {r.submitter?.source_name || r.submitter?.display_name || "Unknown"}
                    {" · "}{new Date(r.created_at).toLocaleString()}
                  </div>
                  {r.summary && <div className="text-xs mt-1 line-clamp-2">{r.summary}</div>}
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={() => act(r.id, "approve")} disabled={busyId === r.id} className="flex-1">
                  <Check className="w-4 h-4 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => act(r.id, "reject")} disabled={busyId === r.id} className="flex-1">
                  <X className="w-4 h-4 mr-1" /> Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function VerifiedSourcesPanel() {
  const listSources = useServerFn(adminListVerifiedSources);
  const search = useServerFn(adminSearchSourceCandidates);
  const setFlags = useServerFn(adminSetSourceFlags);
  const qc = useQueryClient();

  const sources = useQuery({
    queryKey: ["admin", "ebsu", "sources"],
    queryFn: () => listSources(),
  });

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  async function runSearch() {
    if (query.trim().length < 1) return;
    setSearching(true);
    try {
      const r = await search({ data: { query: query.trim() } });
      setResults(r.rows);
    } catch (e: any) { toast.error(e?.message ?? "Search failed"); }
    finally { setSearching(false); }
  }

  async function update(userId: string, patch: any) {
    try {
      await setFlags({ data: { userId, ...patch } });
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin", "ebsu", "sources"] });
      if (results.length) runSearch();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  function nameFor(u: any) {
    return u.source_name || u.display_name || u.email || u.id.slice(0, 8);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-emerald-500" />
        <h3 className="font-display font-black text-lg">Verified sources</h3>
      </div>

      <div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, or source name"
              className="pl-9"
              onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }} />
          </div>
          <Button onClick={runSearch} disabled={searching}>
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </Button>
        </div>

        {results.length > 0 && (
          <ul className="mt-3 space-y-2">
            {results.map((u) => (
              <li key={u.id} className="p-3 rounded-xl border border-border flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{nameFor(u)}</div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  <div className="text-[10px] uppercase font-bold tracking-wide mt-1 flex gap-2">
                    {u.is_verified_source && <span className="text-emerald-500">verified</span>}
                    {u.is_trusted_source && <span className="text-yellow-400">trusted</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant={u.is_verified_source ? "secondary" : "default"}
                    onClick={() => {
                      const sourceName = u.is_verified_source
                        ? u.source_name
                        : (window.prompt("Source name (e.g. FEESSA TV, Campus Voice)", u.display_name || "") || "").trim() || null;
                      update(u.id, {
                        isVerifiedSource: !u.is_verified_source,
                        sourceName,
                        // revoke trusted when un-verifying
                        isTrustedSource: u.is_verified_source ? false : undefined,
                      });
                    }}>
                    <ShieldCheck className="w-4 h-4 mr-1" />
                    {u.is_verified_source ? "Revoke verify" : "Verify"}
                  </Button>
                  {u.is_verified_source && (
                    <Button size="sm" variant={u.is_trusted_source ? "secondary" : "outline"}
                      onClick={() => update(u.id, { isTrustedSource: !u.is_trusted_source })}>
                      <Star className="w-4 h-4 mr-1" />
                      {u.is_trusted_source ? "Untrust" : "Trust"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="text-xs font-bold uppercase text-muted-foreground mb-2">Active verified sources</div>
        {sources.isLoading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : (sources.data?.rows ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">No verified sources yet.</div>
        ) : (
          <ul className="space-y-2">
            {(sources.data?.rows ?? []).map((u: any) => (
              <li key={u.id} className="p-2 rounded-lg border border-border flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{nameFor(u)}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {u.email} {u.is_trusted_source && <span className="text-yellow-400 ml-1">· trusted (auto-publish)</span>}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => {
                  const name = window.prompt("Source name", u.source_name || "") ?? undefined;
                  if (name !== undefined) update(u.id, { sourceName: name });
                }}><Sparkles className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => update(u.id, { isTrustedSource: !u.is_trusted_source })}>
                  <Star className={`w-4 h-4 ${u.is_trusted_source ? "text-yellow-400 fill-yellow-400" : ""}`} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => update(u.id, { isVerifiedSource: false, isTrustedSource: false })}>
                  <X className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
