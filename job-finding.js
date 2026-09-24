/* Career Coach — Job Finding hub (job-finding.html). Wires the five toolkit
   tabs together: tab switching (deep-linkable via #resume, #cover-letter,
   #case-prep, #interview-prep, #jobs), AI resume feedback, the cover-letter
   writer, the AI case interviewer, interview practice + feedback, and the
   Cal.com mock-interview booking (loaded the first time that tab opens).
   Job cards hand a role to the cover-letter / interview tabs. */
(function () {
  const CC = window.CC;
  const $ = (id) => document.getElementById(id);
  const TABS = ["resume", "cover-letter", "case-prep", "interview-prep", "jobs"];

  // ---- Tabs ----------------------------------------------------------------

  function activate(id, opts = {}) {
    if (!TABS.includes(id)) id = "resume";
    TABS.forEach((t) => {
      const panel = $(t), tab = $("tab-" + t);
      const on = t === id;
      panel.hidden = !on;
      tab.classList.toggle("active", on);
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
    if (id === "interview-prep") loadCal();
    if (opts.scroll) document.querySelector(".toolkit-bar").scrollIntoView({ behavior: "smooth", block: "start" });
    const active = $("tab-" + id);
    if (active.scrollIntoView && window.innerWidth < 760) active.scrollIntoView({ inline: "center", block: "nearest" });
  }

  document.querySelector(".toolkit-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest(".toolkit-tab");
    if (!tab) return;
    e.preventDefault();
    activate(tab.getAttribute("href").slice(1));
  });
  document.querySelector(".toolkit-tabs").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const cur = TABS.findIndex((t) => $("tab-" + t).classList.contains("active"));
    const next = TABS[(cur + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    activate(next);
    $("tab-" + next).focus();
  });
  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-tab-link]");
    if (!link) return;
    e.preventDefault();
    activate(link.getAttribute("href").slice(1), { scroll: true });
  });
  window.addEventListener("hashchange", () => activate(location.hash.slice(1), { scroll: true }));
  activate(location.hash.slice(1));

  // ---- Helpers ---------------------------------------------------------------

  function status(el, text, kind = "error") {
    if (!text) { el.hidden = true; return; }
    el.hidden = false;
    el.className = "form-status form-status-" + kind;
    el.textContent = text;
  }

  function busy(btn, on, label) {
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${label}`; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }

  // ---- Resume: AI feedback -----------------------------------------------------

  const rrAi = $("rr-ai");
  rrAi.addEventListener("click", async () => {
    const resume = $("rr-resume").value.trim();
    const st = $("rr-status");
    if (resume.length < 40) return status(st, "Paste your resume text first (at least a few lines).");
    status(st, "");
    const out = $("rr-ai-output");
    out.hidden = false;
    out.innerHTML = `<p class="muted"><span class="spinner" aria-hidden="true"></span> Reading your resume…</p>`;
    busy(rrAi, true, "Reviewing…");
    try {
      const data = await CC.ai({ mode: "resume", resume, job: $("rr-job").value });
      out.innerHTML = `<div class="ai-output-head"><span class="ai-badge">✦ AI feedback</span></div><div class="md">${CC.md(data.reply)}</div>`;
      out.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      out.hidden = true;
      status(st, CC.aiErrorMessage(err));
    } finally { busy(rrAi, false); }
  });

  // ---- Cover letter ------------------------------------------------------------

  const clForm = $("cl-form");
  const clOut = $("cl-output");
  const clCopy = $("cl-copy"), clDl = $("cl-download");
  clForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!clForm.reportValidity()) return;
    const btn = clForm.querySelector("button[type=submit]");
    const st = $("cl-status");
    status(st, "");
    const payload = { mode: "cover_letter" };
    [...clForm.elements].forEach((el) => { if (el.name) payload[el.name] = el.value; });
    busy(btn, true, "Writing…");
    clOut.value = "";
    try {
      const data = await CC.ai(payload);
      clOut.value = data.reply;
      clCopy.disabled = clDl.disabled = false;
      if (window.innerWidth < 900) clOut.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      status(st, CC.aiErrorMessage(err));
    } finally { busy(btn, false); }
  });
  clCopy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(clOut.value); clCopy.textContent = "Copied!"; }
    catch { clOut.select(); document.execCommand("copy"); clCopy.textContent = "Copied!"; }
    setTimeout(() => (clCopy.textContent = "Copy"), 1600);
  });
  clDl.addEventListener("click", () => {
    const blob = new Blob([clOut.value], { type: "text/plain" });
    const a = document.createElement("a");
    const company = (clForm.elements.company.value || "cover-letter").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    a.href = URL.createObjectURL(blob);
    a.download = `cover-letter-${company}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  clOut.addEventListener("input", () => { clCopy.disabled = clDl.disabled = !clOut.value.trim(); });

  // ---- Case prep (AI interviewer) ---------------------------------------------

  const caseLog = $("case-log"), caseForm = $("case-form");
  const caseInput = caseForm.querySelector("textarea"), caseSend = caseForm.querySelector("button[type=submit]");
  const caseFeedback = $("case-feedback"), caseStart = $("case-start");
  let caseType = "profitability", caseMsgs = [], caseBusy = false;

  document.querySelector(".case-types").addEventListener("click", (e) => {
    const b = e.target.closest(".case-type");
    if (!b) return;
    document.querySelectorAll(".case-type").forEach((x) => x.classList.toggle("active", x === b));
    caseType = b.dataset.case;
    $("case-label").textContent = b.querySelector("b").textContent + " case";
    if (window.innerWidth < 900) $("case-chat").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function bubble(log, role, html) {
    const el = document.createElement("div");
    el.className = "mini-msg mini-msg-" + role;
    el.innerHTML = html;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  async function caseTurn(userText, shown) {
    if (caseBusy) return;
    caseBusy = true;
    [caseInput, caseSend, caseFeedback].forEach((x) => (x.disabled = true));
    caseMsgs.push({ role: "user", content: userText });
    if (shown) bubble(caseLog, "user", CC.esc(shown));
    const el = bubble(caseLog, "bot", `<span class="typing"><i></i><i></i><i></i></span>`);
    try {
      const reply = await CC.ai({ mode: "case", caseType, messages: caseMsgs }, {
        onToken: (t) => { el.innerHTML = `<div class="md">${CC.md(t)}</div>`; caseLog.scrollTop = caseLog.scrollHeight; },
      });
      caseMsgs.push({ role: "assistant", content: reply });
    } catch (err) {
      caseMsgs.pop();
      el.innerHTML = `<p class="form-status-error">${CC.esc(CC.aiErrorMessage(err))}</p>`;
    } finally {
      caseBusy = false;
      [caseInput, caseSend, caseFeedback].forEach((x) => (x.disabled = false));
      caseInput.focus();
    }
  }

  caseStart.addEventListener("click", () => {
    caseMsgs = [];
    caseLog.innerHTML = "";
    caseStart.textContent = "Restart";
    caseTurn("I'm ready. Please give me the case prompt.", null);
  });
  caseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = caseInput.value.trim();
    if (!t) return;
    caseInput.value = "";
    caseTurn(t, t);
  });
  caseInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); caseForm.requestSubmit(); }
  });
  caseFeedback.addEventListener("click", () => caseTurn("feedback", "Please give me feedback on how I did."));

  // ---- Interview prep ------------------------------------------------------------

  const BEHAVIORAL = [
    "Tell me about yourself.",
    "Why this role, and why this company?",
    "Tell me about a time you worked on a team that wasn't getting along. What did you do?",
    "Describe a time you failed. What did you learn?",
    "Tell me about a time you led something without a formal title.",
    "Walk me through a time you had to learn something new quickly.",
    "Tell me about a time you disagreed with someone. How did you handle it?",
    "What accomplishment are you most proud of, and why?",
  ];
  let ivType = "behavioral", ivQuestion = "";
  const ivList = $("iv-questions"), ivRole = $("iv-role");

  function renderQuestions(qs) {
    ivList.innerHTML = qs.map((q, i) => `<li><button type="button" class="iv-q" data-i="${i}">${CC.esc(q)}</button></li>`).join("");
    ivList.querySelectorAll(".iv-q").forEach((b, i) => b.addEventListener("click", () => pickQuestion(qs[i], b)));
  }
  function pickQuestion(q, btn) {
    ivQuestion = q;
    ivList.querySelectorAll(".iv-q").forEach((b) => b.classList.toggle("active", b === btn));
    $("iv-current").textContent = q;
    $("iv-output").hidden = true;
    $("iv-answer").value = "";
    $("iv-answer").focus({ preventScroll: window.innerWidth >= 900 });
  }

  async function generateQuestions() {
    const btn = $("iv-generate"), st = $("iv-q-status");
    const role = ivRole.value.trim() || CC.profile.get().roles || "";
    status(st, "");
    busy(btn, true, "Thinking…");
    try {
      const data = await CC.ai({ mode: "interview_questions", type: ivType, role });
      const qs = data.reply.split("\n").map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s*/, "").trim()).filter((l) => l.length > 10).slice(0, 6);
      if (!qs.length) throw new Error("none");
      renderQuestions(qs);
    } catch (err) {
      status(st, CC.aiErrorMessage(err));
      if (ivType === "behavioral") renderQuestions(BEHAVIORAL);
    } finally { busy(btn, false); }
  }

  $("iv-type").addEventListener("click", (e) => {
    const b = e.target.closest(".pill");
    if (!b) return;
    $("iv-type").querySelectorAll(".pill").forEach((x) => x.classList.toggle("active", x === b));
    ivType = b.dataset.type;
    if (ivType === "behavioral") renderQuestions(BEHAVIORAL);
    else generateQuestions();
  });
  $("iv-generate").addEventListener("click", generateQuestions);

  $("iv-feedback").addEventListener("click", async () => {
    const answer = $("iv-answer").value.trim(), st = $("iv-status"), out = $("iv-output"), btn = $("iv-feedback");
    if (!ivQuestion) return status(st, "Pick a question first.");
    if (answer.length < 20) return status(st, "Write out your answer first. A few sentences is enough.");
    status(st, "");
    busy(btn, true, "Scoring…");
    try {
      const data = await CC.ai({ mode: "interview_feedback", type: ivType, role: ivRole.value.trim(), question: ivQuestion, answer });
      out.hidden = false;
      out.innerHTML = `<div class="ai-output-head"><span class="ai-badge">✦ Feedback</span></div><div class="md">${CC.md(data.reply)}</div>`;
      out.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      status(st, CC.aiErrorMessage(err));
    } finally { busy(btn, false); }
  });

  ivRole.value = CC.profile.get().roles || "";
  renderQuestions(BEHAVIORAL);

  // ---- Cal.com booking (loaded on first view) -----------------------------------

  let calLoaded = false;
  function loadCal() {
    if (calLoaded) return;
    calLoaded = true;
    (function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");
    window.Cal("init", "mock-interview", { origin: "https://cal.com" });
    window.Cal.ns["mock-interview"]("inline", {
      elementOrSelector: "#my-cal-inline-mock-interview",
      config: { layout: "month_view", useSlotsViewOnSmallScreen: "true", theme: "light" },
      calLink: $("cal-embed").dataset.calLink,
    });
    window.Cal.ns["mock-interview"]("ui", { theme: "light", cssVarsPerTheme: { light: { "cal-brand": "#028090" } }, hideEventTypeDetails: false, layout: "month_view" });
  }

  // ---- Job card actions -----------------------------------------------------------

  document.addEventListener("cc:job-action", (e) => {
    const { action, job } = e.detail;
    if (action === "cover-letter") {
      clForm.elements.role.value = job.title;
      clForm.elements.company.value = job.company;
      activate("cover-letter", { scroll: true });
      clForm.elements.jobDescription.focus({ preventScroll: true });
      clForm.elements.jobDescription.placeholder = `Paste the ${job.company} posting here (open "Apply" to copy it) for a sharper letter…`;
    } else if (action === "interview-prep") {
      ivRole.value = `${job.title} at ${job.company}`;
      $("iv-type").querySelectorAll(".pill").forEach((x) => x.classList.toggle("active", x.dataset.type === "role-specific"));
      ivType = "role-specific";
      activate("interview-prep", { scroll: true });
      generateQuestions();
    }
  });
})();
