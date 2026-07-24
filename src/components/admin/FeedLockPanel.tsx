import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Lock, Unlock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getFeedLock, setFeedLock } from "@/lib/feed-lock.functions";

export function FeedLockPanel() {
  const qc = useQueryClient();
  const getFn = useServerFn(getFeedLock);
  const setFn = useServerFn(setFeedLock);
  const { data, isLoading } = useQuery({
    queryKey: ["feed-lock"],
    queryFn: () => getFn(),
  });
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setLocked(data.locked);
      setMessage(data.message);
    }
  }, [data]);

  const save = async (nextLocked?: boolean) => {
    setSaving(true);
    try {
      const useLocked = typeof nextLocked === "boolean" ? nextLocked : locked;
      await setFn({ data: { locked: useLocked, message: message.trim() || undefined } });
      await qc.invalidateQueries({ queryKey: ["feed-lock"] });
      toast.success(useLocked ? "Post feed locked" : "Post feed unlocked");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-glass p-4 a-fade-up">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`admin-icon-tile w-9 h-9 ${locked ? "admin-gradient-danger" : "admin-gradient-success"}`}>
            {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </span>
          <div className="min-w-0">
            <h3 className="admin-section-title text-base flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-primary" />
              Post feed lock
            </h3>
            <p className="text-xs text-muted-foreground">
              When locked, only admins can post to the main feed.
            </p>
          </div>
        </div>
        <Switch
          checked={locked}
          disabled={isLoading || saving}
          onCheckedChange={(v) => {
            setLocked(v);
            save(v);
          }}
        />
      </div>

      <label className="text-xs font-medium text-muted-foreground">
        Message shown to users
      </label>
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Admin has locked the post feed. Posting is temporarily disabled."
        rows={2}
        className="mt-1"
        maxLength={300}
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={() => save()} disabled={saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
          Save message
        </Button>
      </div>
    </div>
  );
}
