// Global styled confirm() replacement using shadcn AlertDialog.
// Usage:
//   import { confirm } from "@/components/ConfirmProvider";
//   if (!(await confirm({ title: "Delete this post?" }))) return;
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, Trash2, Info } from "lucide-react";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default";
  icon?: "danger" | "trash" | "info";
};

type Resolver = (v: boolean) => void;

let externalConfirm: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

export function confirm(opts: ConfirmOptions | string): Promise<boolean> {
  const o = typeof opts === "string" ? { title: opts } : opts;
  if (externalConfirm) return externalConfirm(o);
  // Fallback if provider not mounted
  return Promise.resolve(typeof window !== "undefined" ? window.confirm(o.title) : false);
}

const Ctx = createContext<(o: ConfirmOptions) => Promise<boolean>>(() => Promise.resolve(false));
export const useConfirm = () => useContext(Ctx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({ title: "" });
  const resolver = useRef<Resolver | null>(null);

  const ask = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((res) => { resolver.current = res; });
  }, []);

  useEffect(() => {
    externalConfirm = ask;
    return () => { externalConfirm = null; };
  }, [ask]);

  const finish = (v: boolean) => {
    setOpen(false);
    resolver.current?.(v);
    resolver.current = null;
  };

  const isDestructive = opts.variant !== "default";
  const IconEl = opts.icon === "trash" ? Trash2 : opts.icon === "info" ? Info : ShieldAlert;

  return (
    <Ctx.Provider value={ask}>
      {children}
      <AlertDialog open={open} onOpenChange={(v) => { if (!v) finish(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isDestructive ? "bg-destructive/15" : "bg-primary/15"}`}>
                <IconEl className={`w-5 h-5 ${isDestructive ? "text-destructive" : "text-primary"}`} />
              </div>
              <AlertDialogTitle>{opts.title}</AlertDialogTitle>
            </div>
            {opts.description && (
              <AlertDialogDescription className="pt-1">{opts.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => finish(false)}>{opts.cancelText ?? "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => finish(true)}
              className={isDestructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {opts.confirmText ?? (isDestructive ? "Delete" : "Confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}
