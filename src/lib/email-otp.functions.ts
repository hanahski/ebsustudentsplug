import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const SENDER_DISPLAY_NAME = "StudentsPlug Support";

/**
 * Send a 6-digit email verification code to the signed-in user's email,
 * delivered from the workspace's connected Gmail account via the Lovable
 * connector gateway. The hashed code is stashed on the user's auth
 * metadata (service-role only) with a 10-minute expiry.
 */
export const sendVerifyOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createHash, randomInt } = await import("node:crypto");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
    if (!lovableKey || !gmailKey) {
      throw new Error("Email sender not configured. Reconnect Gmail in workspace settings.");
    }

    // Load the target user's email from auth.
    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (userErr || !userRes?.user?.email) {
      throw new Error("Could not load your account email.");
    }
    const toEmail = userRes.user.email;

    // Generate a 6-digit code and hash it with the user id as salt.
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = createHash("sha256").update(`${context.userId}:${code}`).digest("hex");
    const expiresAt = Date.now() + OTP_TTL_MS;

    // Stash on auth metadata (service-role only, never exposed to the client).
    const nextMeta = {
      ...(userRes.user.user_metadata ?? {}),
      email_otp: { hash: codeHash, expires_at: expiresAt, attempts: 0, purpose: "verify" },
    };
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      user_metadata: nextMeta,
    });
    if (updErr) throw new Error(`Could not stage verification code: ${updErr.message}`);

    // Resolve the sender's own Gmail address so we can put a nice display
    // name in the From header. Gmail API rejects a From address that isn't
    // the authenticated account or one of its aliases.
    const profRes = await fetch(`${GATEWAY_URL}/users/me/profile`, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmailKey,
      },
    });
    if (!profRes.ok) {
      const body = await profRes.text();
      console.error(`[email-otp] Gmail profile lookup failed [${profRes.status}]: ${body}`);
      throw new Error("Email sender is not authorized. Reconnect Gmail in workspace settings.");
    }
    const profile = (await profRes.json()) as { emailAddress?: string };
    const fromAddress = profile.emailAddress;
    if (!fromAddress) throw new Error("Could not read sender address from Gmail.");

    // Build the RFC-2822 message.
    const subject = "Your StudentsPlug verification code";
    const html = renderOtpHtml(code);
    const text = `Your StudentsPlug verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, you can safely ignore this email.`;
    const boundary = `sp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const mime = [
      `From: ${SENDER_DISPLAY_NAME} <${fromAddress}>`,
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      text,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      html,
      ``,
      `--${boundary}--`,
      ``,
    ].join("\r\n");

    const raw = Buffer.from(mime, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const sendRes = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmailKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
    if (!sendRes.ok) {
      const body = await sendRes.text();
      console.error(`[email-otp] Gmail send failed [${sendRes.status}]: ${body}`);
      throw new Error(`Could not send verification email (${sendRes.status}). Check that Gmail is still connected.`);
    }

    return { ok: true, sentTo: toEmail };
  });

/**
 * Verify the 6-digit email OTP for the signed-in user. On success, marks
 * profiles.email_verified = true (via mark_email_verified RPC).
 */
export const verifyEmailOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => {
    const code = String(data?.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code.");
    return { code };
  })
  .handler(async ({ data, context }) => {
    const { createHash, timingSafeEqual } = await import("node:crypto");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (userErr || !userRes?.user) throw new Error("Could not load your account.");

    const meta = (userRes.user.user_metadata ?? {}) as Record<string, unknown>;
    const otp = meta.email_otp as
      | { hash?: string; expires_at?: number; attempts?: number; purpose?: string }
      | undefined;

    if (!otp?.hash || !otp.expires_at) {
      throw new Error("No pending code. Tap Resend to get a new one.");
    }
    if (Date.now() > otp.expires_at) {
      await supabaseAdmin.auth.admin.updateUserById(context.userId, {
        user_metadata: { ...meta, email_otp: null },
      });
      throw new Error("Code expired. Tap Resend to get a new one.");
    }
    if ((otp.attempts ?? 0) >= MAX_ATTEMPTS) {
      await supabaseAdmin.auth.admin.updateUserById(context.userId, {
        user_metadata: { ...meta, email_otp: null },
      });
      throw new Error("Too many wrong attempts. Tap Resend to get a new code.");
    }

    const candidate = createHash("sha256").update(`${context.userId}:${data.code}`).digest();
    const expected = Buffer.from(otp.hash, "hex");
    const ok = candidate.length === expected.length && timingSafeEqual(candidate, expected);

    if (!ok) {
      await supabaseAdmin.auth.admin.updateUserById(context.userId, {
        user_metadata: {
          ...meta,
          email_otp: { ...otp, attempts: (otp.attempts ?? 0) + 1 },
        },
      });
      const remaining = MAX_ATTEMPTS - ((otp.attempts ?? 0) + 1);
      throw new Error(
        remaining > 0 ? `Invalid code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.` : "Invalid code.",
      );
    }

    // Success — clear OTP, mark profile verified.
    await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      user_metadata: { ...meta, email_otp: null },
    });
    const { error: rpcErr } = await context.supabase.rpc("mark_email_verified" as never);
    if (rpcErr) throw new Error(rpcErr.message || "Could not mark email verified.");

    return { ok: true };
  });

function renderOtpHtml(code: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;box-shadow:0 6px 24px rgba(15,23,42,.06);overflow:hidden;">
          <tr><td style="padding:28px 28px 8px 28px;">
            <div style="font-size:14px;font-weight:600;letter-spacing:.06em;color:#3b82f6;text-transform:uppercase;">StudentsPlug</div>
            <h1 style="margin:8px 0 4px 0;font-size:22px;line-height:1.3;">Verify your email</h1>
            <p style="margin:0;color:#475569;font-size:14px;line-height:1.55;">Use the code below to finish verifying your email. It expires in <b>10 minutes</b>.</p>
          </td></tr>
          <tr><td style="padding:20px 28px 8px 28px;">
            <div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;padding:20px;text-align:center;">
              <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:32px;letter-spacing:.5em;font-weight:700;color:#0f172a;">${code}</div>
            </div>
          </td></tr>
          <tr><td style="padding:16px 28px 4px 28px;">
            <p style="margin:0;color:#475569;font-size:13px;line-height:1.55;">Enter this code in the verification screen where you started. Never share it with anyone — StudentsPlug staff will never ask for it.</p>
          </td></tr>
          <tr><td style="padding:20px 28px 28px 28px;">
            <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">Didn't request this? You can ignore this email — no changes were made to your account.</p>
          </td></tr>
          <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">StudentsPlug Support · Ebonyi State University community</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
