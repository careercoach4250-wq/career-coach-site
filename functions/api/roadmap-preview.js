/* Career Coach — instant roadmap preview (Cloudflare Pages Function).
   Generates a short, illustrative 5-phase roadmap preview from a visitor's
   class year, academic focus, and target direction, using the same Workers
   AI binding as the chat assistant (functions/api/chat.js) — no separate
   Cloudflare setup needed. Grounded in the same verified Tulane facts used
   on resources.html and coaching-roadmaps.html's Maya Torres example, so it
   doesn't invent clubs/programs/stats beyond what's actually confirmed. */

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
const MAX_FIELD_LEN = 80;
const RATE_LIMIT_PER_HOUR = 20;
const PHASES = ["discover", "plan", "prepare", "connect", "apply"];

const SYSTEM_PROMPT = `You generate a SHORT, illustrative career-roadmap preview for a Tulane University undergraduate, based on their class year, academic focus, and target career direction.

Structure the roadmap in exactly five phases: Discover, Plan, Prepare, Connect, Apply. Write ONE sentence per phase (max ~25 words each), specific to what this student typed, not generic filler.

VERIFIED FACTS you may draw on when relevant to their target direction — do not invent anything beyond these:
- Investment banking / finance: Green Bull Investment Banking Group (Tulane's top IB club), Wall Street Krewe, the Darwin Fenner Fund, and Freeman Career Management Center, whose own published timeline shows junior-internship applications can open as early as January of sophomore year.
- Law: Tulane's 3+3 law pipeline (an accelerated path into Tulane Law).
- Health / medicine / public health: Tulane's public health school, ranked top-10 nationally.
- Entrepreneurship / startups: the Albert Lepage Center for Entrepreneurship and Innovation, which funds student ventures.
- Any track: Tulane's public-service graduation requirement, and Tulane's alumni network in New York, DC, Atlanta, and Houston for post-grad networking.
- For directions not covered above (e.g. tech, consulting, nonprofit, undecided), give solid general career-development advice for that field without naming specific unverified Tulane clubs or programs.

Respond with ONLY a single JSON object, no markdown fences, no commentary, in exactly this shape:
{"discover":"...","plan":"...","prepare":"...","connect":"...","apply":"..."}`;

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
    });
  } catch {
    return json({ preview: fallbackPreview(), source: "fallback" });
  }

  const preview = output && output.response ? extractJson(String(output.response)) : null;

  if (!preview) {
    return json({ preview: fallbackPreview(), source: "fallback" });
  }

  return json({ preview, source: "ai" });
}
