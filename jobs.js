/* Career Coach — Job Opportunities (Career Toolkit hub). Renders jobs-data.json,
   a static file refreshed daily by a GitHub Actions workflow (see
   .github/workflows/update-jobs.yml) that pulls from SimplifyJobs' open
   internship/new-grad datasets. Ranks roles against the student's profile
   (CC.profile) with simple, transparent keyword rules. Saved jobs persist to
   this browser's localStorage only. Card actions ("Cover letter", "Prep")
   hand the job to the other toolkit tabs via a "cc:job-action" event. */
(function () {
  const grid = document.getElementById("job-grid");
  if (!grid) return;
  const updatedEl = document.getElementById("jobs-updated");
  const emptyEl = document.getElementById("jobs-empty");
  const searchInput = document.getElementById("jobs-search");
  const typeFilter = document.getElementById("jobs-type-filter");
  const savedPill = document.getElementById("jobs-saved-pill");
  const industrySel = document.getElementById("jobs-industry");
  const roleSel = document.getElementById("jobs-role");
  const locationInput = document.getElementById("jobs-location");
  const sortSel = document.getElementById("jobs-sort");

  const SAVE_KEY = "cc_saved_jobs";
  const esc = window.CC ? window.CC.esc : (s) => String(s);
  let allJobs = [];
  let activeType = "all";
  let savedIds = loadSaved();

  const CATEGORY_NAMES = {
    "Data Science, AI & Machine Learning": "AI/ML/Data",
    "Software Engineering": "Software",
    "Hardware Engineering": "Hardware",
    "Product Management": "Product",
    "Quantitative Finance": "Quant",
  };
  const CATEGORY_LABELS = { "AI/ML/Data": "AI, ML & Data", Software: "Software", Hardware: "Hardware & engineering", Product: "Product", Quant: "Quant & trading" };

  // Profile -> categories that usually fit it.
  const INDUSTRY_TO_CAT = {
    "Technology & software": ["Software", "AI/ML/Data"],
    "Data & analytics": ["AI/ML/Data", "Quant"],
    "Product management": ["Product", "Software"],
    "Finance & banking": ["Quant"],
    "Engineering & hardware": ["Hardware"],
    "Entrepreneurship & startups": ["Product", "Software"],
    "Consulting": ["Product"],
    "Marketing & media": ["Product"],
  };
  const MAJOR_HINTS = [
    [/computer|software|cs\b|informatics/i, ["Software", "AI/ML/Data"]],
    [/data|statistic|math|physics/i, ["AI/ML/Data", "Quant"]],
    [/financ|econom|accounting/i, ["Quant"]],
    [/electrical|mechanical|biomedical|engineer|chemical/i, ["Hardware"]],
    [/business|management|marketing|design/i, ["Product"]],
  ];
  // Employer industry. The feed only tags each job with a role type, so we
  // infer the industry from the company name, then the title, then fall back
  // on the role type. First match wins, so specific rules come first.
  const INDUSTRY_RULES = [
    ["Government & public sector", /federal reserve|investment board|\biso\b|state of |city of |county|department of|usafacts|national lab|\bnasa\b|\bfbi\b|\bnsa\b/i],
    ["Education & research", /universit|college|school|institute|academ|predoctoral|research specialist/i],
    ["Aerospace & defense", /dynamics|northrop|raytheon|\brtx\b|lockheed|l3harris|peraton|\bcaci\b|v2x|everwatch|astrion|leidos|booz allen|saic|bae systems|boeing|spacex|blue origin|anduril|american systems|\btsc\b|mission systems|aerospace|defense|missile|satellite/i],
    ["Insurance", /insurance|liberty mutual|state farm|allstate|progressive|geico|markel|athene|aflac|metlife|prudential|nationwide|travelers|\bchubb\b|lexisnexis risk|underwrit|actuar/i],
    ["Investing & trading", /trading|capital(?! one)|\bimc\b|\bdrw\b|old mission|\bsig\b|susquehanna|citadel|jane street|hudson river|two sigma|optiver|voloridge|arrowstreet|exoduspoint|pimco|\bscm\b|blackrock|vanguard|fidelity|investment|asset management|hedge|quant|trader|portfolio/i],
    ["Banking & financial services", /bank|santander|schwab|jpmorgan|chase|goldman|morgan stanley|wells fargo|citi|capital one|american express|paypal|sofi|visa\b|mastercard|stripe|blackhawk network|fhlb|drivetime|credit|lending|fintech|finance engineer|financial/i],
    ["Healthcare & life sciences", /health|medic|boston scientific|pharma|biotech|\bbio|clinic|hospital|genentech|pfizer|merck|abbott|medtronic|johnson & johnson|urology|patient/i],
    ["Energy & utilities", /energy|(?<!ring )power|utilit|renewable|solar|\bwind\b|nuclear|framatome|\boil\b|\bgas\b|petrol|exxon|chevron|shell/i],
    ["Semiconductors & electronics", /texas instruments|micron|analog devices|\bintel\b|nvidia|\bamd\b|qualcomm|broadcom|keysight|samsung|semiconductor|sambanova|fpga|\bic design|pcb/i],
    ["Automotive & transportation", /paccar|jm family|automotive|tesla|\bford\b|general motors|\bgm\b|toyota|honda|rivian|mann\+hummel|novelis|airline|\brail|vehicle/i],
    ["Logistics & supply chain", /logistic|supply chain|freight|shipping|ups\b|fedex|rr donnelley|warehouse/i],
    ["Telecommunications", /t-mobile|verizon|at&t|comcast|charter|telecom|wireless/i],
    ["Media, entertainment & sports", /hearst|twitch|tiktok|sony|netflix|disney|warner|spotify|fanduel|draftkings|fanatics|oak view|game|sports|media|entertainment|music|nba|nfl/i],
    ["Consumer goods & retail", /ulta|bass pro|sharkninja|constellation brands|mohawk|walmart|target|costco|nike|procter|unilever|pepsi|coca|retail|ecommerce|apparel|beauty/i],
    ["Hospitality & travel", /choice hotels|ideas\b|marriott|hilton|hyatt|expedia|airbnb|hotel|travel/i],
    ["Construction & real estate", /turner & townsend|gaf\b|equipmentshare|ring power|construction|real estate|propert|building/i],
    ["Agriculture & food", /john deere|cargill|tyson|agri|farm|food/i],
    ["Consulting & professional services", /deloitte|accenture|mckinsey|bain|bcg|pwc|kpmg|ernst|\bey\b|consult|advisory/i],
    ["Manufacturing & industrial", /emerson|halma|allegion|dwyeromega|honeywell|siemens|\bge\b|caterpillar|3m\b|manufactur|industrial|equipment|automation/i],
    ["Technology & software", /microsoft|amazon|google|apple|meta\b|cisco|linkedin|jerry|verkada|oracle|salesforce|ibm|adobe|software|tech|cloud|\bai\b|data/i],
  ];
  const ROLE_FALLBACK = { Software: "Technology & software", "AI/ML/Data": "Technology & software", Product: "Technology & software", Hardware: "Manufacturing & industrial", Quant: "Investing & trading" };
  function industryOf(j) {
    for (const field of [j.company, j.title]) {
      const hit = INDUSTRY_RULES.find(([, re]) => re.test(field || ""));
      if (hit) return hit[0];
    }
    return ROLE_FALLBACK[j.category] || "Other";
  }
  // Profile industry -> employer industries that usually fit it.
  const PROFILE_TO_INDUSTRY = {
    "Finance & banking": ["Banking & financial services", "Investing & trading", "Insurance"],
    "Consulting": ["Consulting & professional services"],
    "Technology & software": ["Technology & software"],
    "Marketing & media": ["Media, entertainment & sports", "Consumer goods & retail"],
    "Healthcare & public health": ["Healthcare & life sciences"],
    "Law & policy": ["Government & public sector"],
    "Real estate": ["Construction & real estate"],
    "Nonprofit & public service": ["Government & public sector", "Education & research"],
    "Engineering & hardware": ["Aerospace & defense", "Semiconductors & electronics", "Manufacturing & industrial", "Automotive & transportation", "Energy & utilities"],
  };
  const STOP = new Set("and or the for with of to in on at a an my i want be work job role roles intern internship analyst".split(" "));

  function loadSaved() {
    try {
      const arr = JSON.parse(localStorage.getItem(SAVE_KEY) || "[]");
      return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
  }
  function persistSaved() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify([...savedIds])); } catch { /* no-op */ }
  }
  function updateSavedPillLabel() { savedPill.textContent = `Saved (${savedIds.size})`; }

  function timeAgo(iso) {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "1 day ago";
    if (days < 30) return days + " days ago";
    return new Date(iso).toLocaleDateString();
  }

  const SYNONYMS = {
    engineer: ["engineer", "developer", "programmer"], engineering: ["engineer", "developer"], developer: ["developer", "engineer"],
    swe: ["software engineer", "software developer", "software"], intern: ["intern", "co-op", "coop"], internship: ["intern", "co-op", "coop"],
    ml: ["ml", "machine learning", "ai"], ai: ["ai", "machine learning", "ml"], remote: ["remote"],
  };

  function words(s) {
    return ((s || "").toLowerCase().match(/[a-z][a-z+#]{2,}/g) || []).filter((w) => !STOP.has(w));
  }

  function matchInfo(job, p) {
    if (!p) return { score: 0, reasons: [] };
    let score = 0;
    const reasons = [];
    const cats = new Set([...(INDUSTRY_TO_CAT[p.industry] || [])]);
    MAJOR_HINTS.forEach(([re, c]) => { if (re.test(p.major || "")) c.forEach((x) => cats.add(x)); });
    if (cats.has(job.category)) { score += 3; reasons.push("fits your field"); }
    if ((PROFILE_TO_INDUSTRY[p.industry] || []).includes(job.industry)) { score += 2; reasons.push("in your industry"); }
    const title = job.title.toLowerCase();
    const hits = new Set(words(`${p.roles || ""} ${p.interests || ""}`).filter((w) => title.includes(w)));
    if (hits.size) { score += Math.min(hits.size, 2) * 2; reasons.push("matches your interests"); }
    const locs = (p.locations || "").toLowerCase().split(/[,;/]| or /).map((s) => s.trim()).filter((s) => s.length > 1);
    if (locs.some((l) => job.location.toLowerCase().includes(l))) { score += 2; reasons.push("in a place you picked"); }
    // Class year: internships for underclassmen and juniors, new-grad roles for seniors and grads.
    const late = /4th|senior|recent|graduate student/i.test(p.year || "");
    if (p.year) {
      if (late ? job.type === "New Grad" : job.type === "Internship") score += 1;
      else if (!late && job.type === "New Grad") score -= 4;
    }
    return { score, reasons };
  }

  function render() {
    const p = window.CC ? window.CC.profile.get() : null;
    const q = searchInput.value.trim().toLowerCase();
    const ind = industrySel.value;
    const role = roleSel.value;
    const loc = locationInput.value.trim().toLowerCase();
    let list = allJobs.filter((j) => {
      if (activeType === "saved") { if (!savedIds.has(j.id)) return false; }
      else if (activeType !== "all" && j.type !== activeType) return false;
      if (ind && j.industry !== ind) return false;
      if (role && j.category !== role) return false;
      if (loc && !j.location.toLowerCase().includes(loc)) return false;
      if (!q) return true;
      // Every word must match somewhere; common synonyms count ("engineer" finds "developer").
      const hay = [j.title, j.company, j.location, j.industry, CATEGORY_LABELS[j.category] || j.category].join(" ").toLowerCase();
      return q.split(/\s+/).filter(Boolean).every((w) => (SYNONYMS[w] || [w]).some((x) => hay.includes(x)));
    }).map((j) => ({ ...j, match: matchInfo(j, p) }));

    if (sortSel.value === "match") list.sort((a, b) => b.match.score - a.match.score || new Date(b.posted) - new Date(a.posted));
    else list.sort((a, b) => new Date(b.posted) - new Date(a.posted));

    grid.innerHTML = list.map((j) => {
      const saved = savedIds.has(j.id);
      const m = j.match.score >= 5 ? "Strong match" : j.match.score >= 3 ? "Good match" : "";
      return `
      <article class="job-card">
        <div class="job-card-top">
          <span class="job-type-badge job-type-${j.type === "Internship" ? "intern" : "newgrad"}">${esc(j.type)}</span>
          <span class="job-category">${esc(j.industry)}</span>
          <button type="button" class="job-save-btn${saved ? " saved" : ""}" data-id="${esc(j.id)}" aria-label="${saved ? "Remove from saved jobs" : "Save this job"}" aria-pressed="${saved}">${saved ? "★" : "☆"}</button>
        </div>
        ${m ? `<span class="job-match" title="${esc(j.match.reasons.join(", "))}">${m}</span>` : ""}
        <h3>${esc(j.title)}</h3>
        <div class="job-company">${esc(j.company)}</div>
        <div class="job-meta">${esc(j.location)} &middot; posted ${timeAgo(j.posted)}</div>
        <div class="job-actions">
          <a class="btn btn-primary btn-sm" href="${encodeURI(j.url)}" target="_blank" rel="noopener">Apply &rarr;</a>
          <button type="button" class="link-btn" data-action="cover-letter" data-id="${esc(j.id)}">Cover letter</button>
          <button type="button" class="link-btn" data-action="interview-prep" data-id="${esc(j.id)}">Prep</button>
        </div>
      </article>`;
    }).join("");

    emptyEl.hidden = list.length !== 0;
    emptyEl.textContent = activeType === "saved"
      ? "No saved jobs yet. Tap the star on any listing to save it here."
      : loc || /new orleans|nola|louisiana/.test(q)
        ? "No roles in that location in today's listings. Most roles here are in tech hubs or remote. Try \"Remote\", or check Handshake for local openings."
        : "No open roles match those filters right now. Try widening your search.";
  }

  typeFilter.addEventListener("click", (e) => {
    const btn = e.target.closest(".pill");
    if (!btn) return;
    typeFilter.querySelectorAll(".pill").forEach((x) => x.classList.remove("active"));
    btn.classList.add("active");
    activeType = btn.dataset.type;
    render();
  });

  grid.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]");
    if (action) {
      const job = allJobs.find((j) => j.id === action.dataset.id);
      if (job) document.dispatchEvent(new CustomEvent("cc:job-action", { detail: { action: action.dataset.action, job } }));
      return;
    }
    const btn = e.target.closest(".job-save-btn");
    if (!btn) return;
    const id = btn.dataset.id;
    if (savedIds.has(id)) savedIds.delete(id); else savedIds.add(id);
    persistSaved();
    updateSavedPillLabel();
    if (activeType === "saved") return render();
    const nowSaved = savedIds.has(id);
    btn.classList.toggle("saved", nowSaved);
    btn.textContent = nowSaved ? "★" : "☆";
    btn.setAttribute("aria-pressed", String(nowSaved));
    btn.setAttribute("aria-label", nowSaved ? "Remove from saved jobs" : "Save this job");
  });

  [searchInput, locationInput].forEach((el) => el.addEventListener("input", render));
  [industrySel, roleSel, sortSel].forEach((el) => el.addEventListener("change", render));
  if (window.CC) window.CC.profile.onChange(render);
  updateSavedPillLabel();

  fetch("jobs-data.json")
    .then((res) => { if (!res.ok) throw new Error("load failed"); return res.json(); })
    .then((data) => {
      allJobs = (Array.isArray(data.jobs) ? data.jobs : []).map((j) => {
        const job = { ...j, category: CATEGORY_NAMES[j.category] || j.category || "" };
        job.industry = industryOf(job);
        return job;
      });
      const counts = (key) => allJobs.reduce((m, j) => (j[key] && (m[j[key]] = (m[j[key]] || 0) + 1), m), {});
      const options = (m, label) => Object.keys(m).sort((a, b) => (a === "Other") - (b === "Other") || a.localeCompare(b))
        .map((k) => `<option value="${esc(k)}">${esc(label(k))} (${m[k]})</option>`).join("");
      industrySel.insertAdjacentHTML("beforeend", options(counts("industry"), (k) => k));
      roleSel.insertAdjacentHTML("beforeend", options(counts("category"), (k) => CATEGORY_LABELS[k] || k));
      const updated = data.updatedAt ? new Date(data.updatedAt) : null;
      updatedEl.textContent = allJobs.length
        ? `${allJobs.length} open roles` + (updated ? ` · updated ${updated.toLocaleDateString()}` : "")
        : "No listings available right now.";
      render();
    })
    .catch(() => {
      updatedEl.textContent = "Couldn't load live listings right now.";
      emptyEl.hidden = false;
      emptyEl.textContent = "Something went wrong loading job listings. Please check back later.";
    });
})();
