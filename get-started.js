/* Career Coach — get-started.html form handling. Submits both the roadmap
   intake and the contact form to /api/submit (Cloudflare Pages Function),
   which emails the Career Coach team via Resend. */
(function () {
  function showStatus(el, text, kind) {
    el.textContent = text;
    el.hidden = false;
    el.className = "form-status form-status-" + kind;
  }

  function wireForm(formId, statusId, buildPayload) {
    const form = document.getElementById(formId);
    if (!form) return;
    const status = document.getElementById(statusId);
    const button = form.querySelector("button[type=submit]");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;

      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "Sending…";
      status.hidden = true;

      fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildPayload(form)),
      })
        .then((res) => {
          if (!res.ok) throw new Error("submit failed");
          return res.json();
        })
        .then(() => {
          showStatus(status, "Thanks — that's on its way to the Career Coach team.", "ok");
          form.reset();
        })
        .catch(() => {
          showStatus(status, "Something went wrong sending that. Please try again in a moment.", "error");
        })
        .finally(() => {
          button.disabled = false;
          button.textContent = originalText;
        });
    });
  }

  wireForm("intake-form", "intake-status", (form) => ({
    formType: "intake",
    name: form.name.value,
    email: form.email.value,
    year: form.year.value,
    major: form.major.value,
    interests: form.interests.value,
    target: form.target.value,
    wantsResume: form["wants-resume"].checked,
    wantsInterview: form["wants-interview"].checked,
    availability: form.availability.value,
    consent: form.consent.checked,
    hp: form.hp.value,
  }));

  wireForm("contact-form", "contact-status", (form) => ({
    formType: "contact",
    name: form["contact-name"].value,
    email: form["contact-email"].value,
    message: form["contact-message"].value,
    hp: form.hp.value,
  }));
})();
