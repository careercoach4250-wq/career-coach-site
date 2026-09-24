/* Career Coach — AI Career Coach backend (Cloudflare Pages Function).
   One endpoint for every AI feature on the site, selected by `mode`:
     coach               full-page AI Career Coach chat (streams)
     widget              the small floating chat bubble (streams, shorter answers)
     case                case-interview practice partner (streams)
     resume              AI resume feedback
     cover_letter        tailored cover letter draft
     interview_questions practice questions for a role
     interview_feedback  feedback on a practice answer
     roadmap             structured personalized roadmap (JSON)
   Uses the existing Workers AI binding ("AI"); no API key needed. Optional
   RATE_LIMIT_KV binding enables per-visitor rate limiting. Nothing sent here
   is stored by Career Coach. */

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const RATE_LIMIT_PER_MINUTE = 15;
const MAX_FIELD = 12000;
const MAX_HISTORY = 16;
const MAX_HISTORY_CHARS = 24000;

// Verified facts only. Anything not here must be described generically.
const TULANE_FACTS = `VERIFIED TULANE FACTS (the only Tulane-specific names you may use):
- Freeman Career Management Center (Freeman CMC) is Tulane's business-school career center. Its published recruiting timeline shows junior-internship applications for competitive tracks like investment banking can open as early as January of sophomore year. Consulting's junior-internship applications open later than banking's.
- Verified active finance student organizations: Green Bull Investment Banking Group (selective, roughly 20 students a year), Wall Street Krewe (a broader finance community), and the Darwin Fenner Fund (student-managed investment fund).
- Tulane has a 3+3 law pipeline into Tulane Law School.
- Tulane's public health school is ranked top-10 nationally.
- The Albert Lepage Center for Entrepreneurship and Innovation supports student entrepreneurs.
- Tulane has a public-service graduation requirement and a standout real estate program.
- Tulane's alumni network is strong in New Orleans, New York, DC, Atlanta, and Houston. LinkedIn's alumni tool is a good starting point for outreach.`;

const SITE_FACTS = `ABOUT CAREER COACH (the platform you are part of):
- Career Coach is a career platform built by Tulane students, launching at Tulane University (about 8,500 undergraduates). Access is planned for @tulane.edu emails.
- Tabs: Home, About, Job Finding (resume review, cover letters, case prep, interview prep, job and internship listings), Coaching & Roadmap (personalized roadmap builder), and AI Career Coach (you).
- Students can book a real 30-minute mock interview with Asaf on the Job Finding page (Interview Prep).
- Pricing hasn't been decided; everything is free right now. A formal privacy policy is still a draft.
- For anything else, students can use the Contact form (Get Started page).`;

const HONESTY = `HONESTY RULES (always follow):
- Never invent specific clubs, organizations, course names or numbers, professors, deadlines, statistics, salaries, or company programs. Only name Tulane organizations from the verified list. Otherwise describe things generically in lowercase (e.g. "a student consulting club", "an intro accounting course") and tell the student to confirm in their school's student-organization directory or course catalog.
- Well-known public certifications and tools (e.g. CFA, Bloomberg Market Concepts, Excel, SQL, Python, Google Analytics) are fine to mention.
- Never promise outcomes (offers, admissions). Recruiting timelines vary by firm and year; tell students to confirm dates with their career center.
- Never invent experience, metrics, or details about the student. Use only what they told you or what is in their profile.
- If the school isn't Tulane, don't use Tulane-specific facts.`;

const PERSONA = `You are the AI Career Coach on Career Coach, a career platform for university students and recent graduates. You're a warm, direct mentor in the student's corner: encouraging but honest, clear over clever, no corporate jargon. You help with career exploration, recruiting timelines, resumes, cover letters, case and behavioral interviews, networking, clubs, classes, skills, and internships.`;

const FORMAT = `FORMATTING: Use Markdown. Short paragraphs, "###" headings only when the answer has distinct parts, bullet or numbered lists for steps, **bold** for key terms. Be specific and practical. Keep most answers under 350 words unless the student asks for something long (like a full roadmap or resume review). End with one concrete next step or a short follow-up question when it helps.`;

