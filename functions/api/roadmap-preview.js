/* Career Coach — instant roadmap preview (Cloudflare Pages Function).
   Generates a short, illustrative 5-phase roadmap preview from a visitor's
   class year, academic focus, and target direction, using the same Workers
   AI binding as the chat assistant (functions/api/chat.js) — no separate
   Cloudflare setup needed. Grounded in the same verified Tulane facts used
   on resources.html and coaching-roadmaps.html's Maya Torres example, so it
   doesn't invent clubs/programs/stats beyond what's actually confirmed. */

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_FIELD_LEN = 80;
const RATE_LIMIT_PER_HOUR = 20;
const PHASES = ["discover", "plan", "prepare", "connect", "apply"];

// Real, verified Tulane orgs/programs the model is allowed to name. Any other
// club/org/program-shaped phrase in the AI's output fails the safety check
// below and triggers the generic fallback instead of being shown to visitors.
const ALLOWED_ORGS = [
  "green bull",
  "wall street krewe",
  "darwin fenner fund",
  "freeman career management center",
  "freeman cmc",
  "3+3 law",
  "tulane law",
  "albert lepage center",
  "lepage center",
  "tulane law school",
];

const SYSTEM_PROMPT = `You generate a SHORT, illustrative career-roadmap preview for a Tulane University undergraduate, based ONLY on the class year, academic focus, and target career direction they provide. Never assume unstated details (background, skills, hobbies) beyond what they typed.

Structure the roadmap in exactly five phases: Discover, Plan, Prepare, Connect, Apply. Write ONE sentence per phase (max ~25 words each), tailored to their major and target direction, not generic filler.

You may name ONLY these specific verified Tulane organizations, and only when directly relevant:
- Investment banking / finance target: Green Bull Investment Banking Group, Wall Street Krewe, the Darwin Fenner Fund, and Freeman Career Management Center (whose published timeline shows junior-internship applications can open as early as January of sophomore year).
- Law target: Tulane's 3+3 law pipeline into Tulane Law School.
- Health / medicine / public health target: Tulane's public health school (ranked top-10 nationally) — name the ranking, not a specific club.
- Entrepreneurship / startups target: the Albert Lepage Center for Entrepreneurship and Innovation.

STRICT RULE: for any target direction not listed above (e.g. software engineering, tech, consulting, marketing, nonprofit, undecided, art, science, etc.), you MUST NOT invent or name ANY specific club, organization, program, competition, or event of any kind — Tulane-specific or generic (no "coding club," "hackathon," "game dev club," fabricated or otherwise). Instead give solid, general career-development advice for that field: building relevant skills, a portfolio or resume, seeking internships, and networking with alumni or professionals in that field, described generically without naming any specific group.

Respond with ONLY a single JSON object, no markdown fences, no commentary, in exactly this shape:
{"discover":"...","plan":"...","prepare":"...","connect":"...","apply":"..."}`;

// Detects "Capitalized Phrase" + org-like suffix word as a heuristic for a
// named club/organization the model may have invented.
const ORG_PATTERN =
  /\b(?:[A-Z][a-zA-Z'&.]*\s+){1,5}(?:Club|Group|Society|Association|Fund|Center|Centre|Program|Network|Krewe|Consulting|Jam|Hackathon|Guild|Alliance|Coalition|Fellowship|Institute)\b/g;

function containsUnverifiedOrg(text) {
  const matches = text.match(ORG_PATTERN);
  if (!matches) return false;
  return matches.some((m) => !ALLOWED_ORGS.some((allowed) => m.toLowerCase().includes(allowed)));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function clean(v) {
  return typeof v === "string" ? v.trim().slice(0, MAX_FIELD_LEN) : "";
}

async function checkRateLimit(env, ip) {
  if (!env.RATE_LIMIT_KV || !ip) return true;
  const key = `rl:preview:${ip}:${Math.floor(Date.now() / 3600000)}`;
  const current = parseInt((await env.RATE_LIMIT_KV.get(key)) || "0", 10);
  if (current >= RATE_LIMIT_PER_HOUR) return false;
  await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 7200 });
  return true;
}

function fallbackPreview() {
  return {
    discover: "Explore how your interests connect to real career paths, using Tulane's own resources as a starting point.",
    plan: "Pick one or two Tulane clubs, programs, or classes that build directly toward your target direction.",
    prepare: "Build the specific skills and a resume that speak to that direction, with feedback from Freeman Career Management Center or your school's career office.",
    connect: "Reach out to Tulane alumni and upperclassmen already in that field for coffee chats and advice.",
    apply: "Target internships and opportunities early — many application windows open earlier than students expect.",
  };
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (PHASES.every((p) => typeof parsed[p] === "string" && parsed[p].trim())) {
      const out = {};
      for (const p of PHASES) out[p] = parsed[p].trim().slice(0, 300);
      const combined = PHASES.map((p) => out[p]).join(" ");
      if (containsUnverifiedOrg(combined)) return null;
      return out;
    }
  } catch {
    /* fall through to null */
  }
  return null;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.AI) {
    return json({ preview: fallbackPreview(), source: "fallback" });
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

  const year = clean(body.year);
  const major = clean(body.major);
  const target = clean(body.target);
  if (!year || !major || !target) {
    return json({ error: "bad_request" }, 400);
  }

  const userMessage = `Class year: ${year}\nAcademic focus / major: ${major}\nTarget career direction: ${target}`;

  let output;
  try {
    output = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 400,
      temperature: 0.3,
    });
  } catch (err) {
    return json({ preview: fallbackPreview(), source: "fallback", debug: String(err && err.message ? err.message : err) });
  }

  const preview = output && output.response ? extractJson(String(output.response)) : null;

  if (!preview) {
    return json({ preview: fallbackPreview(), source: "fallback", debugRaw: output && output.response ? String(output.response) : null });
  }

  return json({ preview, source: "ai" });
}
