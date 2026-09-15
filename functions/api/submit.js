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
  const html = `<h2>New roadmap intake</h2><table>${rows
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#555"><b>${escapeHtml(k)}</b></td><td style="padding:4px 0">${escapeHtml(v || "—")}</td></tr>`)
    .join("")}</table>`;
  return { subject, html };
}

function buildContactEmail(f) {
  const subject = `New contact message from ${f.name || "someone"}`;
  const html = `<h2>New contact form message</h2>
    <p><b>Name:</b> ${escapeHtml(f.name || "—")}</p>
    <p><b>Email:</b> ${escapeHtml(f.email || "—")}</p>
    <p><b>Message:</b><br>${escapeHtml(f.message || "—").replace(/\n/g, "<br>")}</p>`;
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