function profileText(p) {
  if (!p || typeof p !== "object") return "";
  const fields = [
    ["Name", p.name], ["School", p.school], ["Class year", p.year], ["Major / focus", p.major],
    ["Interests", p.interests], ["Target industry", p.industry], ["Target roles", p.roles],
    ["Experience so far", p.experience], ["Preferred locations", p.locations], ["Goals", p.goals],
  ].filter(([, v]) => typeof v === "string" && v.trim());
  if (!fields.length) return "";
  return "STUDENT PROFILE (already provided by the student; use it and don't ask for it again):\n" +
    fields.map(([k, v]) => `- ${k}: ${v.trim().slice(0, 400)}`).join("\n");
}

function system(parts) {
  return parts.filter(Boolean).join("\n\n");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function str(v, max = MAX_FIELD) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

async function checkRateLimit(env, ip) {
  if (!env.RATE_LIMIT_KV || !ip) return true;
  const key = `rl:coach:${ip}:${Math.floor(Date.now() / 60000)}`;
  const current = parseInt((await env.RATE_LIMIT_KV.get(key)) || "0", 10);
  if (current >= RATE_LIMIT_PER_MINUTE) return false;
  await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 120 });
  return true;
}

function cleanHistory(messages) {
  if (!Array.isArray(messages)) return [];
  const out = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_FIELD) }));
  // Drop oldest turns until the total fits.
  let total = out.reduce((n, m) => n + m.content.length, 0);
  while (out.length > 1 && total > MAX_HISTORY_CHARS) total -= out.shift().content.length;
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

const CASE_TYPES = {
  profitability: "a profitability case (a company's profits are declining)",
  "market-sizing": "a market-sizing / estimation case",
  "market-entry": "a market-entry case (should a company enter a new market?)",
  "m-and-a": "an M&A / acquisition case",
  pricing: "a pricing case for a new product",
  growth: "a revenue growth strategy case",
};

// ---- Roadmap (structured JSON) ----------------------------------------

