import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listPlatformSettings,
  upsertPlatformSetting,
  deletePlatformSetting,
} from "@/lib/platform-settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  KeyRound,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  ShieldCheck,
  Video,
  Landmark,
} from "lucide-react";

const GROUPS = [
  {
    id: "paystack",
    label: "Paystack",
    icon: Landmark,
    desc: "Powers the bank-account resolver and future payouts.",
    hint: "Get from dashboard.paystack.com → Settings → API Keys & Webhooks.",
    keys: [
      { key: "PAYSTACK_PUBLIC_KEY", label: "Public key", placeholder: "pk_live_… or pk_test_…" },
      { key: "PAYSTACK_SECRET_KEY", label: "Secret key", placeholder: "sk_live_… or sk_test_…" },
    ],
  },
  {
    id: "mux",
    label: "Mux Video",
    icon: Video,
    desc: "Streams banner videos without lag using adaptive HLS.",
    hint: "Get from dashboard.mux.com → Settings → Access Tokens (needs Video read + write).",
    keys: [
      { key: "MUX_TOKEN_ID", label: "Token ID", placeholder: "abcd1234-…" },
      { key: "MUX_TOKEN_SECRET", label: "Token secret", placeholder: "long secret string" },
    ],
  },
] as const;

export function AdminIntegrations() {
  const listFn = useServerFn(listPlatformSettings);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-integrations"],
    queryFn: () => listFn(),
  });

  const upsertFn = useServerFn(upsertPlatformSetting);
  const deleteFn = useServerFn(deletePlatformSetting);

  const upsert = useMutation({
    mutationFn: (v: { key: string; value: string }) => upsertFn({ data: v as any }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-integrations"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });
  const del = useMutation({
    mutationFn: (key: string) => deleteFn({ data: { key: key as any } }),
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["admin-integrations"] });
    },
  });

  const rows = new Map((q.data ?? []).map((r: any) => [r.key, r]));

  return (
    <div className="space-y-5">
      <div className="bg-card border rounded-2xl p-4">
        <div className="flex items-center gap-2 text-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>
            Keys are stored server-side and never leave the backend. Secret values are shown only as
            a preview after saving.
          </span>
        </div>
      </div>

      {GROUPS.map((g) => (
        <section key={g.id} className="bg-card border rounded-2xl p-5 space-y-4">
          <header className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/80 to-primary text-primary-foreground flex items-center justify-center shrink-0">
              <g.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-lg">{g.label}</h3>
              <p className="text-sm text-muted-foreground">{g.desc}</p>
              <p className="text-[11px] text-muted-foreground/80 mt-1">{g.hint}</p>
            </div>
          </header>

          <div className="grid gap-4">
            {g.keys.map((k) => (
              <KeyRow
                key={k.key}
                row={rows.get(k.key)}
                label={k.label}
                placeholder={k.placeholder}
                onSave={(value) => upsert.mutate({ key: k.key, value })}
                onDelete={() => del.mutate(k.key)}
                saving={upsert.isPending && upsert.variables?.key === k.key}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function KeyRow({
  row,
  label,
  placeholder,
  onSave,
  onDelete,
  saving,
}: {
  row: any;
  label: string;
  placeholder: string;
  onSave: (v: string) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const configured = !!row?.configured;

  return (
    <div className="border rounded-xl p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <Label className="flex items-center gap-2 text-sm">
          <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
          {label}
        </Label>
        {configured ? (
          <span className="text-[11px] font-semibold text-emerald-600 inline-flex items-center gap-1">
            <Check className="w-3 h-3" /> Configured
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1">
            <X className="w-3 h-3" /> Not set
          </span>
        )}
      </div>

      {configured && (
        <div className="text-xs text-muted-foreground mb-2 font-mono">
          {reveal && row?.value ? row.value : row?.preview}
          {row?.value && (
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="ml-2 text-primary hover:underline"
            >
              {reveal ? (
                <EyeOff className="w-3 h-3 inline" />
              ) : (
                <Eye className="w-3 h-3 inline" />
              )}
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          type={reveal ? "text" : "password"}
          placeholder={configured ? "Enter new value to rotate…" : placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="font-mono text-sm"
        />
        <Button
          size="sm"
          onClick={() => {
            if (!value.trim()) return;
            onSave(value.trim());
            setValue("");
          }}
          disabled={saving || value.trim().length < 4}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : configured ? "Rotate" : "Save"}
        </Button>
        {configured && (
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-rose-600">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
