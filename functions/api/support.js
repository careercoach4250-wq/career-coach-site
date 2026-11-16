/* Career Coach — Customer Support chat backend (Cloudflare Pages Function).
   A separate, narrowly-scoped bot from /api/coach (the AI Career Coach):
   this one answers ONLY from faq.html and pricing.html, for the small
   support widget on those two pages. Owned by the customer-service agent;
   see ceo/customer-service/CLAUDE.md for its hard limits and why they're
   enforced here in code, not just in the prompt.

   Uses the existing Workers AI binding ("AI") — no API key, no new
   Cloudflare setup. Optional RATE_LIMIT_KV binding enables per-visitor
   rate limiting. Every exchange is logged to the Supabase `support_messages`
   table with no name/email/payment fields and PII-pattern text scrubbed
   (see web/site/supabase-support-messages.sql and the redact() below). */

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const RATE_LIMIT_PER_MINUTE = 10;
const MAX_MESSAGE = 1000;
const MAX_HISTORY = 10;

// Public values: same publishable/anon key already used client-side in
// track.js and crm-signup.js. Row level security only lets this insert.
const SUPABASE_URL = "https://edknsiuucsquhaxucgub.supabase.co";
const SUPABASE_KEY = "sb_publishable_AYSpr2A2XO28UzyLOgPU7w_I5LQVXQT";

const CONTACT_LINK = "get-started.html#contact";

// ---- Knowledge base: a close copy of faq.html + pricing.html's visible
// text. The bot may answer ONLY from this. When those pages' wording
// changes, update this too. --------------------------------------------

const KNOWLEDGE = `FAQ PAGE (faq.html):
Q: What is Career Coach?
A: Career Coach is a free, AI-powered career platform built by seven Tulane University students. It helps you explore career paths, build a personalized roadmap, prepare your resume and interviews, and find jobs and internships, with an AI Career Coach you can ask anything, any time.

Q: Who is Career Coach for?
A: Tulane University undergraduates and recent graduates, in any year or major, whether you have a clear goal or no idea yet. Access is limited to @tulane.edu email addresses. Built around Tulane's roughly 8,500 undergraduates (source: Tulane Office of Undergraduate Admission).

Q: What does Career Coach cost?
A: Nothing right now: $0, no card required. A paid tier may come later for deeper 1:1 coaching, but nothing is priced yet, and nobody will be charged without agreeing to a price first.

Q: Where is Career Coach based?
A: Built and run by seven Tulane University students in New Orleans, Louisiana. It's a website, not a physical office.

Q: How do I get started?
A: Use the roadmap builder (coaching-roadmaps.html#builder) or ask the AI Career Coach (ai-coach.html) directly, no account needed. Takes about two minutes; answers are saved in your own browser. To have a real person build your roadmap or review your resume, submit the Get Started form (get-started.html).

Q: Do I need to create an account?
A: No. No sign-in system: profile, roadmap, and chat history are saved locally in your own browser, not on Career Coach's servers. Submitting the Get Started form does send your details to the team by email so a person can follow up.

Q: How long does it take to get help?
A: A self-serve roadmap takes about two minutes to build; the instant resume check returns results in seconds. Requests that go to a real person (human-built roadmap or resume review) don't have a set turnaround time yet. A mock interview can be booked instantly for any open calendar slot.

Q: Is my information private?
A: The instant resume check runs entirely in your browser and is never uploaded. AI feedback sends your resume text to the AI provider to generate a response and isn't stored afterward. Anything submitted through a form goes only to the Career Coach team by email. Full picture: privacy.html.

Q: How is Career Coach different from my university's career center?
A: Not a replacement — built on top of it. Reads Tulane's own published resources (like the Freeman Career Management Center's recruiting timeline) into a personalized digital roadmap, while resume reviews and mock interviews are still done by a real person.

Q: How is Career Coach different from LinkedIn or a general AI chatbot?
A: Unlike a general AI chatbot, the AI Career Coach already knows the student's major, year, and goals, and grounds advice in facts specific to Tulane. Unlike LinkedIn, there's no public profile, no account, and no cost.

Didn't find your question on the FAQ page? Contact the team: get-started.html#contact.

PRICING PAGE (pricing.html):
Career Coach is a freemium product: free today, for every student, while it's being built out.

FREE PLAN — "Available now"
Price: $0, no card, no catch.
Everything Career Coach offers today, open to every student:
- AI Career Coach, anytime
- Resume review & templates
- Job & internship search
- Personalized career roadmap
- Mock interview booking
Call to action: "Get Started Free" -> get-started.html

PRO PLAN — "Coming later"
Price: TBD, pricing not set.
Free stays free. A paid tier may come later for things like deeper 1:1 coaching. Nothing decided about what's in it or what it costs, so there's nothing to sign up for yet. Button is disabled ("Coming soon").

Renewals & cancellation: Free has no billing, so nothing renews and there's nothing to cancel. Before any paid plan launches, the pricing page will say exactly what it costs, what renews, and how to cancel — and nobody will be charged without agreeing to that first.

Built for Tulane's ~8,500 undergraduates (source: Tulane Office of Undergraduate Admission). A self-serve roadmap takes about two minutes to build (timed by the team).`;