const ALLOWED_ORGS = [
  "green bull", "wall street krewe", "darwin fenner fund", "freeman career management center",
  "freeman cmc", "3+3 law", "tulane law", "albert lepage center", "lepage center", "cfa institute",
  "public health", "tulane university", "career management center",
];
const ORG_PATTERN =
  /\b(?:[A-Z][a-zA-Z'&.]*\s+){1,5}(?:Club|Group|Society|Association|Fund|Center|Centre|Program|Network|Krewe|Consulting|Hackathon|Guild|Alliance|Coalition|Fellowship|Institute|Council|Committee|League|Organization)\b/g;
const COURSE_CODE = /\b[A-Z]{3,4}\s?-?\d{3,4}\b/;

function unverified(text) {
  if (COURSE_CODE.test(text)) return true;
  const matches = text.match(ORG_PATTERN);
  return !!matches && matches.some((m) => !ALLOWED_ORGS.some((a) => m.toLowerCase().includes(a)));
}

const REC_KEYS = ["clubs", "classes", "skills", "certifications", "networking", "internships", "extracurriculars"];

const ROADMAP_PROMPT = `You build a personalized career roadmap for a university student from their profile. Be specific to their year, major, and target, and practical.

${TULANE_FACTS}

${HONESTY}

Timeline: start at the student's CURRENT point (e.g. a sophomore starts at "Sophomore fall" or "Sophomore spring") and run through graduation. Use 5 to 7 milestones with short period labels such as "Sophomore fall", "Sophomore spring", "Summer after sophomore year", "Junior fall — recruiting season", "Junior summer", "Senior year", "Before graduation". For recent grads or grad students, use month ranges ("Next 3 months", "Months 3–6", ...).

Respond with ONLY one JSON object (no markdown fences, no commentary) in exactly this shape:
{
 "headline": "short title like 'Sophomore Finance → Investment Banking'",
 "summary": "2 sentences on the overall strategy",
 "careerPaths": [{"title": "...", "why": "one sentence"}],
 "milestones": [{"period": "...", "title": "3-5 word phase name", "focus": "one sentence", "actions": ["3 to 4 concrete actions"], "checkpoint": "what should be true by the end"}],
 "recommendations": {
   "clubs": ["3-4 items"], "classes": ["3-4 items"], "skills": ["4-5 items"], "certifications": ["2-3 items"],
   "networking": ["3-4 items"], "internships": ["3 items: types of internship to target and when"], "extracurriculars": ["2-3 items"]
 },
 "keyDates": [{"when": "...", "what": "..."}]
}
careerPaths: 3 items (their stated target first, then 2 related alternatives). keyDates: 3-5 recruiting milestones, phrased as approximate ("typically", "as early as"). Each list item under 160 characters.`;

function fallbackRoadmap(p) {
  const target = str(p.roles || p.industry || p.goals, 80) || "your target career";
  const major = str(p.major, 60) || "your major";
  return {
    headline: `${major} → ${target}`,
    summary: "A general plan while our AI is unavailable: explore early, build relevant skills and experience, network steadily, and apply earlier than you think. Try again in a minute for a fully personalized version.",
    careerPaths: [{ title: target, why: "Your stated goal." }],
    milestones: [
      { period: "This semester", title: "Explore and get involved", focus: "Learn what the path really involves and join the right communities.", actions: ["Meet with your career center to talk through your goal", "Join one student organization tied to your target field", "Talk to two upperclassmen or alumni in the field"], checkpoint: "You can explain what the job involves and why you want it." },
      { period: "Next semester", title: "Build skills and your resume", focus: "Turn interest into evidence.", actions: ["Take a course that builds a core skill for the field", "Rebuild your resume and get it reviewed", "Start one project or leadership role you can talk about"], checkpoint: "A reviewed resume with at least one relevant experience." },
      { period: "Summer", title: "Get experience", focus: "Any relevant experience compounds.", actions: ["Pursue an internship, research role, or relevant job", "Keep networking, one conversation every week or two", "Practice interview questions"], checkpoint: "A concrete experience to discuss in interviews." },
      { period: "Recruiting season", title: "Apply and interview", focus: "Apply early and prepare deliberately.", actions: ["Track application openings; many open earlier than expected", "Do mock interviews", "Follow up with your network before applying"], checkpoint: "Applications submitted and interviews underway." },
      { period: "Before graduation", title: "Close it out", focus: "Land the role and finish strong.", actions: ["Convert internships to return offers where possible", "Run a full-time search in parallel if needed", "Complete graduation requirements"], checkpoint: "Offer signed and requirements complete." },
    ],
    recommendations: {
      clubs: ["A student organization focused on your target field (check your school's student-org directory)"],
      classes: ["A course that builds the core technical skill for your target role"],
      skills: ["Communication and storytelling", "Excel or another core tool for your field"],
      certifications: ["An entry-level certification relevant to your field, if one is commonly expected"],
      networking: ["Use LinkedIn's alumni tool to find alumni in your target field", "Aim for one coffee chat every one to two weeks"],
      internships: ["Any role in or near your target field, even small or local"],
      extracurriculars: ["A leadership role in a club you care about"],
    },
    keyDates: [{ when: "Varies by field", what: "Confirm your field's recruiting timeline with your career center early." }],
  };
}

function strList(v, n) {
  return (Array.isArray(v) ? v : []).filter((x) => typeof x === "string" && x.trim())
    .map((x) => x.trim().slice(0, 220)).filter((x) => !unverified(x)).slice(0, n);
}

function validateRoadmap(r) {
  if (!r || typeof r !== "object") return null;
  const milestones = (Array.isArray(r.milestones) ? r.milestones : []).map((m) => m && {
    period: str(m.period, 60), title: str(m.title, 80), focus: str(m.focus, 260),
    actions: strList(m.actions, 5), checkpoint: str(m.checkpoint, 260),
  }).filter((m) => m && m.period && m.title && m.actions.length).slice(0, 8);
  if (milestones.length < 3) return null;
  for (const m of milestones) {
    if (unverified(m.focus)) m.focus = "";
    if (unverified(m.checkpoint)) m.checkpoint = "";
  }
  const recommendations = {};
  const rec = r.recommendations || {};
  for (const k of REC_KEYS) recommendations[k] = strList(rec[k], 6);
  return {
    headline: unverified(str(r.headline, 120)) ? "Your career roadmap" : str(r.headline, 120) || "Your career roadmap",
    summary: unverified(str(r.summary, 500)) ? "" : str(r.summary, 500),
    careerPaths: (Array.isArray(r.careerPaths) ? r.careerPaths : []).map((c) => c && { title: str(c.title, 80), why: str(c.why, 220) })
      .filter((c) => c && c.title && !unverified(c.title + " " + c.why)).slice(0, 4),
    milestones,
    recommendations,
    keyDates: (Array.isArray(r.keyDates) ? r.keyDates : []).map((d) => d && { when: str(d.when, 80), what: str(d.what, 220) })
      .filter((d) => d && d.when && d.what && !unverified(d.what)).slice(0, 6),
  };
}

function parseJsonResponse(response) {
  if (response && typeof response === "object") return response;
  if (typeof response !== "string") return null;
  const m = response.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// ---- Request handling ---------------------------------------------------

function buildRequest(mode, body) {
  const profile = profileText(body.profile);
  switch (mode) {
    case "coach":
    case "widget":
      return {
        stream: true,
        max_tokens: mode === "widget" ? 350 : 1200,
        temperature: 0.5,
        messages: [
          { role: "system", content: system([PERSONA, SITE_FACTS, TULANE_FACTS, HONESTY, FORMAT, profile,
            mode === "widget" ? "You're in the small chat bubble: keep answers under 120 words. For deeper help (roadmaps, resume reviews, interview practice), suggest opening the AI Career Coach tab." : ""]) },
          ...cleanHistory(body.messages),
        ],
      };
    case "case": {
      const caseType = CASE_TYPES[body.caseType] || CASE_TYPES.profitability;
      return {
        stream: true,
        max_tokens: 700,
        temperature: 0.6,
        messages: [
          { role: "system", content: system([
            `You are a friendly but rigorous case interviewer at a top consulting firm, running ${caseType} with a student. Run it like a real interview, one step at a time:
1. When the student says they're ready, give a realistic, fictional case prompt (invent a plausible fictional company; no real company data) and ask how they'd structure it.
2. React to their framework, then reveal data only when they ask for it or reach the right branch (give numbers as simple tables or bullets).
3. Include one quick math question and ask for a final recommendation at the end.
4. Keep each turn short (under 150 words). Don't solve it for them; nudge if they're stuck.
If the student types "feedback" or finishes with a recommendation, give structured feedback in Markdown: **Structure**, **Analysis & math**, **Communication**, **Recommendation**, each with a 1–5 score and one concrete tip, then an overall score.`,
            profile]) },
          ...cleanHistory(body.messages),
        ],
      };
    }
    case "resume": {
      const resume = str(body.resume);
      if (resume.length < 40) return null;
      const job = str(body.job);
      return {
        max_tokens: 1300,
        temperature: 0.3,
        messages: [
          { role: "system", content: system([PERSONA, HONESTY, profile,
            `Review the student's resume${job ? " against the job description" : ""}. Respond in Markdown with these sections:
### Overall impression
2–3 sentences, honest.
### Top fixes
The 3–5 highest-impact changes, most important first.
### Bullet rewrites
Pick 3 weak bullets. For each show **Before:** and **After:**. Rewrites may restructure wording and add a placeholder like [X%] or [#] where a number belongs, but must NOT invent facts or metrics.
${job ? "### Keywords from the job\nImportant skills/keywords from the job description that are missing or weak in the resume.\n" : ""}### Format & polish
Brief notes on length, section order, consistency.`]) },
          { role: "user", content: `RESUME:\n${resume}${job ? `\n\nJOB DESCRIPTION:\n${job}` : ""}` },
        ],
      };
    }
    case "cover_letter": {
      const role = str(body.role, 120);
      const company = str(body.company, 120);
      if (!role || !company) return null;
      return {
        max_tokens: 900,
        temperature: 0.55,
        messages: [
          { role: "system", content: system([HONESTY, profile,
            `Write a tailored cover letter for a student. 250–350 words, 3–4 paragraphs, ${str(body.tone, 40) || "professional and warm"} tone. Open with a specific hook for this company and role (not "I am writing to apply"). Connect the student's real experience to the role's needs. Use ONLY the experience given in the profile or highlights; never invent experiences, metrics, or facts about the company beyond the job description. If the student's name is unknown, sign as [Your Name]. Output only the letter text, starting with "Dear Hiring Manager," (or the named contact if given), no commentary.`]) },
          { role: "user", content: `Role: ${role}\nCompany: ${company}\n${str(body.contact, 80) ? `Addressed to: ${str(body.contact, 80)}\n` : ""}Job description:\n${str(body.jobDescription) || "(not provided)"}\n\nWhat I want to highlight:\n${str(body.highlights) || "(use my profile)"}` },
        ],
      };
    }
    case "interview_questions": {
      const type = str(body.type, 40) || "behavioral";
      const role = str(body.role, 120) || "an entry-level role";
      return {
        max_tokens: 400,
        temperature: 0.7,
        messages: [
          { role: "system", content: system([profile,
            `Generate 5 realistic ${type} interview questions for a student interviewing for ${role}. Mix difficulty. For technical questions, match what's commonly asked for that role at the entry level. Output exactly 5 lines, one question per line, no numbering, no extra text.`]) },
          { role: "user", content: `Give me 5 ${type} questions for ${role}.` },
        ],
      };
    }
    case "interview_feedback": {
      const question = str(body.question, 600);
      const answer = str(body.answer, 6000);
      if (!question || answer.length < 10) return null;
      return {
        max_tokens: 800,
        temperature: 0.35,
        messages: [
          { role: "system", content: system([HONESTY, profile,
            `You're an experienced interviewer coaching a student. Evaluate their answer to a ${str(body.type, 40) || "behavioral"} interview question${str(body.role, 120) ? ` for ${str(body.role, 120)}` : ""}. Respond in Markdown:
**Score: X/10** — one-line verdict
### What worked
2–3 bullets
### What to improve
2–3 specific bullets (for behavioral answers, check STAR: situation, task, action, result, and whether the result is quantified)
### A stronger answer
A short improved outline built ONLY from what they said, with [brackets] where they should add their own specifics. Don't invent experiences.`]) },
          { role: "user", content: `Question: ${question}\n\nMy answer: ${answer}` },
        ],
      };
    }
    case "roadmap": {
      const p = body.profile || {};
      if (!str(p.major) && !str(p.roles) && !str(p.industry) && !str(p.goals)) return null;
      return {
        roadmap: true,
        max_tokens: 2400,
        temperature: 0.3,
        messages: [
          { role: "system", content: ROADMAP_PROMPT },
          { role: "user", content: profileText(p) || "No profile given." },
        ],
      };
    }
    default:
      return null;
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_request" }, 400); }
  const mode = str(body.mode, 30);
  const req = buildRequest(mode, body);
  if (!req) return json({ error: "bad_request" }, 400);

  if (!env.AI) {
    return req.roadmap ? json({ roadmap: fallbackRoadmap(body.profile || {}), source: "fallback" }) : json({ error: "not_configured" }, 503);
  }
  if (!(await checkRateLimit(env, request.headers.get("CF-Connecting-IP")))) {
    return json({ error: "rate_limited" }, 429);
  }

  const params = { messages: req.messages, max_tokens: req.max_tokens, temperature: req.temperature };
  const wantsStream = req.stream && body.stream === true;

  if (wantsStream) {
    try {
      const stream = await env.AI.run(MODEL, { ...params, stream: true });
      return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
    } catch {
      /* fall through to a normal request */
    }
  }

  let output;
  try {
    output = await env.AI.run(MODEL, params);
  } catch {
    return req.roadmap ? json({ roadmap: fallbackRoadmap(body.profile || {}), source: "fallback" }) : json({ error: "upstream_error" }, 502);
  }

  if (req.roadmap) {
    const roadmap = validateRoadmap(parseJsonResponse(output && output.response));
    return roadmap ? json({ roadmap, source: "ai" }) : json({ roadmap: fallbackRoadmap(body.profile || {}), source: "fallback" });
  }

  const r = output && output.response;
  const reply = (typeof r === "string" ? r : r ? JSON.stringify(r) : "").trim();
  return reply ? json({ reply }) : json({ error: "empty_reply" }, 502);
}
