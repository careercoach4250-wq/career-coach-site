/* Career Coach — resume review tool on coaching-roadmaps.html.
   Ported from career-coach's (Asaf's) v1 analyzer prototype
   (career-coach/app/js/utils.js's analyzeResume + career-coach/app/js/modules/resumeReview.js) —
   same rule-based logic, same honesty framing. Runs entirely client-side:
   nothing pasted here is uploaded or sent anywhere. The full prototype's
   Dashboard/Profile/Sessions history is a separate local app and isn't part
   of this public-site version. */
(function () {
  const STOPWORDS = new Set(
    ("a an the and or for with of to in on at by from as is are was were be been being this that " +
      "these those it its your you we our will can may should must about into over under across per etc").split(" ")
  );

  const ACTION_VERBS = [
    "led", "built", "launched", "designed", "managed", "increased", "reduced", "created", "developed",
    "improved", "achieved", "drove", "spearheaded", "negotiated", "analyzed", "optimized", "organized",
    "coordinated", "delivered", "implemented", "presented", "trained", "mentored", "streamlined",
  ];

  function tokenize(text) {
    return (text || "").toLowerCase().match(/[a-z][a-z+.#-]{2,}/g) || [];
  }

  function extractKeywords(text, limit = 20) {
    const counts = new Map();
    tokenize(text).forEach((w) => {
      if (STOPWORDS.has(w)) return;
      counts.set(w, (counts.get(w) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([w]) => w);
  }

  // v1 analysis engine: rule-based pattern matching, not a model call.
  function analyzeResume(resumeText, jobText) {
    const resumeTokenSet = new Set(tokenize(resumeText));
    const jobKeywords = jobText && jobText.trim() ? extractKeywords(jobText, 20) : [];
    const matched = jobKeywords.filter((k) => resumeTokenSet.has(k));
    const missing = jobKeywords.filter((k) => !resumeTokenSet.has(k));
    const matchScore = jobKeywords.length ? Math.round((matched.length / jobKeywords.length) * 100) : null;

    const lines = (resumeText || "").split("\n").map((l) => l.trim()).filter(Boolean);
    const verbPattern = new RegExp("\\b(" + ACTION_VERBS.join("|") + ")\\b", "i");
    const hasMetric = (l) => /\d/.test(l);

    const strengths = lines.filter((l) => verbPattern.test(l) && hasMetric(l)).slice(0, 5);
    const unquantified = lines.filter((l) => verbPattern.test(l) && !hasMetric(l)).slice(0, 5);

    const suggestions = [];
    if (unquantified.length) {
      suggestions.push(
        `${unquantified.length} bullet point(s) use strong action verbs but no measurable result — add numbers, percentages, or scale where you can.`
      );
    }
    if (!/education/i.test(resumeText)) suggestions.push('No clear "Education" section detected — make sure it is labeled and easy to find.');
    if (!/(experience|employment|work history)/i.test(resumeText)) suggestions.push('No clear "Experience" section detected.');
    if (!/skills/i.test(resumeText)) suggestions.push('Consider a dedicated "Skills" section for quick scanning.');
    if (missing.length) {
      suggestions.push(`Role-specific terms from the job post not found in the resume (only add if genuinely true): ${missing.slice(0, 8).join(", ")}.`);
    }
    if ((resumeText || "").trim().length < 400) {
      suggestions.push("Resume content looks thin for a typical one-page resume — consider adding more detail to recent roles.");
    }
    if (!suggestions.length) {
      suggestions.push("No major gaps detected by the v1 checklist — nice work. A human review from Asaf is still recommended before applying.");
    }

    return { matchScore, matched, missing, strengths, unquantified, suggestions };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function renderResults(card, result) {
    card.innerHTML = `
      <h3>Results</h3>
      ${
        result.matchScore !== null
          ? `<div class="rr-score-label">Job match score</div>
             <div class="rr-score-value">${result.matchScore}%</div>
             <div class="rr-progress"><div class="rr-progress-fill" style="width:${result.matchScore}%"></div></div>`
          : `<p class="section-lede" style="margin-bottom:0;">Add a job description above to get a match score.</p>`
      }

      <h4>Strengths detected</h4>
      ${
        result.strengths.length
          ? `<ul>${result.strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
          : `<p class="section-lede" style="margin-bottom:0;">None detected yet — see suggestions.</p>`
      }

      <h4>Suggestions</h4>
      <ul>${result.suggestions.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>

      ${
        result.missing.length
          ? `<h4>Job keywords not found in resume</h4><p class="section-lede" style="margin-bottom:0;">${result.missing.map(escapeHtml).join(", ")}</p>`
          : ""
      }
    `;
  }

  function init() {
    const resumeInput = document.getElementById("rr-resume");
    const jobInput = document.getElementById("rr-job");
    const button = document.getElementById("rr-analyze");
    const status = document.getElementById("rr-status");
    const results = document.getElementById("rr-results");
    if (!button) return;

    button.addEventListener("click", () => {
      const resumeText = resumeInput.value;
      if (!resumeText.trim()) {
        status.hidden = false;
        status.className = "form-status form-status-error";
        status.textContent = "Paste resume text first.";
        return;
      }
      status.hidden = true;
      const result = analyzeResume(resumeText, jobInput.value);
      renderResults(results, result);
      results.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
