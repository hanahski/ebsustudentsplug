import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const ACADEMIC_LEVELS = ["100", "200", "300", "400", "500", "Postgraduate", "Alumni"];

export const Route = createFileRoute("/me/edit")({
  component: EditProfilePage,
  head: () => ({ meta: [{ title: "Edit profile — StudentsPlug" }] }),
});

function EditProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading]);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [dept, setDept] = useState("");
  const [level, setLevel] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setBio(profile.bio ?? "");
      setDept(profile.department_id ?? "");
      setLevel((profile as any).academic_level ?? "");
    }
  }, [profile]);

  const { data: depts } = useQuery({
    queryKey: ["all-depts"],
    queryFn: async () => (await supabase.from("departments").select("id,name").order("name")).data ?? [],
  });

  const save = async () => {
    if (!profile) return;
    const { error } = await supabase.from("profiles").update({
      display_name: name, bio, department_id: dept || null, academic_level: level || null,
    } as any).eq("id", profile.id);
    if (error) toast.error(error.message);
    else { toast.success("Profile saved"); refreshProfile(); }
  };

  if (!profile) return <AppShell><div className="py-10 text-center text-muted-foreground">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold font-display">Edit profile</h1>
        <div className="bg-card border rounded-2xl p-5 space-y-4">
          <div><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Department</Label>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger><SelectValue placeholder="Select your department" /></SelectTrigger>
              <SelectContent>{depts?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Academic level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue placeholder="Select your level" /></SelectTrigger>
              <SelectContent>{ACADEMIC_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Bio</Label><Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} /></div>
          <div className="flex gap-2 pt-2">
            <Button onClick={save}>Save changes</Button>
            <Button asChild variant="outline"><Link to="/me">Cancel</Link></Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
