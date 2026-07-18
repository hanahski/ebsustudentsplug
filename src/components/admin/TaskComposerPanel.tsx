import { confirm } from "@/components/ConfirmProvider";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2, Coins, Pencil } from "lucide-react";

type Task = {
  id: string;
  bucket: number;
  title: string;
  description: string;
  reward_credits: number;
  is_active: boolean;
  sort_order: number;
};

export function TaskComposerPanel() {
  const qc = useQueryClient();
  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("bucket")
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data as Task[];
    },
  });

  const [draft, setDraft] = useState<Partial<Task>>({ bucket: 10, title: "", description: "", reward_credits: 10, is_active: true, sort_order: 0 });
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!draft.title || !draft.bucket || !draft.reward_credits) {
      toast.error("Bucket, title and reward are required");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("tasks").insert({
      bucket: Number(draft.bucket),
      title: draft.title,
      description: draft.description ?? "",
      reward_credits: Number(draft.reward_credits),
      is_active: draft.is_active ?? true,
      sort_order: Number(draft.sort_order) || 0,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Task created");
    setDraft({ bucket: draft.bucket, title: "", description: "", reward_credits: draft.reward_credits, is_active: true, sort_order: 0 });
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
  };

  const grouped = tasks.reduce<Record<number, Task[]>>((acc, t) => {
    (acc[t.bucket] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-2xl p-4 shadow-card">
        <h2 className="font-display font-bold text-lg mb-1 flex items-center gap-2"><Coins className="w-5 h-5 text-primary" /> Task Composer</h2>
        <p className="text-xs text-muted-foreground mb-4">Create, edit and price the tasks that appear on <code>/tasks/:amount</code>. The "bucket" is the amount shown in the earn-credits menu (e.g. 10, 20, 50); "reward" is what the user actually receives.</p>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <div>
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Bucket</label>
            <Input type="number" value={draft.bucket ?? ""} onChange={(e) => setDraft({ ...draft, bucket: Number(e.target.value) })} />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Title</label>
            <Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Share a post" />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Description</label>
            <Input value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Short instruction" />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Reward</label>
            <Input type="number" value={draft.reward_credits ?? ""} onChange={(e) => setDraft({ ...draft, reward_credits: Number(e.target.value) })} />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={draft.is_active ?? true} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
            Active
          </label>
          <Button size="sm" onClick={create} disabled={creating}>
            {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            Add task
          </Button>
        </div>
      </div>

      {isLoading && <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>}

      {Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).map((bk) => (
        <div key={bk} className="bg-card border rounded-2xl p-4 shadow-card">
          <h3 className="font-bold mb-3">{bk}-credit bucket <span className="text-xs text-muted-foreground font-normal">({grouped[Number(bk)].length} task{grouped[Number(bk)].length === 1 ? "" : "s"})</span></h3>
          <div className="space-y-2">
            {grouped[Number(bk)].map((t) => (
              <TaskRow key={t.id} task={t} onChanged={() => refetch()} />
            ))}
          </div>
        </div>
      ))}

      {!isLoading && tasks.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8 border rounded-2xl">
          No tasks yet. Add one above.
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onChanged }: { task: Task; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(task);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("tasks").update({
      bucket: Number(t.bucket),
      title: t.title,
      description: t.description,
      reward_credits: Number(t.reward_credits),
      is_active: t.is_active,
      sort_order: Number(t.sort_order) || 0,
    }).eq("id", t.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEditing(false);
    onChanged();
  };

  const del = async () => {
    if (!(await confirm({ title: `Delete "${task.title}"?`, variant: "destructive", confirmText: "Delete task", icon: "trash" }))) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    onChanged();
  };

  const toggleActive = async (v: boolean) => {
    const { error } = await supabase.from("tasks").update({ is_active: v }).eq("id", task.id);
    if (error) { toast.error(error.message); return; }
    onChanged();
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border bg-background">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{task.title}</div>
          {task.description && <div className="text-xs text-muted-foreground truncate">{task.description}</div>}
        </div>
        <span className="text-xs font-bold text-primary shrink-0">+{task.reward_credits}</span>
        <Switch checked={task.is_active} onCheckedChange={toggleActive} />
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="w-3.5 h-3.5" /></Button>
        <Button size="sm" variant="ghost" onClick={del}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-xl border bg-background space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <div>
          <label className="text-[10px] uppercase font-bold text-muted-foreground">Bucket</label>
          <Input type="number" value={t.bucket} onChange={(e) => setT({ ...t, bucket: Number(e.target.value) })} />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] uppercase font-bold text-muted-foreground">Title</label>
          <Input value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] uppercase font-bold text-muted-foreground">Description</label>
          <Textarea rows={1} value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} />
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold text-muted-foreground">Reward</label>
          <Input type="number" value={t.reward_credits} onChange={(e) => setT({ ...t, reward_credits: Number(e.target.value) })} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => { setT(task); setEditing(false); }}>Cancel</Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Save
        </Button>
      </div>
    </div>
  );
}
