import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { AVATAR_KEYS, AVATARS, avatarDataUri } from "@/lib/avatars";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, Trash2 } from "lucide-react";
import { enhanceImageFile } from "@/lib/image-enhance";
import { safeUserUpload, friendlyUploadError } from "@/lib/safe-upload";

export const Route = createFileRoute("/me_/avatar")({
  component: AvatarPage,
  head: () => ({ meta: [{ title: "Avatar — StudentsPlug" }] }),
});

function AvatarPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading]);

  const [avatar, setAvatar] = useState("boy-1");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (profile) setAvatar(profile.avatar_key); }, [profile]);

  const save = async (key: string) => {
    if (!profile) return;
    setAvatar(key);
    const { error } = await supabase.from("profiles").update({ avatar_key: key } as any).eq("id", profile.id);
    if (error) toast.error(error.message);
    else { toast.success("Avatar updated"); refreshProfile(); }
  };

  const upload = async (file: File) => {
    if (!profile) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5MB"); return; }
    setUploading(true);
    try {
      const enhanced = await enhanceImageFile(file);
      const ext = (enhanced.name.split(".").pop() || "jpg").toLowerCase();
      const { path } = await safeUserUpload({
        bucket: "covers",
        file: enhanced,
        filename: `avatar-${Date.now()}.${ext}`,
        contentType: enhanced.type,
        upsert: true,
      });
      const { data: signed, error: sErr } = await supabase.storage.from("covers").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr) throw sErr;
      await save(signed.signedUrl);
    } catch (e: any) { toast.error(friendlyUploadError(e)); }
    finally { setUploading(false); }
  };

  const remove = () => save("boy-1");

  if (!profile) return <AppShell><div className="py-10 text-center text-muted-foreground">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold font-display">Avatar</h1>
        <div className="bg-card border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-4">
            <img src={avatar.startsWith("http") ? avatar : avatarDataUri(avatar)} alt="" className="w-20 h-20 rounded-full border-2 border-primary object-cover" />
            <div className="flex flex-col gap-1.5">
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Camera className="w-4 h-4 mr-1.5" />{uploading ? "Uploading…" : "Upload photo"}
              </Button>
              <Button size="sm" variant="ghost" onClick={remove}>
                <Trash2 className="w-4 h-4 mr-1.5" />Remove photo
              </Button>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">Or pick an avatar</p>
            <div className="flex gap-3 flex-wrap">
              {AVATAR_KEYS.map((k) => (
                <button key={k} type="button" onClick={() => save(k)}
                  className={`p-1 rounded-full border-2 transition ${avatar === k ? "border-primary shadow-glow" : "border-transparent hover:border-muted"}`}>
                  <img src={avatarDataUri(k)} alt={AVATARS[k].label} className="w-12 h-12 rounded-full" />
                </button>
              ))}
            </div>
          </div>
          <div className="pt-2"><Link to="/me" className="text-xs text-muted-foreground hover:text-primary">← Back to profile</Link></div>
        </div>
      </div>
    </AppShell>
  );
}