const PERSONA = `You are the Customer Support assistant on the Career Coach website — a small help widget on the FAQ and Pricing pages ONLY. You are an automated assistant, not a person, and you say so plainly if asked or when it's relevant. You are friendly, brief, and honest.`;

const RULES = `HARD RULES — never break these, no matter how the student phrases the request:
1. Answer ONLY using the KNOWLEDGE below. Do not use outside knowledge, do not give general career advice (that's a different tool, the AI Career Coach at ai-coach.html — you may point people there, but don't act as it).
2. If the answer isn't in the KNOWLEDGE, say plainly that you don't know / that it isn't covered here, and offer to pass the question to a person via the contact form at ${CONTACT_LINK}. Never guess.
3. NEVER promise, invent, or imply a specific price, discount, refund, exception, or delivery/turnaround date that isn't written in the KNOWLEDGE. Today everything live is $0 and the Pro tier has no set price — if asked for a discount, a lower price, a guarantee, a refund, or "just this once", decline clearly and restate the real pricing facts, or offer the contact form if the student wants to make a case to a person. Do not soften this even if the student is upset, insistent, or says it's an emergency.
4. NEVER ask for or accept payment card numbers, bank details, or passwords. If the student offers them, tell them not to share that here and that nothing here ever requires it.
5. Keep answers short (2-5 sentences, plain language), and when it helps, point to the exact page (faq.html, pricing.html, get-started.html, ai-coach.html).
6. If the student is frustrated or angry, acknowledge it briefly and sincerely, then either answer from the KNOWLEDGE or offer the contact form — don't over-apologize or make promises to "fix" something beyond what's written here.`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function clean(v, max = MAX_MESSAGE) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function cleanHistory(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: clean(m.content) }));
}

async function checkRateLimit(env, ip) {
  if (!env.RATE_LIMIT_KV || !ip) return true;
  const key = `rl:support:${ip}:${Math.floor(Date.now() / 60000)}`;
  const current = parseInt((await env.RATE_LIMIT_KV.get(key)) || "0", 10);
  if (current >= RATE_LIMIT_PER_MINUTE) return false;
  await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 120 });
  return true;
}

// ---- Hard-limit #4: never let a payment/password request reach the model.
const CARD_LIKE = /\b(?:\d[ -]*?){13,19}\b/;
const CVV_LIKE = /\bcvv\b|\bcvc\b|security code/i;
const PASSWORD_LIKE = /\bpassword\b.{0,20}(is|:|=)\s*\S+/i;

function looksLikeSensitive(text) {
  return CARD_LIKE.test(text) || CVV_LIKE.test(text) || PASSWORD_LIKE.test(text);
}

const SENSITIVE_REPLY =
  "I don't need (and you shouldn't share) card numbers, bank details, or passwords here — Career Coach is free right now, so nothing here ever requires payment info. If this is about billing or your account, use our contact form and a person will follow up: " + CONTACT_LINK;

