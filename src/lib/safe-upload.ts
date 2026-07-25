import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the current authenticated user id, refreshing the session first when
 * needed. Uses getSession() so we know the access token is actually present —
 * getUser() can return a user object from a cached JWT whose refresh has
 * already expired, which then makes storage uploads fail RLS as anon.
 */
export async function resolveAuthUid(): Promise<string | null> {
  const first = await supabase.auth.getSession();
  if (first.data.session?.access_token && first.data.session.user?.id) {
    return first.data.session.user.id;
  }
  try {
    await supabase.auth.refreshSession();
  } catch {}
  const second = await supabase.auth.getSession();
  if (second.data.session?.access_token && second.data.session.user?.id) {
    return second.data.session.user.id;
  }
  return null;
}

/** Turn a raw Storage / PostgREST error into a message a user can act on. */
export function friendlyUploadError(err: any): string {
  const raw = String(err?.message ?? err ?? "");
  const msg = raw.toLowerCase();
  if (!msg) return "Upload failed. Please try again.";
  // Already-friendly errors from safeUserUpload — don't double-prefix.
  if (raw.startsWith("Upload blocked:") || raw.startsWith("You're signed out")) return raw;
  if (msg.includes("jwt") || msg.includes("invalid token") || msg.includes("token is expired")) {
    return "Your session expired. Sign in again and retry.";
  }
  if (msg.includes("row-level security") || msg.includes("policy") || msg.includes("unauthorized") || msg.includes("permission")) {
    return "You're signed out or your session expired. Sign in again and retry.";
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
  return raw || "Upload failed. Please try again.";
}

/**
 * Uploads to a Supabase Storage bucket using the CURRENT authenticated user id
 * as the folder prefix. Ensures the session is fresh so the storage request
 * carries a valid bearer token — otherwise RLS rejects the insert.
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
