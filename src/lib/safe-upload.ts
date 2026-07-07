import { supabase } from "@/integrations/supabase/client";

/**
 * Always fetches the freshest authoritative user id from Supabase (not from
 * cached React context). Attempts a session refresh once when the current
 * access token is missing/expired. Returns null when the user is truly
 * signed out.
 */
export async function resolveAuthUid(): Promise<string | null> {
  // getUser() revalidates with Supabase Auth — it's the source of truth.
  const first = await supabase.auth.getUser();
  if (first.data.user?.id) return first.data.user.id;

  // Try one refresh in case the access token just expired.
  try {
    await supabase.auth.refreshSession();
  } catch {}
  const second = await supabase.auth.getUser();
  return second.data.user?.id ?? null;
}

/** Turn a raw Storage / PostgREST error into a message a user can act on. */
export function friendlyUploadError(err: any): string {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  if (!msg) return "Upload failed. Please try again.";
  if (msg.includes("row-level security") || msg.includes("policy") || msg.includes("unauthorized")) {
    return "Your session expired. Sign in again and retry.";
  }
  if (msg.includes("exceeded") || msg.includes("payload too large") || msg.includes("size")) {
    return "That file is too large. Try a shorter or smaller version.";
  }
  if (msg.includes("mime") || msg.includes("content-type")) {
    return "That file type isn't allowed here.";
  }
  if (msg.includes("network") || msg.includes("failed to fetch")) {
    return "Network hiccup. Check your internet and retry.";
  }
  return err?.message || "Upload failed. Please try again.";
}

/**
 * Uploads to a Supabase Storage bucket using the CURRENT authenticated user id
 * as the folder prefix. Prevents RLS "policy violation" errors caused by
 * a stale cached user.id or a lapsed session.
 */
export async function safeUserUpload(opts: {
  bucket: string;
  file: File | Blob;
  filename: string;
  contentType?: string;
  upsert?: boolean;
}): Promise<{ path: string; uid: string }> {
  const uid = await resolveAuthUid();
  if (!uid) {
    const e: any = new Error("You're signed out. Please sign in and try again.");
    e.code = "SIGNED_OUT";
    throw e;
  }
  const safe = opts.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${uid}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from(opts.bucket).upload(path, opts.file, {
    contentType: opts.contentType || (opts.file as File).type || "application/octet-stream",
    upsert: opts.upsert ?? false,
  });
  if (error) {
    const wrapped: any = new Error(friendlyUploadError(error));
    wrapped.cause = error;
    throw wrapped;
  }
  return { path, uid };
}
