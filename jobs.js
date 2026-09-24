/* Career Coach — Job Opportunities (Job Finding hub). Renders jobs-data.json,
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
    const title = job.title.toLowerCase();
    const hits = new Set(words(`${p.roles || ""} ${p.interests || ""}`).filter((w) => title.includes(w)));
    if (hits.size) { score += Math.min(hits.size, 2) * 2; reasons.push("matches your interests"); }
    const locs = (p.locations || "").toLowerCase().split(/[,;/]| or /).map((s) => s.trim()).filter((s) => s.length > 1);
    if (locs.some((l) => job.location.toLowerCase().includes(l))) { score += 2; reasons.push("in a place you picked"); }
    const late = /4th|senior|recent|graduate student/i.test(p.year || "");
    if (p.year && (late ? job.type === "New Grad" : job.type === "Internship")) { score += 1; }
    return { score, reasons };
  }

  function render() {
    const p = window.CC ? window.CC.profile.get() : null;
    const q = searchInput.value.trim().toLowerCase();
    const ind = industrySel.value;
    const loc = locationInput.value.trim().toLowerCase();
    let list = allJobs.filter((j) => {
      if (activeType === "saved") { if (!savedIds.has(j.id)) return false; }
      else if (activeType !== "all" && j.type !== activeType) return false;
      if (ind && j.category !== ind) return false;
      if (loc && !j.location.toLowerCase().includes(loc)) return false;
      if (!q) return true;
      return [j.title, j.company, j.location, j.category].some((f) => (f || "").toLowerCase().includes(q));
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
          ${j.category ? `<span class="job-category">${esc(CATEGORY_LABELS[j.category] || j.category)}</span>` : ""}
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
  [industrySel, sortSel].forEach((el) => el.addEventListener("change", render));
  if (window.CC) window.CC.profile.onChange(render);
  updateSavedPillLabel();

  fetch("jobs-data.json")
    .then((res) => { if (!res.ok) throw new Error("load failed"); return res.json(); })
    .then((data) => {
      allJobs = (Array.isArray(data.jobs) ? data.jobs : []).map((j) => ({ ...j, category: CATEGORY_NAMES[j.category] || j.category || "" }));
      const cats = [...new Set(allJobs.map((j) => j.category).filter(Boolean))].sort();
      industrySel.insertAdjacentHTML("beforeend", cats.map((c) => `<option value="${esc(c)}">${esc(CATEGORY_LABELS[c] || c)}</option>`).join(""));
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
