import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// School Biography — a curated set of representative profiles (SUG, DVCs,
// course reps, coordinators…). Stored as a single JSON row in
// `platform_settings` so we don't need a new table/migration; admin-only
// writes are enforced server-side via has_role('admin').

const SETTINGS_KEY = "SCHOOL_BIOGRAPHY_V1";

export const SchoolBioProfile = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  role: z.string().min(1).max(160),
  category: z.enum([
    "leadership",
    "sug",
    "course_rep",
    "coordinator",
    "student_rep",
    "faculty_rep",
    "other",
  ]),
  faculty: z.string().max(160).optional().nullable(),
  department: z.string().max(160).optional().nullable(),
  level: z.string().max(40).optional().nullable(),
  session: z.string().max(40).optional().nullable(),
  avatar_url: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v && v.trim() ? v.trim() : null))
    .refine((v) => v === null || /^https?:\/\//i.test(v) || v.startsWith("data:"), {
      message: "Invalid url",
    }),
  short_bio: z.string().max(220).optional().nullable(),
  long_bio: z.string().max(6000).optional().nullable(),
  quote: z.string().max(400).optional().nullable(),
  achievements: z.array(z.string().max(160)).max(20).optional().default([]),
  hue: z.number().int().min(0).max(360).optional().nullable(),
  is_current: z.boolean().optional().default(true),
  socials: z
    .object({
      email: z.string().max(160).optional().nullable(),
      phone: z.string().max(60).optional().nullable(),
      whatsapp: z.string().max(60).optional().nullable(),
      instagram: z.string().max(120).optional().nullable(),
      x: z.string().max(120).optional().nullable(),
      facebook: z.string().max(200).optional().nullable(),
      linkedin: z.string().max(200).optional().nullable(),
      website: z.string().max(240).optional().nullable(),
    })
    .partial()
    .optional()
    .nullable(),
  order: z.number().int().optional().default(0),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type TSchoolBio = z.infer<typeof SchoolBioProfile>;

async function readAll(supabaseAdmin: any): Promise<TSchoolBio[]> {
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  if (!data?.value) return [];
  try {
    const parsed = JSON.parse(data.value);
    if (!Array.isArray(parsed)) return [];
    return parsed as TSchoolBio[];
  } catch {
    return [];
  }
}

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Only admins can edit school biography.");
}

// Public — anyone can view the biography wall.
export const listSchoolBios = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const all = await readAll(supabaseAdmin);
  return all.sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name),
  );
});

// Admin only — upsert a single profile.
export const saveSchoolBio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SchoolBioProfile.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const all = await readAll(supabaseAdmin);
    const idx = all.findIndex((p) => p.id === data.id);
    const now = new Date().toISOString();
    const next: TSchoolBio = {
      ...data,
      updated_at: now,
      created_at: idx >= 0 ? all[idx].created_at ?? now : now,
    };
    if (idx >= 0) all[idx] = next;
    else all.push(next);
    const { error } = await supabaseAdmin.from("platform_settings").upsert({
      key: SETTINGS_KEY,
      value: JSON.stringify(all),
      is_secret: false,
      updated_by: context.userId,
      updated_at: now,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// Admin only — delete a profile.
export const deleteSchoolBio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const all = await readAll(supabaseAdmin);
    const next = all.filter((p) => p.id !== data.id);
    const { error } = await supabaseAdmin.from("platform_settings").upsert({
      key: SETTINGS_KEY,
      value: JSON.stringify(next),
      is_secret: false,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// Admin only — bulk reorder.
export const reorderSchoolBios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[] }) =>
    z.object({ ids: z.array(z.string()).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const all = await readAll(supabaseAdmin);
    const rank = new Map(data.ids.map((id, i) => [id, i]));
    const next = all
      .map((p) => ({ ...p, order: rank.get(p.id) ?? p.order ?? 999 }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const { error } = await supabaseAdmin.from("platform_settings").upsert({
      key: SETTINGS_KEY,
      value: JSON.stringify(next),
      is_secret: false,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
