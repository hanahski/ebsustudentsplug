import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, Globe, Eye, Trash2, Download, Palette } from "lucide-react";
import { applyLanguage } from "@/components/GoogleTranslateBridge";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — StudentsPlug" }] }),
});

function SettingsPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [showOnline, setShowOnline] = useState(true);
  const [notifs, setNotifs] = useState(true);
  const [lang, setLang] = useState("en");

  useEffect(() => {
    if (profile) setShowOnline(profile.show_online);
    setNotifs(localStorage.getItem("sp:notifs") !== "0");
    setLang(localStorage.getItem("sp:lang") ?? "en");
  }, [profile]);

  const saveOnline = async (v: boolean) => {
    setShowOnline(v);
    if (!profile) return;
    await supabase.from("profiles").update({ show_online: v } as any).eq("id", profile.id);
    refreshProfile();
  };

  const saveNotifs = (v: boolean) => { setNotifs(v); localStorage.setItem("sp:notifs", v ? "1" : "0"); };
  const saveLang = (v: string) => {
    setLang(v);
    localStorage.setItem("sp:lang", v);
    toast.success("Applying language…");
    // Small delay so the toast paints before reload.
    setTimeout(() => applyLanguage(v), 250);
  };

  const exportData = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "studentsplug-profile.json"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  };

  const deleteAccount = async () => {
    if (!confirm("This deletes your account. Continue?")) return;
    toast.message("Account deletion request received — support will follow up.");
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold font-display">Settings</h1>

        <Row icon={Palette} title="Theme" desc="Switch between light and dark mode." right={<ThemeToggle />} />
        <Row icon={Bell} title="Notifications" desc="In-app and web push alerts." right={<Switch checked={notifs} onCheckedChange={saveNotifs} />} />
        <Row icon={Eye} title="Show online indicator" desc="Others see when you're active." right={<Switch checked={showOnline} onCheckedChange={saveOnline} />} />
        <Row icon={Globe} title="Language" desc="Interface language." right={
          <select value={lang} onChange={(e) => saveLang(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-sm">
            <option value="en">English</option>
            <option value="pcm">Pidgin</option>
            <option value="ig">Igbo</option>
            <option value="yo">Yoruba</option>
            <option value="ha">Hausa</option>
          </select>
        } />
        <Row icon={Download} title="Download my data" desc="Export a copy of your profile." right={<Button size="sm" variant="outline" onClick={exportData}>Export</Button>} />
        <Row icon={Trash2} title="Delete account" desc="Permanently remove your account." right={<Button size="sm" variant="destructive" onClick={deleteAccount}>Delete</Button>} />

        <div className="pt-4 flex gap-2">
          <Button variant="outline" onClick={() => { signOut(); }}>Sign out</Button>
          <Link to="/me" className="text-xs text-muted-foreground hover:text-primary self-center ml-auto">← Back</Link>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ icon: Icon, title, desc, right }: any) {
  return (
    <div className="bg-card border rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div>
      <div className="flex-1 min-w-0">
        <Label className="font-semibold text-sm">{title}</Label>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}
