import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { resolveAccountUniversal } from "@/lib/paystack.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle, Landmark } from "lucide-react";

type Match = { bank_code: string; bank_name: string; account_name: string };

export function BankAccountResolver({
  value,
  onResolved,
}: {
  value?: { account_number?: string; bank_code?: string; bank_name?: string; account_name?: string };
  onResolved: (r: Match & { account_number: string }) => void;
}) {
  const resolveFn = useServerFn(resolveAccountUniversal);
  const [num, setNum] = useState(value?.account_number ?? "");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "one"; match: Match }
    | { kind: "many"; matches: Match[]; picked?: Match }
    | { kind: "none" }
    | { kind: "error"; msg: string }
  >(value?.account_name ? { kind: "one", match: {
    bank_code: value.bank_code ?? "",
    bank_name: value.bank_name ?? "",
    account_name: value.account_name ?? "",
  } } : { kind: "idle" });

  const canResolve = useMemo(() => /^\d{10}$/.test(num), [num]);

  useEffect(() => {
    if (!canResolve) {
      if (state.kind !== "idle") setState({ kind: "idle" });
      return;
    }
    let cancel = false;
    setState({ kind: "loading" });
    const t = setTimeout(async () => {
      try {
        const res = await resolveFn({ data: { account_number: num } });
        if (cancel) return;
        if (!res.matches.length) return setState({ kind: "none" });
        if (res.matches.length === 1) {
          const m = res.matches[0];
          setState({ kind: "one", match: m });
          onResolved({ ...m, account_number: num });
          return;
        }
        setState({ kind: "many", matches: res.matches });
      } catch (e: any) {
        if (!cancel) setState({ kind: "error", msg: e?.message ?? "Failed to resolve" });
      }
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [num, canResolve]);

  return (
    <div className="space-y-3">
      <div>
        <Label>Account number</Label>
        <Input
          value={num}
          onChange={(e) => setNum(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="10 digits · we'll find your bank"
          inputMode="numeric"
          className="text-lg tracking-wider font-mono"
        />
      </div>

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-xl p-3">
          <Loader2 className="w-4 h-4 animate-spin" />
          Searching every Nigerian bank for this number…
        </div>
      )}

      {state.kind === "none" && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <div>No bank recognises this account number. Double-check the digits.</div>
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex items-start gap-2 text-sm text-rose-700 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <div>{state.msg}</div>
        </div>
      )}

      {state.kind === "one" && state.match.account_name && (
        <div className="flex items-start gap-3 text-sm bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold uppercase tracking-wide">{state.match.account_name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Landmark className="w-3 h-3" />
              {state.match.bank_name}
            </div>
          </div>
        </div>
      )}

      {state.kind === "many" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Found {state.matches.length} banks with this number — tap yours:
          </p>
          <div className="grid gap-2 max-h-64 overflow-auto pr-1">
            {state.matches.map((m) => {
              const isPicked = state.picked?.bank_code === m.bank_code;
              return (
                <button
                  key={m.bank_code}
                  type="button"
                  onClick={() => {
                    setState({ kind: "many", matches: state.matches, picked: m });
                    onResolved({ ...m, account_number: num });
                  }}
                  className={`text-left border rounded-xl p-3 transition ${
                    isPicked ? "border-primary bg-primary/5" : "hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold text-sm uppercase">{m.account_name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Landmark className="w-3 h-3" />
                    {m.bank_name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
