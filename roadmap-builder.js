/* Career Coach — personalized roadmap builder (coaching-roadmaps.html).
   Sends the student's profile to /api/coach (mode "roadmap"), which returns a
   structured roadmap: timeline milestones, key recruiting dates, career paths,
   and recommendations (clubs, classes, skills, certifications, networking,
   internships, extracurriculars). Renders it as a visual timeline with a
   checklist whose progress, like the roadmap itself, is saved in this
   browser only. */
(function () {
  const CC = window.CC;
  const form = document.getElementById("rm-form");
  if (!form) return;
  const out = document.getElementById("rm-output");
  const st = document.getElementById("rm-status");
  const KEY = "cc_roadmap";
  const FIELDS = ["year", "major", "roles", "industry", "school", "interests", "experience", "locations"];

  const REC = [
    ["clubs", "Clubs & organizations", "🤝"],
    ["classes", "Classes & electives", "📚"],
    ["skills", "Skills to build", "🛠️"],
    ["certifications", "Certifications", "📜"],
    ["networking", "Networking plan", "☕"],
    ["internships", "Internships to target", "💼"],
    ["extracurriculars", "Extracurriculars", "⭐"],
  ];
  const LOADING = ["Looking at where you are now…", "Mapping your semesters…", "Lining up recruiting milestones…", "Picking clubs, classes, and skills…", "Almost there…"];

  const esc = CC.esc;
  const fill = (sel, opts) => sel.insertAdjacentHTML("beforeend", opts.map((o) => `<option>${esc(o)}</option>`).join(""));
  fill(form.elements.year, CC.profile.YEARS);
  fill(form.elements.industry, CC.profile.INDUSTRIES);

  function loadForm() {
    const p = CC.profile.get();
    FIELDS.forEach((f) => { if (p[f]) form.elements[f].value = p[f]; });
    if (!form.elements.school.value) form.elements.school.value = "Tulane University";
  }
  loadForm();
  CC.profile.onChange(loadForm);

  function saved() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
  }
  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* no-op */ }
  }

  function list(items) {
    return items && items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : `<p class="muted">Ask the AI coach for ideas here.</p>`;
  }

  function render(state) {
    const r = state.roadmap, p = state.profile || {};
    const done = state.done || {};
    const total = r.milestones.reduce((n, m) => n + m.actions.length, 0);
    const count = Object.values(done).filter(Boolean).length;
    const askQ = encodeURIComponent(`I just built my roadmap (${r.headline}). What should I focus on this week?`);
    out.innerHTML = `
      <div class="rm-head">
        <div class="roadmap-snapshot">
          <div class="side"><div class="label">Where you are</div><h3>${esc((p.year || "").replace(/\s*\(.*\)/, "") || "Student")}</h3><p>${esc(p.major || "")}${p.school ? ` · ${esc(p.school)}` : ""}</p></div>
          <div class="arrow" aria-hidden="true">&rarr;</div>
          <div class="side target"><div class="label">Where you're headed</div><h3>${esc(p.roles || p.industry || "Your goal")}</h3><p>${esc(r.headline)}</p></div>
        </div>
        ${r.summary ? `<p class="rm-summary">${esc(r.summary)}</p>` : ""}
        ${state.source === "fallback" ? `<p class="note">Our AI was busy, so this is a general starter plan. Press <b>Rebuild</b> in a minute for a fully personalized version.</p>` : ""}
        <div class="rm-toolbar">
          <div class="rm-progress" aria-label="Progress">
            <div class="rr-progress"><div class="rr-progress-fill" style="width:${total ? Math.round((count / total) * 100) : 0}%"></div></div>
            <span>${count} of ${total} steps done</span>
          </div>
          <div class="btn-row-sm">
            <a class="btn btn-primary btn-sm" href="ai-coach.html?q=${askQ}">Ask the AI about this</a>
            <button type="button" class="btn btn-outline btn-sm" data-rm="print">Print / save PDF</button>
            <button type="button" class="link-btn" data-rm="rebuild">Rebuild</button>
          </div>
        </div>
      </div>

      <h3 class="rm-section-title">Your timeline</h3>
      <ol class="rm-timeline">
        ${r.milestones.map((m, i) => `
          <li class="rm-node">
            <span class="rm-dot" aria-hidden="true">${i + 1}</span>
            <div class="rm-card">
              <span class="rm-period">${esc(m.period)}</span>
              <h4>${esc(m.title)}</h4>
              ${m.focus ? `<p class="rm-focus">${esc(m.focus)}</p>` : ""}
              <ul class="rm-checklist">
                ${m.actions.map((a, j) => {
                  const k = `m${i}a${j}`;
                  return `<li><label><input type="checkbox" data-k="${k}"${done[k] ? " checked" : ""}><span>${esc(a)}</span></label></li>`;
                }).join("")}
              </ul>
              ${m.checkpoint ? `<div class="roadmap-milestone"><b>Milestone:</b> ${esc(m.checkpoint)}</div>` : ""}
            </div>
          </li>`).join("")}
      </ol>

      ${r.keyDates && r.keyDates.length ? `
      <h3 class="rm-section-title">Recruiting timeline &amp; key dates</h3>
      <div class="rm-dates">
        ${r.keyDates.map((d) => `<div class="rm-date"><span class="when">${esc(d.when)}</span><p>${esc(d.what)}</p></div>`).join("")}
      </div>
      <p class="fine-print">Timelines shift by firm and year. Confirm exact dates with your career center.</p>` : ""}

      ${r.careerPaths && r.careerPaths.length ? `
      <h3 class="rm-section-title">Suggested career paths</h3>
      <div class="rm-paths">
        ${r.careerPaths.map((c, i) => `<div class="rm-path${i === 0 ? " primary" : ""}"><span class="tag">${i === 0 ? "Your target" : "Also consider"}</span><h4>${esc(c.title)}</h4><p>${esc(c.why)}</p></div>`).join("")}
      </div>` : ""}

      <h3 class="rm-section-title">Your recommendations</h3>
      <div class="roadmap-toolkit-grid">
        ${REC.map(([k, label, icon]) => `<div class="roadmap-toolkit-card"><h4><span aria-hidden="true">${icon}</span> ${label}</h4>${list(r.recommendations[k])}</div>`).join("")}
      </div>
      <p class="fine-print">Built by AI from your profile. Specific clubs and courses vary by school and semester, so check your student-org directory and course catalog, and talk it through with a coach before big decisions.</p>`;
    out.hidden = false;
  }

  out.addEventListener("change", (e) => {
    const box = e.target.closest("input[type=checkbox][data-k]");
    if (!box) return;
    const state = saved();
    if (!state) return;
    state.done = state.done || {};
    state.done[box.dataset.k] = box.checked;
    save(state);
    const total = out.querySelectorAll("input[data-k]").length;
    const count = out.querySelectorAll("input[data-k]:checked").length;
    out.querySelector(".rm-progress span").textContent = `${count} of ${total} steps done`;
    out.querySelector(".rm-progress .rr-progress-fill").style.width = `${Math.round((count / total) * 100)}%`;
  });

  out.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rm]");
    if (!b) return;
    if (b.dataset.rm === "print") window.print();
    if (b.dataset.rm === "rebuild") build();
  });

  function showLoading() {
    out.hidden = false;
    out.innerHTML = `<div class="rm-loading card"><span class="spinner spinner-lg" aria-hidden="true"></span><p id="rm-loading-msg">${LOADING[0]}</p><p class="muted">This usually takes 10–20 seconds.</p></div>`;
    let i = 0;
    return setInterval(() => {
      const el = document.getElementById("rm-loading-msg");
      if (el) el.textContent = LOADING[Math.min(++i, LOADING.length - 1)];
    }, 3500);
  }

  async function build() {
    const data = {};
    FIELDS.forEach((f) => { data[f] = form.elements[f].value; });
    CC.profile.set(data);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    st.hidden = true;
    const timer = showLoading();
    out.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const res = await CC.ai({ mode: "roadmap", profile: CC.profile.get() });
      if (!res.roadmap) throw new Error("no roadmap");
      const state = { roadmap: res.roadmap, source: res.source, profile: CC.profile.get(), created: Date.now(), done: {} };
      save(state);
      render(state);
      out.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      out.hidden = true;
      st.hidden = false;
      st.className = "form-status form-status-error";
      st.textContent = CC.aiErrorMessage(err);
    } finally {
      clearInterval(timer);
      btn.disabled = false;
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (form.reportValidity()) build();
  });

  document.getElementById("rm-example").addEventListener("click", () => {
    form.elements.year.value = "2nd year (sophomore)";
    form.elements.major.value = "Finance";
    form.elements.roles.value = "Investment banking analyst";
    form.elements.industry.value = "Finance & banking";
    form.elements.school.value = form.elements.school.value || "Tulane University";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.querySelector("button[type=submit]").focus({ preventScroll: true });
  });

  const existing = saved();
  if (existing && existing.roadmap && existing.roadmap.milestones) {
    render(existing);
    document.getElementById("rm-jump").hidden = false;
  }
})();
