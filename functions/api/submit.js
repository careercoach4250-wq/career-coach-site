/* Career Coach — form submission backend (Cloudflare Pages Function).
   Handles both the roadmap intake form and the "Have a question instead?"
   contact form on get-started.html, and emails submissions via Resend
   (https://resend.com — free tier, no credit card required).

   Requires a RESEND_API_KEY environment variable/secret set in the
   Cloudflare Pages project settings. Optionally bind a KV namespace named
   RATE_LIMIT_KV to enable per-visitor rate limiting; if it isn't bound,
   rate limiting is skipped rather than erroring. */

const TO_EMAIL = "careercoach4250@gmail.com";
const FROM_EMAIL = "Career Coach Website <onboarding@resend.dev>";
const MAX_FIELD_LEN = 1000;
const RATE_LIMIT_PER_HOUR = 10;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function clean(v) {
  return typeof v === "string" ? v.trim().slice(0, MAX_FIELD_LEN) : "";
}

async function checkRateLimit(env, ip) {
  if (!env.RATE_LIMIT_KV || !ip) return true;
  const key = `rl:submit:${ip}:${Math.floor(Date.now() / 3600000)}`;
  const current = parseInt((await env.RATE_LIMIT_KV.get(key)) || "0", 10);
  if (current >= RATE_LIMIT_PER_HOUR) return false;
  await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 7200 });
  return true;
}

/* Email palette mirrors styles.css (--navy, --navy-dark, --teal, --mint, --ink,
   --muted, --paper-soft, --border). Web fonts aren't reliable in email clients,
   so headings fall back to Georgia (Lora's own fallback in styles.css) and body
   text to a system sans stack (Work Sans's fallback). Table-based layout with
   inline styles throughout for email-client compatibility. */

function emailShell(bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F5F7FC;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F7FC;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E1E6F2;border-radius:16px;">
        <tr>
          <td style="background-color:#1E2761;background-image:linear-gradient(135deg,#1E2761,#14193F);padding:24px 32px;border-radius:16px 16px 0 0;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="padding-right:8px;">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                  <td style="width:9px;height:9px;line-height:9px;font-size:9px;border-radius:50%;background-color:#02C39A;">&nbsp;</td>
                  <td style="width:5px;">&nbsp;</td>
                  <td style="width:10px;height:10px;line-height:10px;font-size:10px;border-radius:50%;background-color:#028090;">&nbsp;</td>
                  <td style="width:5px;">&nbsp;</td>
                  <td style="width:11px;height:11px;line-height:11px;font-size:11px;border-radius:50%;background-color:#FFFFFF;">&nbsp;</td>
                </tr></table>
              </td>
              <td style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:19px;color:#FFFFFF;letter-spacing:-0.01em;">Career Coach</td>
            </tr></table>
          </td>
        </tr>
        <tr><td style="padding:32px;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:18px 32px;border-top:1px solid #E1E6F2;background-color:#F5F7FC;border-radius:0 0 16px 16px;">
          <p style="margin:0;font-family:Arial,'Segoe UI',sans-serif;font-size:12px;line-height:1.5;color:#5B6178;">Sent automatically from the Career Coach website's Get Started form. Reply to this email to respond directly.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function fieldRows(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #E1E6F2;border-radius:10px;overflow:hidden;">
    ${rows
      .map(
        ([k, v], i) => `<tr style="background-color:${i % 2 === 0 ? "#F5F7FC" : "#FFFFFF"};">
          <td style="padding:11px 14px;font-family:Arial,'Segoe UI',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#5B6178;width:42%;vertical-align:top;border-bottom:1px solid #E1E6F2;">${escapeHtml(k)}</td>
          <td style="padding:11px 14px;font-family:Arial,'Segoe UI',sans-serif;font-size:14px;color:#1A1F36;vertical-align:top;border-bottom:1px solid #E1E6F2;">${escapeHtml(v || "—")}</td>
        </tr>`
      )
      .join("")}
  </table>`;
}

function heading(title, subtitle) {
  return `<h1 style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:22px;color:#1E2761;letter-spacing:-0.01em;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 22px;font-family:Arial,'Segoe UI',sans-serif;font-size:13px;color:#5B6178;">${escapeHtml(subtitle)}</p>`;
}

function buildIntakeEmail(f) {
  const rows = [
    ["Name", f.name],
    ["Campus email", f.email],
    ["Class year", f.year],
    ["Academic focus / major", f.major],
    ["Interests", f.interests],
    ["Target career direction", f.target],
    ["Wants resume review", f.wantsResume ? "Yes" : "No"],
    ["Wants mock interview", f.wantsInterview ? "Yes" : "No"],
    ["Availability", f.availability],
    ["OK to email about progress", f.consent ? "Yes" : "No"],
  ];
  const subject = `New roadmap intake: ${f.name || "Unnamed"} (${f.year || "year unknown"})`;
  const html = emailShell(
    heading("New roadmap intake", "Someone just started a roadmap through the Get Started form.") + fieldRows(rows)
  );
  return { subject, html };
}

function buildContactEmail(f) {
  const subject = `New contact message from ${f.name || "someone"}`;
  const messageBlock = `<div style="margin-top:16px;padding:16px 18px;background-color:#F5F7FC;border-left:3px solid #028090;border-radius:8px;">
    <p style="margin:0;font-family:Arial,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;color:#1A1F36;white-space:pre-wrap;">${escapeHtml(f.message || "—")}</p>
  </div>`;
  const html = emailShell(
    heading("New contact message", "Someone asked a question via the “Have a question instead?” form.") +
      fieldRows([
        ["Name", f.name],
        ["Email", f.email],
      ]) +
      messageBlock
  );
  return { subject, html };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.RESEND_API_KEY) {
    return json({ error: "not_configured" }, 503);
  }

  const ip = request.headers.get("CF-Connecting-IP");
  const allowed = await checkRateLimit(env, ip);
  if (!allowed) {
    return json({ error: "rate_limited" }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  // Honeypot: bots fill hidden fields humans don't see.
  if (clean(body.hp)) {
    return json({ ok: true }); // silently pretend success
  }

  const formType = body.formType === "contact" ? "contact" : "intake";

  let subject, html;
  if (formType === "contact") {
    const f = {
      name: clean(body.name),
      email: clean(body.email),
      message: clean(body.message),
    };
    if (!f.email || !f.message) return json({ error: "bad_request" }, 400);
    ({ subject, html } = buildContactEmail(f));
  } else {
    const f = {
      name: clean(body.name),
      email: clean(body.email),
      year: clean(body.year),
      major: clean(body.major),
      interests: clean(body.interests),
      target: clean(body.target),
      wantsResume: !!body.wantsResume,
      wantsInterview: !!body.wantsInterview,
      availability: clean(body.availability),
      consent: !!body.consent,
    };
    if (!f.name || !f.email) return json({ error: "bad_request" }, 400);
    ({ subject, html } = buildIntakeEmail(f));
  }

  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: clean(body.email) || undefined,
        subject,
        html,
      }),
    });
  } catch {
    return json({ error: "upstream_unreachable" }, 502);
  }

  if (!res.ok) {
    return json({ error: "upstream_error" }, 502);
  }

  return json({ ok: true });
}
