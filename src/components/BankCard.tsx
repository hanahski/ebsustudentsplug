import { Landmark, ShieldCheck, Pencil } from "lucide-react";

export function BankCard({
  bankName,
  accountName,
  accountNumber,
  onEdit,
}: {
  bankName: string;
  accountName: string;
  accountNumber: string;
  onEdit?: () => void;
}) {
  const masked = accountNumber
    ? accountNumber.replace(/(\d{3})(\d{3})(\d{4})/, "$1  $2  $3")
    : "•••• •••• ••••";
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-primary-foreground shadow-glow bg-gradient-to-br from-primary via-primary/90 to-indigo-600">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-90">
          <Landmark className="h-3.5 w-3.5" /> Payout account
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">
          <ShieldCheck className="h-3 w-3" /> Verified
        </span>
      </div>
      <div className="relative mt-5 font-mono text-lg tracking-[0.2em] sm:text-xl">{masked}</div>
      <div className="relative mt-4 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest opacity-75">Account name</div>
          <div className="truncate text-sm font-bold uppercase">{accountName || "—"}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest opacity-75">Bank</div>
          <div className="max-w-[10rem] truncate text-sm font-semibold">{bankName || "—"}</div>
        </div>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur transition hover:bg-white/25"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      )}
    </div>
  );
}
