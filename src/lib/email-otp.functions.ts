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
    const subject = `Your StudentsPlug verification code: ${code}`;
    const html = renderOtpHtml(code);
    const text = `StudentsPlug — Email verification\n\nYour verification code is: ${code}\n\nThis code expires in 10 minutes. For your security, never share it with anyone — StudentsPlug staff will never ask for it.\n\nIf you didn't request this code, you can safely ignore this email; no changes were made to your account.\n\n— StudentsPlug Support\nEbonyi State University student community\nhttps://ebsustudentsplug.lovable.app`;
    const msgId = `<otp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}@ebsustudentsplug.lovable.app>`;
    const boundary = `sp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const mime = [
      `From: ${SENDER_DISPLAY_NAME} <${fromAddress}>`,
      `To: ${toEmail}`,
      `Reply-To: ${SENDER_DISPLAY_NAME} <${fromAddress}>`,
      `Subject: ${subject}`,
      `Message-ID: ${msgId}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `X-Entity-Ref-ID: ${msgId}`,
      `X-Mailer: StudentsPlug`,
      `List-Unsubscribe: <mailto:${fromAddress}?subject=unsubscribe>`,
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

const LOGO_URL = "https://ebsustudentsplug.lovable.app/__l5e/assets-v1/05672a98-a2df-4f83-aa5e-749269614f72/studentsplug-logo.png";
const APP_URL = "https://ebsustudentsplug.lovable.app";

function renderOtpHtml(code: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>Your StudentsPlug verification code</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Your StudentsPlug code is ${code}. It expires in 10 minutes.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f6f7fb;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;box-shadow:0 10px 40px rgba(15,23,42,.08);overflow:hidden;">
          <!-- Header with logo -->
          <tr><td style="padding:32px 32px 8px 32px;text-align:center;background:linear-gradient(135deg,#eff6ff 0%,#ffffff 60%);">
            <a href="${APP_URL}" style="text-decoration:none;display:inline-block;">
              <img src="${LOGO_URL}" alt="StudentsPlug" width="64" height="64" style="display:block;margin:0 auto 12px auto;width:64px;height:64px;border-radius:16px;box-shadow:0 4px 12px rgba(59,130,246,.18);" />
              <div style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.01em;">StudentsPlug</div>
              <div style="font-size:12px;font-weight:500;color:#64748b;margin-top:2px;letter-spacing:.02em;">Ebonyi State University</div>
            </a>
          </td></tr>

          <!-- Heading -->
          <tr><td style="padding:24px 32px 8px 32px;text-align:center;">
            <h1 style="margin:0 0 8px 0;font-size:24px;line-height:1.3;font-weight:700;color:#0f172a;">Verify your email</h1>
            <p style="margin:0;color:#475569;font-size:15px;line-height:1.6;">Enter this 6-digit code to confirm this email belongs to you. It expires in <b style="color:#0f172a;">10 minutes</b>.</p>
          </td></tr>

          <!-- Code box with inline logo mark -->
          <tr><td style="padding:24px 32px 8px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%);border:1px solid #dbeafe;border-radius:14px;">
              <tr>
                <td style="padding:22px 20px;text-align:center;">
                  <img src="${LOGO_URL}" alt="" width="28" height="28" style="display:inline-block;vertical-align:middle;width:28px;height:28px;border-radius:8px;margin-right:12px;opacity:.9;" />
                  <span style="font-family:'SFMono-Regular',ui-monospace,Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;letter-spacing:.42em;font-weight:800;color:#0f172a;vertical-align:middle;">${code}</span>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Security note -->
          <tr><td style="padding:20px 32px 4px 32px;">
            <div style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:8px;padding:12px 14px;">
              <p style="margin:0;color:#78350f;font-size:13px;line-height:1.55;"><b>Keep this code private.</b> StudentsPlug staff will never ask for it — not in chat, DMs, calls, or WhatsApp.</p>
            </div>
          </td></tr>

          <!-- Ignore note -->
          <tr><td style="padding:16px 32px 28px 32px;">
            <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;text-align:center;">Didn't request this code? You can safely ignore this email — no changes were made to your account.</p>
          </td></tr>

          <!-- Footer -->
          <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
            <img src="${LOGO_URL}" alt="" width="20" height="20" style="display:inline-block;vertical-align:middle;width:20px;height:20px;border-radius:6px;margin-right:8px;opacity:.7;" />
            <span style="color:#64748b;font-size:12px;font-weight:600;vertical-align:middle;">StudentsPlug Support</span>
            <div style="margin-top:8px;color:#94a3b8;font-size:11px;line-height:1.6;">The student plug for Ebonyi State University · <a href="${APP_URL}" style="color:#3b82f6;text-decoration:none;">ebsustudentsplug.lovable.app</a></div>
          </td></tr>
        </table>
        <div style="max-width:560px;margin:16px auto 0 auto;color:#94a3b8;font-size:11px;line-height:1.5;text-align:center;">This is an automated security email sent because someone asked to verify this address on StudentsPlug.</div>
      </td></tr>
    </table>
  </body>
</html>`;
}
