/* Career Coach — shared client core, loaded on every page.
   - CC.profile: the student's profile (major, year, goals...), saved in this
     browser only (localStorage) and shared by every tool so students don't
     have to repeat themselves. Edited through one dialog on any page.
   - CC.ai(): calls /api/coach, streaming tokens when the server streams.
   - CC.md(): small, safe Markdown renderer for AI responses. */
(function () {
  const KEY = "cc_profile";
  const listeners = [];

  const YEARS = ["1st year (freshman)", "2nd year (sophomore)", "3rd year (junior)", "4th year (senior)", "Graduate student", "Recent graduate"];
  const INDUSTRIES = [
    "Not sure yet", "Finance & banking", "Consulting", "Technology & software", "Data & analytics",
    "Product management", "Marketing & media", "Healthcare & public health", "Law & policy",
    "Real estate", "Entrepreneurship & startups", "Nonprofit & public service", "Engineering & hardware",
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function load() {
    try {
      const p = JSON.parse(localStorage.getItem(KEY) || "{}");
      return p && typeof p === "object" ? p : {};
    } catch { return {}; }
  }

  let current = load();

  const profile = {
    YEARS, INDUSTRIES,
    get() { return { ...current }; },
    has() { return !!(current.major || current.roles || current.industry || current.goals); },
    set(next) {
      current = { ...current, ...next };
      Object.keys(current).forEach((k) => { if (typeof current[k] === "string") current[k] = current[k].trim(); });
      try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage unavailable */ }
      renderSummaries();
      listeners.forEach((fn) => fn(profile.get()));
    },
    onChange(fn) { listeners.push(fn); },
    summary(p = current) {
      const year = (p.year || "").replace(/\s*\(.*\)/, "");
      const parts = [year, p.major, p.roles || (p.industry !== "Not sure yet" ? p.industry : "")].filter(Boolean);
      return parts.join(" · ");
    },
    open,
  };

  // ---- Profile dialog ----------------------------------------------------

  let dialog = null;

  function buildDialog() {
    dialog = document.createElement("dialog");
    dialog.className = "profile-dialog";
    dialog.setAttribute("aria-labelledby", "profile-dialog-title");
    dialog.innerHTML = `
      <form method="dialog" class="profile-form">
        <div class="profile-dialog-head">
          <div>
            <h2 id="profile-dialog-title">Your profile</h2>
            <p>Tell us once. The AI Career Coach, roadmap builder, job matching, and prep tools all use it.</p>
          </div>
          <button type="button" class="icon-btn" data-close aria-label="Close">&times;</button>
        </div>
        <div class="profile-grid">
          <label>First name <span class="opt">optional</span><input name="name" autocomplete="given-name"></label>
          <label>School<input name="school" placeholder="Tulane University"></label>
          <label>Year<select name="year"><option value="">Select…</option>${YEARS.map((y) => `<option>${esc(y)}</option>`).join("")}</select></label>
          <label>Major / focus<input name="major" placeholder="e.g. Finance, Computer Science"></label>
          <label>Target industry<select name="industry"><option value="">Select…</option>${INDUSTRIES.map((y) => `<option>${esc(y)}</option>`).join("")}</select></label>
          <label>Target roles<input name="roles" placeholder="e.g. investment banking analyst"></label>
          <label class="span-2">Interests<input name="interests" placeholder="e.g. markets, sustainability, data"></label>
          <label class="span-2">Experience so far<textarea name="experience" rows="3" placeholder="Jobs, internships, clubs, projects, leadership…"></textarea></label>
          <label>Preferred locations<input name="locations" placeholder="e.g. New York, New Orleans, remote"></label>
          <label>Goals<input name="goals" placeholder="e.g. summer analyst offer by junior year"></label>
        </div>
        <p class="profile-privacy">Saved only in this browser. It's sent to our AI only when you use an AI tool, and we don't keep a copy.</p>
        <div class="profile-actions">
          <button type="button" class="btn btn-ghost" data-clear>Clear profile</button>
          <button type="submit" class="btn btn-primary" value="save">Save profile</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    const form = dialog.querySelector("form");
    dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-clear]").addEventListener("click", () => {
      [...form.elements].forEach((el) => { if (el.name) el.value = ""; });
    });
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
    form.addEventListener("submit", () => {
      const data = {};
      [...form.elements].forEach((el) => { if (el.name) data[el.name] = el.value; });
      profile.set(data);
    });
  }

  function open() {
    if (!dialog) buildDialog();
    const form = dialog.querySelector("form");
    [...form.elements].forEach((el) => { if (el.name) el.value = current[el.name] || ""; });
    if (!current.school) form.elements.school.value = "Tulane University";
    dialog.showModal();
    const first = form.querySelector(current.major ? "input[name=name]" : "select[name=year]");
    if (first) first.focus();
  }

  function renderSummaries() {
    document.querySelectorAll("[data-profile-summary]").forEach((el) => {
      const s = profile.summary();
      el.textContent = s || el.dataset.empty || "No profile yet — add one so every tool knows your goals.";
      el.classList.toggle("is-empty", !s);
    });
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-open-profile]");
    if (t) { e.preventDefault(); open(); }
    // Social links whose URLs haven't been provided yet
    if (e.target.closest("a[data-placeholder]")) e.preventDefault();
  });

  // ---- AI calls ------------------------------------------------------------

  async function ai(payload, opts = {}) {
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: current, ...payload, stream: !!opts.onToken }),
      signal: opts.signal,
    });
    if (!res.ok) {
      const err = new Error("ai_error");
      err.status = res.status;
      throw err;
    }
    const type = res.headers.get("content-type") || "";
    if (type.includes("text/event-stream") && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", text = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          const l = line.trim();
          if (!l.startsWith("data:")) continue;
          const data = l.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const piece = JSON.parse(data).response;
            if (typeof piece === "string" && piece) { text += piece; opts.onToken(text); }
          } catch { /* partial or non-JSON line */ }
        }
      }
      if (!text.trim()) throw new Error("empty");
      return text;
    }
    const data = await res.json();
    if (opts.onToken) {
      if (!data.reply) throw new Error("empty");
      opts.onToken(data.reply);
      return data.reply;
    }
    return data;
  }

  function aiErrorMessage(err) {
    if (err && err.status === 429) return "You're going a little fast. Wait a minute and try again.";
    if (err && err.status === 503) return "The AI isn't switched on for this version of the site yet.";
    return "Couldn't reach the AI right now. Check your connection and try again.";
  }

  // ---- Markdown --------------------------------------------------------------

  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  function md(src) {
    const lines = esc(src || "").replace(/\r/g, "").split("\n");
    let html = "", list = null, para = [], i = 0;
    const flushPara = () => { if (para.length) { html += `<p>${inline(para.join("<br>"))}</p>`; para = []; } };
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
    while (i < lines.length) {
      const line = lines[i];
      if (/^```/.test(line)) {
        flushPara(); closeList();
        const code = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
        html += `<pre><code>${code.join("\n")}</code></pre>`;
        i++;
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        flushPara(); closeList();
        const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
        html += `<div class="md-table"><table><thead><tr>${cells(line).map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>`;
        i += 2;
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          html += `<tr>${cells(lines[i]).map((c) => `<td>${c}</td>`).join("")}</tr>`;
          i++;
        }
        html += "</tbody></table></div>";
        continue;
      }
      let m;
      if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
        flushPara(); closeList();
        html += `<h4>${inline(m[2])}</h4>`;
      } else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
        flushPara();
        if (list !== "ul") { closeList(); html += "<ul>"; list = "ul"; }
        html += `<li>${inline(m[1])}</li>`;
      } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
        flushPara();
        if (list !== "ol") { closeList(); html += "<ol>"; list = "ol"; }
        html += `<li>${inline(m[1])}</li>`;
      } else if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
        flushPara(); closeList(); html += "<hr>";
      } else if (!line.trim()) {
        flushPara();
        // keep a list open across a single blank line if it continues
        if (list && !(lines[i + 1] || "").match(/^\s*([-*•]|\d+[.)])\s+/)) closeList();
      } else {
        closeList();
        para.push(line);
      }
      i++;
    }
    flushPara(); closeList();
    return html;
  }

  window.CC = { profile, ai, aiErrorMessage, md, esc };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderSummaries);
  else renderSummaries();
})();
