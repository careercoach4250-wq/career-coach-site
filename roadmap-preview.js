/* Career Coach — instant roadmap preview quiz on coaching-roadmaps.html.
   Submits year/major/target to /api/roadmap-preview (Workers AI, grounded
   in verified Tulane facts) and renders a 5-phase preview using the same
   .step-card styling as the homepage's "one platform" section. */
(function () {
  const form = document.getElementById("roadmap-preview-form");
  if (!form) return;

  const status = document.getElementById("rp-status");
  const result = document.getElementById("rp-result");
  const cta = document.getElementById("rp-cta");
  const button = form.querySelector("button[type=submit]");

  const PHASES = [
    ["1", "Discover", "discover"],
    ["2", "Plan", "plan"],
    ["3", "Prepare", "prepare"],
    ["4", "Connect", "connect"],
    ["5", "Apply", "apply"],
  ];

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function render(preview) {
    result.innerHTML = PHASES.map(
      ([num, label, key]) => `
      <div class="step-card">
        <div class="num">${num}</div>
        <h3>${label}</h3>
        <p>${escapeHtml(preview[key] || "")}</p>
      </div>
    `
    ).join("");
    result.hidden = false;
    cta.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = "Building preview…";
    status.hidden = true;

    fetch("/api/roadmap-preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        year: form.year.value,
        major: form.major.value,
        target: form.target.value,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("preview failed");
        return res.json();
      })
      .then((data) => {
        if (!data.preview) throw new Error("no preview");
        render(data.preview);
      })
      .catch(() => {
        status.hidden = false;
        status.className = "form-status form-status-error";
        status.textContent = "Couldn't build a preview right now. Please try again in a moment.";
      })
      .finally(() => {
        button.disabled = false;
        button.textContent = originalText;
      });
  });
})();