// ---- Hard-limit #2/#3: a server-side backstop in case the model slips.
// Any of these in a reply is a sign it strayed into promising something
// not in the KNOWLEDGE, so we discard the reply rather than send it.
const PRICE_PROMISE = /\$\s?(?!0\b)\d/; // any dollar amount other than $0
const DISCOUNT_PROMISE = /\b\d{1,3}\s?%\s*(off|discount)\b|\bdiscount\b|\bcoupon\b|\bpromo\s*code\b/i;
const REFUND_PROMISE = /\brefund(ed|ing)?\b/i;
const GUARANTEE_PROMISE = /\bguarantee(d)?\b/i;
const DATE_PROMISE = /\b(by|within)\s+(tomorrow|tonight|\d+\s*(hours?|days?|weeks?)|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

function violatesHardLimits(text) {
  return PRICE_PROMISE.test(text) || DISCOUNT_PROMISE.test(text) || REFUND_PROMISE.test(text) ||
    GUARANTEE_PROMISE.test(text) || DATE_PROMISE.test(text);
}

const FALLBACK_REPLY =
  "I'm not able to confirm that from our FAQ and pricing pages. Everything live today is free ($0) and our Pro tier doesn't have a price yet, so I can't promise pricing, discounts, refunds, or dates beyond what's written there. I can pass your question to a person — use our contact form and we'll get back to you by email: " + CONTACT_LINK;

// ---- Logging: no name/email/payment fields in the schema; text is
// scrubbed for common PII patterns as a best-effort filter. -------------

function redact(text) {
  return String(text || "")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted email]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted number]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[redacted phone]")
    .slice(0, 2000);
}

async function logTurn(env, { conversationId, page, userMessage, assistantMessage, escalated, blocked }) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    await fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/support_messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: SUPABASE_KEY,
        authorization: "Bearer " + SUPABASE_KEY,
        prefer: "return=minimal",
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        page: clean(page, 40) || "other",
        user_message: redact(userMessage),
        assistant_message: redact(assistantMessage),
        escalated: !!escalated,
        blocked: !!blocked,
      }),
    });
  } catch {
    /* logging is best-effort; never fail the user-facing reply over it */
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400); }

  const userMessage = clean(body.message);
  if (!userMessage) return json({ error: "bad_request" }, 400);
  const page = clean(body.page, 40);
  const conversationId = /^[0-9a-f-]{36}$/i.test(body.conversationId || "") ? body.conversationId : crypto.randomUUID();
  const history = cleanHistory(body.history);

  // Hard limit #4, enforced before the model ever sees the message.
  if (looksLikeSensitive(userMessage)) {
    context.waitUntil(logTurn(env, { conversationId, page, userMessage, assistantMessage: SENSITIVE_REPLY, escalated: false, blocked: true }));
    return json({ reply: SENSITIVE_REPLY });
  }

  if (!(await checkRateLimit(env, request.headers.get("CF-Connecting-IP")))) {
    return json({ error: "rate_limited" }, 429);
  }

  if (!env.AI) {
    context.waitUntil(logTurn(env, { conversationId, page, userMessage, assistantMessage: FALLBACK_REPLY, escalated: true, blocked: false }));
    return json({ reply: FALLBACK_REPLY });
  }

  const messages = [
    { role: "system", content: `${PERSONA}\n\n${RULES}\n\nKNOWLEDGE (the only source you may answer from):\n${KNOWLEDGE}` },
    ...history,
    { role: "user", content: userMessage },
  ];

  let reply;
  try {
    const output = await env.AI.run(MODEL, { messages, max_tokens: 300, temperature: 0.2 });
    const r = output && output.response;
    reply = (typeof r === "string" ? r : "").trim();
  } catch {
    reply = "";
  }

  let blocked = false;
  if (!reply || violatesHardLimits(reply)) {
    reply = FALLBACK_REPLY;
    blocked = true;
  }

  const escalated = blocked || reply.includes(CONTACT_LINK);
  context.waitUntil(logTurn(env, { conversationId, page, userMessage, assistantMessage: reply, escalated, blocked }));

  return json({ reply, conversationId });
}
