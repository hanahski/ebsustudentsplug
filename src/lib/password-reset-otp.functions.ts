import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SENDER_DISPLAY_NAME = "StudentsPlug Support";
const APP_URL = "https://ebsustudentplug.fun";
const LOGO_URL = "https://ebsustudentplug.fun/__l5e/assets-v1/05672a98-a2df-4f83-aa5e-749269614f72/studentsplug-logo.png";

async function findUserByEmail(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const normalized = email.trim().toLowerCase();
  // Paginate through users to find match (list is bounded on small projects).
  let page = 1;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = data.users.find((u) => u.email?.toLowerCase() === normalized);
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
    if (page > 20) return null;
  }
}

/** Public: send a 6-digit password-reset code to the given email. */
export const sendRecoveryOtp = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => {
    const email = String(data?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email.");
    return { email };
  })
  .handler(async ({ data }) => {
    const { createHash, randomInt } = await import("node:crypto");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
    if (!lovableKey || !gmailKey) throw new Error("Email sender not configured.");

    const user = await findUserByEmail(data.email);
    // Always return ok to avoid email enumeration; only send when user exists.
    if (!user?.email) return { ok: true };

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = createHash("sha256").update(`${user.id}:${code}`).digest("hex");
    const expiresAt = Date.now() + OTP_TTL_MS;

    const nextMeta = {
      ...(user.user_metadata ?? {}),
      recovery_otp: { hash: codeHash, expires_at: expiresAt, attempts: 0 },
    };
    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: nextMeta,
    });
    if (updErr) throw new Error(updErr.message);

    const profRes = await fetch(`${GATEWAY_URL}/users/me/profile`, {
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmailKey },
    });
    if (!profRes.ok) throw new Error("Email sender not authorized.");
    const profile = (await profRes.json()) as { emailAddress?: string };
    const fromAddress = profile.emailAddress;
    if (!fromAddress) throw new Error("Could not read sender address.");

    const subject = `Your StudentsPlug password reset code: ${code}`;
    const html = renderResetHtml(code);
    const text = `StudentsPlug — Password reset\n\nYour password reset code is: ${code}\n\nThis code expires in 10 minutes. Never share it with anyone — StudentsPlug staff will never ask for it.\n\nIf you didn't request this, ignore this email; your password stays unchanged.\n\n— StudentsPlug Support\n${APP_URL}`;
    const msgId = `<reset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}@ebsustudentplug.fun>`;
    const boundary = `sp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const mime = [
      `From: ${SENDER_DISPLAY_NAME} <${fromAddress}>`,
      `To: ${user.email}`,
      `Reply-To: ${SENDER_DISPLAY_NAME} <${fromAddress}>`,
      `Subject: ${subject}`,
      `Message-ID: ${msgId}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
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
      console.error(`[reset-otp] Gmail send failed [${sendRes.status}]: ${body}`);
      throw new Error(`Could not send reset email (${sendRes.status}).`);
    }
    return { ok: true };
  });

/** Public: verify OTP + set a new password for the account. */
export const resetPasswordWithOtp = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; code: string; password: string }) => {
    const email = String(data?.email ?? "").trim().toLowerCase();
    const code = String(data?.code ?? "").trim();
    const password = String(data?.password ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email.");
    if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    return { email, code, password };
  })
  .handler(async ({ data }) => {
    const { createHash, timingSafeEqual } = await import("node:crypto");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const user = await findUserByEmail(data.email);
    if (!user) throw new Error("Invalid code.");
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const otp = meta.recovery_otp as
      | { hash?: string; expires_at?: number; attempts?: number }
      | undefined;
    if (!otp?.hash || !otp.expires_at) throw new Error("No pending code. Request a new one.");
    if (Date.now() > otp.expires_at) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...meta, recovery_otp: null },
      });
      throw new Error("Code expired. Request a new one.");
    }
    if ((otp.attempts ?? 0) >= MAX_ATTEMPTS) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...meta, recovery_otp: null },
      });
      throw new Error("Too many wrong attempts. Request a new code.");
    }
    const candidate = createHash("sha256").update(`${user.id}:${data.code}`).digest();
    const expected = Buffer.from(otp.hash, "hex");
    const ok = candidate.length === expected.length && timingSafeEqual(candidate, expected);
    if (!ok) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...meta, recovery_otp: { ...otp, attempts: (otp.attempts ?? 0) + 1 } },
      });
      const remaining = MAX_ATTEMPTS - ((otp.attempts ?? 0) + 1);
      throw new Error(
        remaining > 0 ? `Invalid code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.` : "Invalid code.",
      );
    }
    // Success — clear OTP, set new password, ensure email is confirmed.
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: data.password,
      email_confirm: true,
      user_metadata: { ...meta, recovery_otp: null },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function renderResetHtml(code: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Your StudentsPlug password reset code</title></head>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f6f7fb;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;box-shadow:0 10px 40px rgba(15,23,42,.08);overflow:hidden;">
        <tr><td style="padding:32px 32px 8px 32px;text-align:center;background:linear-gradient(135deg,#eff6ff 0%,#ffffff 60%);">
          <a href="${APP_URL}" style="text-decoration:none;display:inline-block;">
            <img src="${LOGO_URL}" alt="StudentsPlug" width="64" height="64" style="display:block;margin:0 auto 12px auto;width:64px;height:64px;border-radius:16px;" />
            <div style="font-size:20px;font-weight:800;color:#0f172a;">StudentsPlug</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">Ebonyi State University</div>
          </a>
        </td></tr>
        <tr><td style="padding:24px 32px 8px 32px;text-align:center;">
          <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:700;color:#0f172a;">Reset your password</h1>
          <p style="margin:0;color:#475569;font-size:15px;line-height:1.6;">Use this 6-digit code to set a new password. It expires in <b>10 minutes</b>.</p>
        </td></tr>
        <tr><td style="padding:24px 32px 8px 32px;">
          <div style="background:linear-gradient(135deg,#f8fafc 0%,#eff6ff 100%);border:1px solid #dbeafe;border-radius:14px;padding:22px 20px;text-align:center;">
            <span style="font-family:'SFMono-Regular',ui-monospace,Consolas,monospace;font-size:34px;letter-spacing:.42em;font-weight:800;color:#0f172a;">${code}</span>
          </div>
        </td></tr>
        <tr><td style="padding:20px 32px 4px 32px;">
          <div style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:8px;padding:12px 14px;">
            <p style="margin:0;color:#78350f;font-size:13px;line-height:1.55;"><b>Keep this code private.</b> StudentsPlug staff will never ask for it.</p>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px 28px 32px;">
          <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;text-align:center;">Didn't request this? Ignore this email — your password stays unchanged.</p>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <span style="color:#64748b;font-size:12px;font-weight:600;">StudentsPlug Support</span>
          <div style="margin-top:8px;color:#94a3b8;font-size:11px;"><a href="${APP_URL}" style="color:#3b82f6;text-decoration:none;">ebsustudentplug.fun</a></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
