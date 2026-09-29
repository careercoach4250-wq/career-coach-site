/* Career Coach — resume upload + instant check (Career Toolkit → Resume, career-toolkit.html).
   Grew out of career-coach's (Asaf's) v1 analyzer prototype
   (career-coach/app/js/utils.js's analyzeResume): same rule-based, honest
   approach, expanded 2026-09-29 into a per-area review (formatting, structure,
   bullets, action verbs, impact, skills, experience, clarity, relevance, ATS).
   - Upload: PDF (via pdf.js, loaded from cdnjs only when a PDF is chosen) or
     Word .docx (unzipped with the browser's own DecompressionStream). Files are
     read in the browser and never uploaded. The extracted text fills the
     resume box; layout facts (pages, fonts, sizes, tables…) feed the checks.
   - window.CCResume exposes the current file facts and target field to
     career-toolkit.js, which sends them along with AI feedback requests. */
(function () {
  const MAX_BYTES = 5 * 1024 * 1024;
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

  const STOPWORDS = new Set(
    ("a an the and or for with of to in on at by from as is are was were be been being this that " +
      "these those it its your you we our will can may should must about into over under across per etc " +
      "who what when where which while their they them his her all any also other more most such than").split(" ")
  );

  const ACTION_VERBS = new Set((
    "accelerated achieved acquired adapted addressed administered advised advocated allocated analyzed applied appraised " +
    "architected arranged assembled assessed audited authored automated balanced benchmarked boosted briefed budgeted built " +
    "calculated campaigned captured catalogued chaired championed coached collaborated compiled completed composed computed " +
    "conceived conducted consolidated constructed consulted contributed converted coordinated created cultivated curated " +
    "cut debugged decreased defined delivered deployed designed determined developed devised diagnosed directed discovered " +
    "doubled drafted drove edited educated eliminated enabled engineered enhanced established evaluated examined executed " +
    "expanded expedited facilitated finalized forecasted formulated founded fundraised gathered generated grew guided halved " +
    "headed hired identified implemented improved increased influenced initiated innovated inspected installed instituted " +
    "instructed integrated interviewed introduced invented investigated launched led leveraged lobbied maintained managed " +
    "mapped marketed maximized measured mentored merged migrated minimized mobilized modeled moderated monitored motivated " +
    "negotiated operated optimized orchestrated organized originated outperformed overhauled oversaw partnered performed " +
    "persuaded piloted pioneered pitched planned prepared presented prioritized processed produced programmed projected " +
    "promoted proposed prototyped published raised ran recommended reconciled recruited redesigned reduced refactored " +
    "refined reorganized reported represented researched resolved restructured revamped reviewed revitalized saved scaled " +
    "scheduled screened secured selected served shaped simplified sold solved sourced spearheaded standardized " +
    "steered streamlined strengthened structured summarized supervised surpassed surveyed synthesized taught tested tracked " +
    "trained transformed translated tripled troubleshot tutored underwrote unified upgraded valued verified volunteered " +
    "won wrote").split(" "));

  const WEAK_OPENER = /^(responsible for|helped|assisted|worked (on|with|at|in)|duties (included|include)|participated in|involved in|tasked with|in charge of|handled|was |were |did |got |tried |attended )/i;
  const BUZZWORDS = ["hard-working", "hardworking", "team player", "detail-oriented", "detail oriented", "go-getter", "self-starter",
    "results-driven", "results-oriented", "synergy", "think outside the box", "dynamic", "passionate", "motivated individual",
    "excellent communication skills", "fast learner", "quick learner", "people person", "best of breed", "rockstar", "ninja"];

  const HEADING = /^(education|academics?|(relevant |professional |work |industry |internship |research |leadership )?experience|employment( history)?|work history|leadership( (&|and) (activities|involvement|experience))?|activities|extracurriculars?( activities)?|campus involvement|involvement|(technical )?skills|skills,? .*|(additional|other) (information|skills)|additional|interests|projects|(selected |academic |personal |technical )?projects|certifications?( (&|and) .*)?|licenses( (&|and) certifications)?|honors( (&|and) awards)?|awards|summary|profile|objective|publications|research|volunteer(ing| experience| work)?|community (service|involvement)|(relevant )?coursework|languages|portfolio|deal experience|investment experience|transaction experience)$/i;
  const EDU_SIGNAL = /\b(university|college|bachelor|b\.?\s?[as]\.?|b\.?b\.?a\.?|b\.?s\.?e\.?|gpa|expected (graduation|may|december|dec\.?|june)|class of 20\d\d|major|minor)\b/i;
  const EXP_SIGNAL = /\b(intern(ship)?|analyst|assistant|associate|representative|coordinator|fellow|consultant|developer|engineer)\b/i;
  const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
  const PHONE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
  const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec";
  const BULLET_GLYPH = /^\s*([•▪◦●‣∙·■□➢➤►✓✔–—]|[-*](?=\s))\s*/;

  // Keyword sets per field, used for the skills and relevance checks.
  const FIELDS = [
    { key: "vcpe", label: "venture capital / private equity", test: /venture|\bvc\b|private equity|\bpe\b|growth equity|buyout|search fund/i,
      terms: ["financial model", "valuation", "due diligence", "investment memo", "market map", "sourc", "lbo", "startup", "excel", "thesis", "cap table", "portfolio compan"] },
    { key: "finance", label: "investment banking / finance", test: /bank|financ|\bib\b|investment|equity research|trading|asset management|wealth|capital markets|hedge fund|credit/i,
      terms: ["excel", "financial model", "valuation", "dcf", "powerpoint", "financial statement", "comparable", "pitch", "m&a", "lbo", "bloomberg", "capital iq", "factset", "accounting"] },
    { key: "consulting", label: "consulting", test: /consult|strategy|strategic/i,
      terms: ["excel", "powerpoint", "data analysis", "market research", "recommend", "stakeholder", "client", "strategy", "present", "survey", "team", "tableau"] },
    { key: "accounting", label: "accounting", test: /account|audit|\btax\b|\bcpa\b|assurance|bookkeep/i,
      terms: ["gaap", "excel", "reconcil", "audit", "tax", "journal entr", "financial statement", "quickbooks", "accounts payable", "accounts receivable", "pivot table", "cpa"] },
    { key: "marketing", label: "marketing", test: /marketing|brand|social media|advertis|communications|public relations|\bpr\b|content|growth marketing|digital media/i,
      terms: ["social media", "campaign", "content", "google analytics", "engagement", "seo", "canva", "adobe", "email", "brand", "copywriting", "hubspot"] },
    { key: "tech", label: "technology", test: /software|engineer|developer|\btech|data|computer|\bswe\b|machine learning|\bai\b|\bml\b|product manag|cyber|\bit\b|web/i,
      terms: ["python", "java", "javascript", "sql", "git", "react", "api", "aws", "c++", "testing", "data structures", "linux"] },
  ];

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const words = (s) => (s.match(/[A-Za-z0-9][A-Za-z0-9'’&+.#/-]*/g) || []);
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function fieldFor(target) {
    return target ? FIELDS.find((f) => f.test.test(target)) || null : null;
  }

  // ---- Text parsing -----------------------------------------------------------

  function isHeading(line) {
    const clean = line.replace(/[:|]+$/, "").trim();
    if (clean.length > 48 || !clean) return false;
    if (HEADING.test(clean)) return true;
    // Short ALL-CAPS lines are almost always section headings.
    return clean.length >= 4 && clean === clean.toUpperCase() && /[A-Z]{3}/.test(clean) && !/\d/.test(clean) && words(clean).length <= 5 && !EMAIL.test(clean);
  }

  function firstWord(b) {
    const w = (b.match(/[A-Za-z][A-Za-z-]*/) || [""])[0].toLowerCase();
    return w;
  }

  function parse(text) {
    const raw = (text || "").replace(/\r/g, "").replace(/ /g, " ");
    let lines = raw.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
    // Pasted as one block (common when copying from a PDF or notes app):
    // split on bullet glyphs and sentence ends so the checks still work.
    const asBlock = lines.length < 6 && raw.length > 400;
    if (asBlock) {
      lines = raw.replace(/\s+/g, " ")
        .split(/(?=\s[•▪◦●‣∙·■➢➤►])|(?<=[.;])\s+(?=[A-Z])/)
        .map((l) => l.trim()).filter(Boolean);
    }

    const headings = [];
    const bullets = [];
    let hasGlyphs = false;
    lines.forEach((line, i) => {
      if (isHeading(line)) { headings.push({ name: line.replace(/[:|]+$/, "").trim(), index: i }); return; }
      const m = line.match(BULLET_GLYPH);
      if (m) {
        hasGlyphs = true;
        bullets.push({ text: line.slice(m[0].length).trim(), index: i });
      } else if (bullets.length && bullets[bullets.length - 1].index === i - 1 && /^[a-z(&]/.test(line)) {
        // Wrapped continuation of the previous bullet (typical in PDF text).
        const prev = bullets[bullets.length - 1];
        prev.text += " " + line;
        prev.index = i;
      } else {
        bullets.push({ text: line, index: i, loose: true });
      }
    });
    // Without bullet glyphs, treat sentence-like lines as bullets; with them,
    // loose lines are headers, dates, and titles.
    const list = bullets.filter((b) => (hasGlyphs ? !b.loose : true))
      .map((b) => b.text.replace(/\s+/g, " ").trim())
      .filter((t) => words(t).length >= 5 && !EMAIL.test(t) && !(PHONE.test(t) && words(t).length < 10));

    return { raw, lines, headings, bullets: list, asBlock, wordCount: words(raw).length };
  }

  // ---- Checks --------------------------------------------------------------------

  const GOOD = "good", LOOK = "look", FIX = "fix";

  function analyze(text, opts = {}) {
    const p = parse(text);
    const facts = opts.facts || null;
    const target = (opts.target || "").trim();
    const field = fieldFor(target);
    const jobText = (opts.job || "").trim();
    const lower = p.raw.toLowerCase();
    const out = [];
    let matchScore = null;
    const add = (id, title, status, verdict, why, examples) => out.push({ id, title, status, verdict, why, examples: examples || [] });

    const hasNum = (b) => /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|dozen|hundred|thousand|million|billion|half|double|triple)\b/i.test(b);
    const verbStart = (b) => ACTION_VERBS.has(firstWord(b));
    const weakStart = (b) => WEAK_OPENER.test(b);
    const bullets = p.bullets;
    const nb = bullets.length;

    // 1. Formatting
    {
      const issues = [], examples = [];
      let status = GOOD;
      if (facts && facts.pages > 1) { status = FIX; issues.push(`It runs ${facts.pages} pages. For internships and entry-level roles, recruiters expect one page.`); }
      if (facts && facts.fonts && facts.fonts.length > 2) { if (status === GOOD) status = LOOK; issues.push(`It uses ${facts.fonts.length} fonts (${facts.fonts.slice(0, 4).join(", ")}). Stick to one, two at most.`); }
      if (facts && facts.bodySize && facts.bodySize < 9.5) { status = FIX; issues.push(`Body text is about ${facts.bodySize}pt, which is hard to read. Use 10–11pt and trim content instead.`); }
      if (facts && facts.bodySize && facts.bodySize > 12.5) { if (status === GOOD) status = LOOK; issues.push(`Body text is about ${facts.bodySize}pt. 10–11pt looks more polished and leaves room for content.`); }
      if (!facts || !facts.pages) {
        if (p.wordCount > 850) { status = FIX; issues.push(`At about ${p.wordCount} words it will likely run past one page. Cut older or less relevant items.`); }
      }
      if (p.wordCount < 220) { if (status === GOOD) status = LOOK; issues.push(`At about ${p.wordCount} words it looks thin. Add detail to your experiences, activities, and skills so the page is full.`); }
      const dateStyles = new Set();
      if (new RegExp(`\\b(january|february|march|april|june|july|august|september|october|november|december)\\s+20\\d\\d`, "i").test(p.raw)) dateStyles.add("full month");
      if (new RegExp(`\\b(${MONTHS})\\.?\\s+20\\d\\d`, "i").test(p.raw.replace(/\b(january|february|march|april|june|july|august|september|october|november|december)\b/gi, ""))) dateStyles.add("short month");
      if (/\b(0?[1-9]|1[0-2])\/(20)?\d\d\b/.test(p.raw)) dateStyles.add("numeric");
      if (dateStyles.size > 1) {
        if (status === GOOD) status = LOOK;
        issues.push(`Dates are written in ${dateStyles.size} different styles (${[...dateStyles].join(", ")}). Pick one, such as "May 2025 – Aug 2025", and use it everywhere.`);
      }
      if (!facts) examples.push("Upload your PDF or Word file to also check page count, fonts, and font sizes.");
      add("formatting", "Formatting", status,
        status === GOOD ? "Length and consistency look right." : issues[0],
        status === GOOD
          ? "Recruiters skim a resume in seconds. A clean, consistent, one-page layout makes that skim easy, and yours doesn't show obvious problems."
          : "Recruiters often spend well under a minute on a first pass. Inconsistent or crowded formatting makes you look careless before they read a word. " + issues.slice(1).join(" "),
        examples);
    }

    // 2. Structure
    {
      const names = p.headings.map((h) => h.name.toLowerCase());
      const idx = (re) => { const h = p.headings.find((x) => re.test(x.name)); return h ? h.index : -1; };
      const eduH = idx(/educat|academic/i), expH = idx(/experience|employment|work history/i);
      const skillsH = idx(/skill/i), leadH = idx(/leadership|activit|involvement|extracurricular/i);
      const missing = [], notes = [];
      if (eduH < 0) missing.push(EDU_SIGNAL.test(p.raw) ? "an \"Education\" heading (your school details are there, but unlabeled)" : "an Education section");
      if (expH < 0) missing.push(EXP_SIGNAL.test(p.raw) || nb >= 4 ? "an \"Experience\" heading (your roles are there, but unlabeled)" : "an Experience section");
      if (skillsH < 0 && !/\bskills?\b/i.test(p.raw)) missing.push("a Skills section");
      if (leadH < 0 && !/leadership|activities|involvement|club|society|organization/i.test(p.raw)) notes.push("There's no Leadership & Activities section. For students, clubs and leadership often carry as much weight as jobs.");
      if (eduH >= 0 && expH >= 0 && expH < eduH && !/graduate|recent/i.test(opts.year || "")) notes.push("Experience comes before Education. For current students, Education usually goes first.");
      const status = missing.length ? FIX : notes.length ? LOOK : GOOD;
      add("structure", "Structure", status,
        missing.length ? `Missing ${missing.join(" and ")}.` : notes[0] || `Clear sections: ${p.headings.slice(0, 5).map((h) => h.name).join(" · ")}.`,
        status === GOOD
          ? "Clear, conventional section headings let recruiters (and applicant tracking systems) find what they need instantly."
          : "Recruiters and applicant tracking systems look for standard headings (Education, Experience, Leadership & Activities, Skills) to know where things are. Unlabeled or out-of-order sections get skimmed past. " + (missing.length ? notes.join(" ") : notes.slice(1).join(" ")),
        p.asBlock ? ["Your text came through as one block, so this check is approximate. Upload the file or paste with line breaks for a precise read."] : []);
    }

    // 3. Bullet points
    const long = bullets.filter((b) => words(b).length > 32);
    const short = bullets.filter((b) => words(b).length < 7);
    {
      let status = GOOD, verdict, why;
      if (nb < 4) {
        status = FIX;
        verdict = nb ? `Only ${nb} bullet point${nb > 1 ? "s" : ""} found.` : "No bullet points found.";
        why = "Each experience should have 2–4 bullets that say what you did and what came of it. Paragraphs or bare job titles hide your impact.";
      } else if (long.length > nb * 0.3) {
        status = LOOK;
        verdict = `${long.length} of ${nb} bullets run over 30 words.`;
        why = "Bullets that wrap past two lines get skimmed. Keep one idea per bullet: action, what you did, result. Split or trim the long ones.";
      } else if (short.length > nb * 0.3) {
        status = LOOK;
        verdict = `${short.length} of ${nb} bullets are very short.`;
        why = "Fragments like \"Managed social media\" don't show scale or results. Add what you did specifically and what changed because of it.";
      } else {
        verdict = `${nb} bullets, mostly a readable length.`;
        why = "Your bullets are scannable. The next sections check how strong each one is.";
      }
      add("bullets", "Bullet points", status, verdict, why, (long.length ? long : short).slice(0, 2).map((b) => `"${trim(b)}"`));
    }

    // 4. Action verbs
    const weak = bullets.filter(weakStart);
    const noVerb = bullets.filter((b) => !verbStart(b) && !weakStart(b));
    {
      const strong = nb - weak.length - noVerb.length;
      const counts = {};
      bullets.filter(verbStart).forEach((b) => { const w = firstWord(b); counts[w] = (counts[w] || 0) + 1; });
      const repeated = Object.entries(counts).filter(([, n]) => n >= 3).map(([w]) => w);
      let status = GOOD;
      if (nb && weak.length / nb > 0.2) status = FIX;
      else if (nb && (strong / nb < 0.6 || repeated.length)) status = LOOK;
      else if (!nb) status = LOOK;
      const parts = [];
      if (weak.length) parts.push(`${weak.length} bullet${weak.length > 1 ? "s start" : " starts"} with weak phrasing like "${trim(weak[0].match(WEAK_OPENER)[0].trim(), 20)}".`);
      if (repeated.length) parts.push(`"${cap(repeated[0])}" opens ${counts[repeated[0]]} bullets. Vary your verbs.`);
      add("verbs", "Use of action verbs", status,
        parts[0] || (nb ? `${strong} of ${nb} bullets open with a strong action verb.` : "Add bullets that start with action verbs."),
        (status === GOOD
          ? "Starting with verbs like Built, Led, Analyzed puts your contribution first."
          : "Phrases like \"Responsible for\" or \"Helped with\" describe a job, not what you did. Starting with a specific verb (Built, Led, Negotiated, Analyzed) puts your contribution first and reads as ownership.")
          + (parts[1] ? " " + parts[1] : ""),
        weak.slice(0, 2).map((b) => `"${trim(b)}"`));
    }

    // 5. Quantifying impact
    const unquant = bullets.filter((b) => !hasNum(b));
    {
      const share = nb ? Math.round(((nb - unquant.length) / nb) * 100) : 0;
      const status = !nb ? LOOK : share >= 50 ? GOOD : share >= 25 ? LOOK : FIX;
      add("impact", "Quantifying impact", status,
        nb ? `${share}% of your bullets include a number (aim for at least half).` : "No bullets to measure yet.",
        status === GOOD
          ? "Numbers (people, dollars, percentages, time saved) make your impact concrete and credible."
          : "Numbers make impact believable: \"Grew membership from 40 to 95\" beats \"Grew membership.\" Scale works too (team size, budget, number of clients, hours saved). Only use numbers you can back up in an interview.",
        unquant.filter(verbStart).slice(0, 2).map((b) => `"${trim(b)}"`));
    }

    // 6. Skills
    {
      const hasSkills = /\bskills?\b/i.test(p.raw);
      const found = field ? field.terms.filter((t) => new RegExp("\\b" + reEsc(t), "i").test(lower)) : [];
      const miss = field ? field.terms.filter((t) => !found.includes(t)) : [];
      let status = GOOD, verdict;
      if (!hasSkills) { status = FIX; verdict = "No Skills section found."; }
      else if (field && found.length < 4) { status = LOOK; verdict = `Only ${found.length} of the core ${field.label} skills we check for appear.`; }
      else verdict = field ? `Covers ${found.length} core ${field.label} skills we look for.` : "You have a Skills section. Add a target role for a field-specific check.";
      add("skills", "Skills", status, verdict,
        (!hasSkills
          ? "A short Skills section (tools, languages, certifications) is where recruiters and applicant tracking systems look for keywords. "
          : "Recruiters scan for the tools their team actually uses, so name specific ones (\"Excel: pivot tables, XLOOKUP\"), not soft skills like \"communication.\" ")
          + (field && miss.length ? `Common in ${field.label} and not on your resume: ${miss.slice(0, 6).join(", ")}. Only add what you can use and talk about in an interview.` : ""),
        []);
    }

    // 7. Experience descriptions
    {
      const pronoun = bullets.filter((b) => /\b(I|me|my)\b/.test(b));
      const duty = bullets.filter((b) => /\b(responsible for|duties|in charge of|tasked with)\b/i.test(b));
      const outcome = bullets.filter((b) => /\b(result(ing|ed)?|leading to|which|so that|increas|reduc|improv|sav|grew|won|earn|achiev|by \d)/i.test(b) || hasNum(b));
      let status = GOOD, verdict, why;
      if (duty.length >= 2 || (nb && outcome.length / nb < 0.3)) {
        status = FIX;
        verdict = duty.length >= 2 ? "Several bullets describe duties instead of accomplishments." : "Most bullets say what you did, but not what came of it.";
        why = "For each role, ask \"So what?\" A strong bullet shows the action and the result: what changed, who benefited, or what you delivered. Describing the job description tells the recruiter nothing about how well you did it.";
      } else if (pronoun.length) {
        status = LOOK;
        verdict = `${pronoun.length} bullet${pronoun.length > 1 ? "s use" : " uses"} "I" or "my".`;
        why = "Resume bullets drop the pronoun by convention: \"Led a team of 5\" rather than \"I led a team of 5.\" It keeps lines tight.";
      } else {
        verdict = nb ? "Your experience reads as accomplishments, not duties." : "Add 2–4 bullets under each role.";
        why = "Accomplishment-focused descriptions are what separate candidates with similar titles.";
        if (!nb) status = LOOK;
      }
      add("experience", "Experience descriptions", status, verdict, why, (duty.length ? duty : pronoun).slice(0, 2).map((b) => `"${trim(b)}"`));
    }

    // 8. Overall clarity
    {
      const buzz = BUZZWORDS.filter((w) => lower.includes(w));
      const avg = nb ? Math.round(bullets.reduce((n, b) => n + words(b).length, 0) / nb) : 0;
      const status = buzz.length >= 2 || avg > 30 ? LOOK : GOOD;
      add("clarity", "Overall clarity", status,
        buzz.length ? `Filler phrases: ${buzz.slice(0, 4).map((b) => `"${b}"`).join(", ")}.` : avg > 30 ? `Bullets average ${avg} words, which is dense.` : "Plain, direct language.",
        buzz.length
          ? "Every recruiter has read \"hard-working team player\" thousands of times. Cut those claims and let specific accomplishments prove them instead."
          : avg > 30
            ? "Long, dense bullets make the page harder to skim. Aim for 12–25 words per bullet."
            : "Your writing is direct. Keep jargon and acronyms to ones your target recruiters would know.",
        []);
    }

    // 9. Relevance for the target career
    {
      let status, verdict, why;
      const examples = [];
      if (jobText) {
        const keys = extractKeywords(jobText, 20);
        const tokens = new Set(tokenize(p.raw));
        const matched = keys.filter((k) => tokens.has(k));
        const missing = keys.filter((k) => !tokens.has(k));
        matchScore = keys.length ? Math.round((matched.length / keys.length) * 100) : null;
        status = matchScore >= 60 ? GOOD : matchScore >= 35 ? LOOK : FIX;
        verdict = `Your resume covers ${matchScore}% of the job description's key terms.`;
        why = "Recruiters and applicant tracking systems compare your resume to the posting. " + (missing.length ? `Missing: ${missing.slice(0, 8).join(", ")}. Mirror the posting's language where it's genuinely true of you.` : "");
      } else if (!target) {
        status = LOOK;
        verdict = "Add your target role or industry for a relevance check.";
        why = "A resume is strongest when it's tailored to one field. Tell us what you're aiming for and we'll check whether your experience and keywords point there.";
      } else if (!field) {
        status = LOOK;
        verdict = `We don't have a keyword set for "${trim(target, 40)}" yet.`;
        why = "Use AI feedback for a relevance review tailored to this target, or paste a job description above for a keyword match.";
      } else {
        const found = field.terms.filter((t) => new RegExp("\\b" + reEsc(t), "i").test(lower));
        const share = Math.round((found.length / field.terms.length) * 100);
        status = share >= 45 ? GOOD : share >= 25 ? LOOK : FIX;
        verdict = `${found.length} of ${field.terms.length} signals we look for in ${field.label} resumes appear.`;
        why = `Recruiters in ${field.label} look for evidence you've done the work before, even in a club or class. Put your most relevant experience first and describe it using the field's language.`;
      }
      add("relevance", `Relevance${target ? " to " + trim(target, 40) : " to your target"}`, status, verdict, why, examples);
    }

    // 10. ATS / readability
    {
      const issues = [];
      let status = GOOD;
      if (facts && facts.scanned) { status = FIX; issues.push("This PDF has little or no selectable text. It looks like a scanned image, which applicant tracking systems can't read. Export it from Word or Google Docs instead."); }
      if (!EMAIL.test(p.raw)) { status = FIX; issues.push(facts && facts.headerContact ? "Your contact info is inside the page header, which some tracking systems skip. Move it into the main body." : "No email address found. Put your email and phone at the top."); }
      else if (facts && facts.headerContact) { if (status === GOOD) status = LOOK; issues.push("Some contact info is inside the page header, which some tracking systems skip. Keep it in the main body."); }
      if (facts && facts.tables) { if (status === GOOD) status = LOOK; issues.push(`It uses ${facts.tables} table${facts.tables > 1 ? "s" : ""} for layout. Some tracking systems read tables out of order. A single-column layout is safest.`); }
      if (facts && facts.textBoxes) { status = FIX; issues.push(`It has ${facts.textBoxes} text box${facts.textBoxes > 1 ? "es" : ""}. Many tracking systems skip text boxes entirely. Move that content into the main body.`); }
      if (facts && facts.images) { if (status === GOOD) status = LOOK; issues.push("It contains images or graphics. Tracking systems ignore them, and US resumes shouldn't include a photo."); }
      if (!/linkedin\.com/i.test(p.raw)) { if (status === GOOD) status = LOOK; issues.push("No LinkedIn URL. Add a custom linkedin.com/in/ link next to your email."); }
      if (field && field.key === "tech" && !/github\.com|portfolio|\.dev\b|\.io\b/i.test(p.raw)) issues.push("For tech roles, add a GitHub or portfolio link.");
      add("ats", "ATS & readability", status,
        issues[0] || "Readable by applicant tracking systems: contact info present, no tables or text boxes detected.",
        (issues.length ? issues.slice(1).join(" ") + " " : "") + "Many employers run resumes through an applicant tracking system (ATS) first. Simple, single-column text with standard headings gets parsed correctly.",
        facts ? [] : ["Upload the file itself to also check for tables, text boxes, and header content."]);
    }

    // Bullets most worth rewriting, with the reasons.
    const rewrite = bullets.map((b) => {
      const reasons = [];
      if (weakStart(b)) reasons.push("weak opener");
      else if (!verbStart(b)) reasons.push("no action verb up front");
      if (!hasNum(b)) reasons.push("no measurable result");
      if (words(b).length > 32) reasons.push("too long");
      if (/\b(I|me|my)\b/.test(b)) reasons.push("uses \"I\"");
      return { text: b, reasons };
    }).filter((x) => x.reasons.length >= 2).sort((a, b) => b.reasons.length - a.reasons.length).slice(0, 3);

    return { checks: out, matchScore, rewrite, parsed: p, field };
  }

  // Kept from Asaf's v1: job-description keyword extraction.
  function tokenize(text) {
    return (text || "").toLowerCase().match(/[a-z][a-z+.#-]{2,}/g) || [];
  }
  function extractKeywords(text, limit) {
    const counts = new Map();
    tokenize(text).forEach((w) => { if (!STOPWORDS.has(w)) counts.set(w, (counts.get(w) || 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([w]) => w);
  }

  function trim(s, n = 110) { s = String(s); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---- Rendering ------------------------------------------------------------------

  const LABEL = { fix: "Fix first", look: "Worth a look", good: "Looking good" };
  const ORDER = { fix: 0, look: 1, good: 2 };

  function render(card, result) {
    const c = result.checks;
    const n = (s) => c.filter((x) => x.status === s).length;
    const sorted = [...c].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
    card.innerHTML = `
      <div class="rr-head">
        <h3>Instant check</h3>
        <div class="rr-tally">
          <span class="rr-chip rr-fix">${n("fix")} fix first</span>
          <span class="rr-chip rr-look">${n("look")} worth a look</span>
          <span class="rr-chip rr-good">${n("good")} looking good</span>
        </div>
      </div>
      <ul class="rr-checks">
        ${sorted.map((x, i) => `
          <li class="rr-check rr-${x.status}">
            <details${x.status === "fix" && i < 2 ? " open" : ""}>
              <summary>
                <span class="rr-dot" aria-hidden="true"></span>
                <span class="rr-check-main"><b>${esc(x.title)}</b><span>${esc(x.verdict)}</span></span>
                <span class="sr-only">${LABEL[x.status]}</span>
              </summary>
              <div class="rr-check-body">
                <p><b>Why it matters:</b> ${esc(x.why)}</p>
                ${x.examples.length ? `<ul>${x.examples.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
              </div>
            </details>
          </li>`).join("")}
      </ul>
      ${result.rewrite.length ? `
        <h4>Bullets to rewrite first</h4>
        <ul class="rr-rewrite">
          ${result.rewrite.map((r) => `<li><q>${esc(trim(r.text, 160))}</q><span>${r.reasons.map(esc).join(" · ")}</span></li>`).join("")}
        </ul>
        <p class="muted rr-note">Use <b>AI feedback</b> for rewritten versions of these bullets.</p>` : ""}
    `;
  }

  // ---- File reading -----------------------------------------------------------------

  let facts = null;

  async function inflateRaw(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  // Minimal ZIP reader: enough to pull XML parts out of a .docx.
  async function unzip(buf) {
    const dv = new DataView(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("not_zip");
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = {};
    const dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const size = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
      files[name] = async () => {
        const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
        const data = new Uint8Array(buf, start, size);
        return dec.decode(method === 8 ? await inflateRaw(data) : data);
      };
      p += 46 + nameLen + extraLen + commentLen;
    }
    return files;
  }

  function xml(s) { return new DOMParser().parseFromString(s, "application/xml"); }

  // Word stores text boxes twice (DrawingML plus an mc:Fallback VML copy); skip the copy.
  function inFallback(el) {
    for (let n = el.parentNode; n && n.nodeType === 1; n = n.parentNode) if (n.localName === "Fallback") return true;
    return false;
  }

  function paraText(p) {
    let s = "";
    const walk = (node) => {
      for (const el of node.children) {
        if (el.namespaceURI === W && el.localName === "p") continue; // nested (text box) paragraphs are read separately
        if (el.localName === "Fallback") continue;
        if (el.namespaceURI === W && el.localName === "t") s += el.textContent;
        else if (el.namespaceURI === W && (el.localName === "tab" || el.localName === "ptab")) s += "\t";
        else if (el.namespaceURI === W && (el.localName === "br" || el.localName === "cr")) s += "\n";
        else walk(el);
      }
    };
    walk(p);
    return s;
  }

  async function readDocx(buf) {
    if (typeof DecompressionStream === "undefined") throw new Error("old_browser");
    const files = await unzip(buf);
    if (!files["word/document.xml"]) throw new Error("not_docx");
    const doc = xml(await files["word/document.xml"]());
    const paras = [...doc.getElementsByTagNameNS(W, "p")].filter((p) => !inFallback(p));
    const lines = paras.map((p) => {
      const t = paraText(p).replace(/\t+/g, "  ").trimEnd();
      const listItem = p.getElementsByTagNameNS(W, "numPr").length > 0;
      return t.trim() ? (listItem && !BULLET_GLYPH.test(t) ? "• " + t.trim() : t.trim()) : "";
    });
    const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

    // Layout facts
    const fonts = new Map(), sizes = new Map();
    const tally = (map, k, w) => { if (k) map.set(k, (map.get(k) || 0) + w); };
    for (const r of doc.getElementsByTagNameNS(W, "r")) {
      const len = [...r.getElementsByTagNameNS(W, "t")].reduce((n, t) => n + t.textContent.length, 0);
      if (!len) continue;
      const f = r.getElementsByTagNameNS(W, "rFonts")[0];
      tally(fonts, f && (f.getAttributeNS(W, "ascii") || f.getAttributeNS(W, "hAnsi")), len);
      const sz = r.getElementsByTagNameNS(W, "sz")[0];
      tally(sizes, sz && Number(sz.getAttributeNS(W, "val")) / 2, len);
    }
    let defaultFont = "", defaultSize = 0;
    if (files["word/styles.xml"]) {
      const st = xml(await files["word/styles.xml"]());
      const dd = st.getElementsByTagNameNS(W, "docDefaults")[0];
      const f = dd && dd.getElementsByTagNameNS(W, "rFonts")[0];
      defaultFont = f ? f.getAttributeNS(W, "ascii") || (f.getAttributeNS(W, "asciiTheme") ? "theme font" : "") : "";
      const sz = dd && dd.getElementsByTagNameNS(W, "sz")[0];
      defaultSize = sz ? Number(sz.getAttributeNS(W, "val")) / 2 : 0;
      for (const s of st.getElementsByTagNameNS(W, "style")) {
        if (s.getAttributeNS(W, "styleId") !== "Normal") continue;
        const nf = s.getElementsByTagNameNS(W, "rFonts")[0];
        if (nf && nf.getAttributeNS(W, "ascii")) defaultFont = nf.getAttributeNS(W, "ascii");
        const nsz = s.getElementsByTagNameNS(W, "sz")[0];
        if (nsz) defaultSize = Number(nsz.getAttributeNS(W, "val")) / 2;
      }
    }
    const totalChars = text.length;
    const explicitFontChars = [...fonts.values()].reduce((a, b) => a + b, 0);
    if (defaultFont && explicitFontChars < totalChars * 0.9) tally(fonts, defaultFont, totalChars - explicitFontChars);
    const explicitSizeChars = [...sizes.values()].reduce((a, b) => a + b, 0);
    if (defaultSize && explicitSizeChars < totalChars * 0.9) tally(sizes, defaultSize, totalChars - explicitSizeChars);

    let pages = 0;
    if (files["docProps/app.xml"]) {
      const m = (await files["docProps/app.xml"]()).match(/<Pages>(\d+)<\/Pages>/);
      pages = m ? Number(m[1]) : 0;
    }
    let headerText = "";
    for (const name of Object.keys(files).filter((n) => /^word\/header\d*\.xml$/.test(n))) {
      headerText += " " + [...xml(await files[name]()).getElementsByTagNameNS(W, "t")].map((t) => t.textContent).join(" ");
    }
    const txbx = [...doc.getElementsByTagNameNS(W, "txbxContent")].filter((t) => !inFallback(t)).length;
    const drawings = [...doc.getElementsByTagNameNS(W, "drawing")].filter((d) => !inFallback(d)).length;
    return {
      text: (EMAIL.test(headerText) || PHONE.test(headerText)) && !EMAIL.test(text) ? headerText.trim() + "\n" + text : text,
      facts: {
        kind: "Word document",
        pages,
        fonts: [...fonts.entries()].sort((a, b) => b[1] - a[1]).filter(([, n]) => n > 20).map(([f]) => f),
        bodySize: mode(sizes),
        tables: doc.getElementsByTagNameNS(W, "tbl").length,
        textBoxes: txbx,
        images: Math.max(0, drawings - txbx),
        headerContact: EMAIL.test(headerText) || PHONE.test(headerText),
        scanned: false,
      },
    };
  }

  function mode(map) {
    let best = 0, n = 0;
    map.forEach((v, k) => { if (v > n) { n = v; best = k; } });
    return best ? Math.round(best * 2) / 2 : 0;
  }

  let pdfjsPromise = null;
  function loadPdfJs() {
    if (!pdfjsPromise) {
      pdfjsPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = PDFJS + "pdf.min.js";
        s.onload = () => {
          const lib = window.pdfjsLib;
          if (!lib) return reject(new Error("pdfjs"));
          lib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
          resolve(lib);
        };
        s.onerror = () => { pdfjsPromise = null; reject(new Error("pdfjs_load")); };
        document.head.appendChild(s);
      });
    }
    return pdfjsPromise;
  }

  async function readPdf(buf) {
    const lib = await loadPdfJs();
    const pdf = await lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
    const pageLines = [];
    const fonts = new Map(), sizes = new Map();
    let chars = 0;
    for (let n = 1; n <= Math.min(pdf.numPages, 4); n++) {
      const page = await pdf.getPage(n);
      const tc = await page.getTextContent();
      try { await page.getOperatorList(); } catch { /* font names are optional */ }
      const rows = [];
      for (const it of tc.items) {
        if (!it.str) continue;
        const y = it.transform[5], x = it.transform[4];
        const size = Math.hypot(it.transform[2], it.transform[3]) || it.height || 0;
        let row = rows.find((r) => Math.abs(r.y - y) < Math.max(2, size * 0.45));
        if (!row) { row = { y, items: [] }; rows.push(row); }
        row.items.push({ x, str: it.str, w: it.width, size });
        const len = it.str.trim().length;
        chars += len;
        if (!len) continue;
        sizes.set(Math.round(size * 2) / 2, (sizes.get(Math.round(size * 2) / 2) || 0) + len);
        let family = "";
        try {
          const f = page.commonObjs.has(it.fontName) ? page.commonObjs.get(it.fontName) : null;
          family = f && f.name ? cleanFont(f.name) : "";
        } catch { /* ignore */ }
        if (family) fonts.set(family, (fonts.get(family) || 0) + len);
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) {
        r.items.sort((a, b) => a.x - b.x);
        let line = "", end = null;
        for (const it of r.items) {
          if (end !== null) {
            const gap = it.x - end;
            if (gap > it.size * 2.5) line += "  ";
            else if (gap > it.size * 0.15 && !/\s$/.test(line) && !/^\s/.test(it.str)) line += " ";
          }
          line += it.str;
          end = it.x + (it.w || 0);
        }
        if (line.trim()) pageLines.push(line.replace(/\s+$/, ""));
      }
      pageLines.push("");
    }
    const text = pageLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    return {
      text,
      facts: {
        kind: "PDF",
        pages: pdf.numPages,
        fonts: [...fonts.entries()].sort((a, b) => b[1] - a[1]).filter(([, n]) => n > 20).map(([f]) => f),
        bodySize: mode(sizes),
        tables: 0, textBoxes: 0, images: 0, headerContact: false,
        scanned: chars < 80,
      },
    };
  }

  // "ABCDEF+TimesNewRomanPS-BoldMT" -> "Times New Roman"
  function cleanFont(name) {
    let n = name.replace(/^[A-Z]{6}\+/, "").split(/[-,]/)[0].replace(/(PSMT|PS|MT|Std|Pro|LT)$/g, "");
    n = n.replace(/(Bold|Italic|Oblique|Regular|Light|Medium|Semibold|Book)+$/i, "");
    return n.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  }

  // ---- Wiring --------------------------------------------------------------------------

  function init() {
    const resumeInput = document.getElementById("rr-resume");
    const jobInput = document.getElementById("rr-job");
    const targetInput = document.getElementById("rr-target");
    const button = document.getElementById("rr-analyze");
    const status = document.getElementById("rr-status");
    const results = document.getElementById("rr-results");
    const fileInput = document.getElementById("rr-file");
    const drop = document.getElementById("rr-drop");
    const fileInfo = document.getElementById("rr-file-info");
    if (!button) return;

    const say = (text, kind = "error") => {
      if (!text) { status.hidden = true; return; }
      status.hidden = false;
      status.className = "form-status form-status-" + kind;
      status.textContent = text;
    };

    // Default the target from the student's profile.
    const fromProfile = () => {
      const p = window.CC ? window.CC.profile.get() : {};
      return p.roles || (p.industry && p.industry !== "Not sure yet" ? p.industry : "");
    };
    if (!targetInput.value) targetInput.value = fromProfile();
    if (window.CC) window.CC.profile.onChange(() => { if (!targetInput.value) targetInput.value = fromProfile(); });

    function run() {
      const text = resumeInput.value;
      if (text.trim().length < 40) return say("Upload your resume or paste its text first.");
      say("");
      const p = window.CC ? window.CC.profile.get() : {};
      const result = analyze(text, { facts, target: targetInput.value, job: jobInput.value, year: p.year });
      render(results, result);
      results.hidden = false;
      results.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    button.addEventListener("click", run);

    function showFile(file, f) {
      const bits = [f.kind, f.pages ? `${f.pages} page${f.pages > 1 ? "s" : ""}` : "", f.fonts.length ? f.fonts.slice(0, 2).join(", ") : "", f.bodySize ? `${f.bodySize}pt text` : ""].filter(Boolean);
      fileInfo.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/></svg>
        <span><b>${esc(file.name)}</b><span class="muted">${esc(bits.join(" · "))}</span></span>
        <button type="button" class="link-btn" id="rr-file-clear">Remove</button>`;
      fileInfo.hidden = false;
      document.getElementById("rr-file-clear").addEventListener("click", () => {
        facts = null; fileInfo.hidden = true; fileInput.value = ""; resumeInput.value = ""; say(""); resumeInput.focus();
      });
    }

    async function handleFile(file) {
      if (!file) return;
      const name = file.name.toLowerCase();
      if (file.size > MAX_BYTES) return say("That file is over 5 MB. Try exporting a smaller PDF, or paste the text instead.");
      const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";
      const isDocx = name.endsWith(".docx");
      if (name.endsWith(".doc")) return say("Older .doc files can't be read here. In Word, use File → Save As → .docx or PDF, then upload that.");
      if (!isPdf && !isDocx) return say("Upload a PDF or Word (.docx) file, or paste your resume text below.");
      say(`Reading ${file.name}…`, "ok");
      drop.classList.add("is-busy");
      try {
        const buf = await file.arrayBuffer();
        const res = isPdf ? await readPdf(buf) : await readDocx(buf);
        facts = res.facts;
        if (res.facts.scanned || res.text.length < 40) {
          resumeInput.value = res.text;
          showFile(file, res.facts);
          return say("We couldn't find readable text in this file. It may be a scanned image. Applicant tracking systems can't read those either, so export your resume from Word or Google Docs as a PDF, or paste the text below.");
        }
        resumeInput.value = res.text;
        showFile(file, res.facts);
        say("Done. Check the text below, then run a check.", "ok");
        run();
      } catch (err) {
        facts = null;
        say(err && err.message === "old_browser"
          ? "Your browser can't open Word files here. Upload a PDF, or paste the text below."
          : err && err.message === "pdfjs_load"
            ? "Couldn't load the PDF reader. Check your connection and try again, or paste the text below."
            : "We couldn't read that file. Try saving it again as PDF or .docx, or paste the text below.");
      } finally {
        drop.classList.remove("is-busy");
      }
    }

    fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));
    ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("is-over"); }));
    ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("is-over"); }));
    drop.addEventListener("drop", (e) => handleFile(e.dataTransfer.files[0]));
    // Editing the text by hand keeps the file facts (layout doesn't change),
    // but clearing the box forgets them.
    resumeInput.addEventListener("input", () => { if (!resumeInput.value.trim()) { facts = null; fileInfo.hidden = true; } });
  }

  window.CCResume = {
    analyze,
    getFacts: () => facts,
    getTarget: () => { const t = document.getElementById("rr-target"); return t ? t.value.trim() : ""; },
    setTarget: (v) => { const t = document.getElementById("rr-target"); if (t) t.value = v; },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
