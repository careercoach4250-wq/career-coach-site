/* Career Coach — Available Jobs page. Renders jobs-data.json, a static file
   refreshed daily by a GitHub Actions workflow (see .github/workflows/update-jobs.yml)
   that pulls from SimplifyJobs' open internship/new-grad datasets. Saved/starred
   jobs persist to this browser's localStorage only — no account, no server. */
(function () {
  const grid = document.getElementById("job-grid");
  const updatedEl = document.getElementById("jobs-updated");
  const emptyEl = document.getElementById("jobs-empty");
  const searchInput = document.getElementById("jobs-search");
  const typeFilter = document.getElementById("jobs-type-filter");
  const savedPill = document.getElementById("jobs-saved-pill");

  const SAVE_KEY = "cc_saved_jobs";
  let allJobs = [];
  let activeType = "all";
  let savedIds = loadSaved();

  function loadSaved() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  function persistSaved() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify([...savedIds]));
    } catch {
      /* localStorage unavailable (private mode, etc) — saving silently no-ops */
    }
  }

  function updateSavedPillLabel() {
    savedPill.textContent = `Saved (${savedIds.size})`;
  }

  function timeAgo(iso) {
    const then = new Date(iso).getTime();
    const days = Math.floor((Date.now() - then) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "1 day ago";
    if (days < 30) return days + " days ago";
    return new Date(iso).toLocaleDateString();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function render() {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = allJobs.filter((j) => {
      if (activeType === "saved") {
        if (!savedIds.has(j.id)) return false;
      } else if (activeType !== "all" && j.type !== activeType) {
        return false;
      }
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        (j.category || "").toLowerCase().includes(q)
      );
    });

    grid.innerHTML = filtered
      .map((j) => {
        const saved = savedIds.has(j.id);
        return `
      <div class="job-card">
        <div class="job-card-top">
          <span class="job-type-badge job-type-${j.type === "Internship" ? "intern" : "newgrad"}">${escapeHtml(j.type)}</span>
          ${j.category ? `<span class="job-category">${escapeHtml(j.category)}</span>` : ""}
          <button type="button" class="job-save-btn${saved ? " saved" : ""}" data-id="${escapeHtml(j.id)}" aria-label="${saved ? "Remove from saved jobs" : "Save this job"}" aria-pressed="${saved}">${saved ? "★" : "☆"}</button>
        </div>
        <h3>${escapeHtml(j.title)}</h3>
        <div class="job-company">${escapeHtml(j.company)}</div>
        <div class="job-meta">${escapeHtml(j.location)} &middot; posted ${timeAgo(j.posted)}</div>
        <a class="btn btn-outline job-apply" href="${encodeURI(j.url)}" target="_blank" rel="noopener">View &amp; Apply &rarr;</a>
      </div>
    `;
      })
      .join("");

    emptyEl.hidden = filtered.length !== 0;
    if (filtered.length === 0 && activeType === "saved") {
      emptyEl.textContent = "No saved jobs yet — click the star on any listing to save it here.";
    } else {
      emptyEl.textContent = "No open roles match that search right now — try a different keyword.";
    }
  }

  typeFilter.addEventListener("click", (e) => {
    const btn = e.target.closest(".pill");
    if (!btn) return;
    typeFilter.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    activeType = btn.dataset.type;
    render();
  });

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".job-save-btn");
    if (!btn) return;
    const id = btn.dataset.id;
    if (savedIds.has(id)) {
      savedIds.delete(id);
    } else {
      savedIds.add(id);
    }
    persistSaved();
    updateSavedPillLabel();
    if (activeType === "saved") {
      render();
    } else {
      btn.classList.toggle("saved");
      const nowSaved = btn.classList.contains("saved");
      btn.textContent = nowSaved ? "★" : "☆";
      btn.setAttribute("aria-pressed", String(nowSaved));
      btn.setAttribute("aria-label", nowSaved ? "Remove from saved jobs" : "Save this job");
    }
  });

  searchInput.addEventListener("input", render);

  updateSavedPillLabel();

  fetch("jobs-data.json")
    .then((res) => {
      if (!res.ok) throw new Error("failed to load jobs-data.json");
      return res.json();
    })
    .then((data) => {
      allJobs = Array.isArray(data.jobs) ? data.jobs : [];
      const updated = data.updatedAt ? new Date(data.updatedAt) : null;
      updatedEl.textContent = allJobs.length
        ? `${allJobs.length} open roles` + (updated ? ` · last updated ${updated.toLocaleString()}` : "")
        : "No listings available right now.";
      render();
    })
    .catch(() => {
      updatedEl.textContent = "Couldn't load live listings right now.";
      emptyEl.hidden = false;
      emptyEl.textContent = "Something went wrong loading job listings — please check back later.";
    });
})();
