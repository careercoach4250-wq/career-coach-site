/* Career Coach — floating "Ask Career Coach" bubble on every page except the
   AI Career Coach tab itself. A quick-question version of the same AI coach
   (/api/coach, mode "widget", streamed), with a link into the full
   AI Career Coach for longer conversations. */
(function () {
  const CC = window.CC;
  if (!CC || document.body.classList.contains("page-ai-coach")) return;

  function build() {
    const wrap = document.createElement("div");
    wrap.className = "cc-chat";
    wrap.innerHTML = `
      <button class="cc-chat-toggle" type="button" aria-label="Ask Career Coach" aria-expanded="false">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 4h16v12H7l-3 3V4z" fill="none" stroke="white" stroke-width="1.8" stroke-linejoin="round"/></svg>
      </button>
      <div class="cc-chat-panel" hidden>
        <div class="cc-chat-head">
          <span>Ask Career Coach <span class="cc-chat-tag">AI</span></span>
          <button class="cc-chat-close" type="button" aria-label="Close">&times;</button>
        </div>
        <div class="cc-chat-log" role="log" aria-live="polite"></div>
        <a class="cc-chat-full" href="ai-coach.html">Open the full AI Career Coach &rarr;</a>
        <form class="cc-chat-form">
          <input type="text" placeholder="Ask a quick question…" aria-label="Your question" autocomplete="off" maxlength="1000">
          <button type="submit" aria-label="Send">&rarr;</button>
        </form>
      </div>`;
    document.body.appendChild(wrap);

    const toggle = wrap.querySelector(".cc-chat-toggle");
    const panel = wrap.querySelector(".cc-chat-panel");
    const log = wrap.querySelector(".cc-chat-log");
    const form = wrap.querySelector(".cc-chat-form");
    const input = form.querySelector("input");
    const messages = [];
    let greeted = false, busy = false;

    function add(html, who) {
      const row = document.createElement("div");
      row.className = "cc-msg cc-msg-" + who;
      row.innerHTML = html;
      log.appendChild(row);
      log.scrollTop = log.scrollHeight;
      return row;
    }

    function open() {
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      if (!greeted) {
        add("Hi! Ask me anything: career paths, recruiting, resumes, interviews, or how Career Coach works.", "bot");
        greeted = true;
      }
      input.focus();
    }
    function close() {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }
    toggle.addEventListener("click", () => (panel.hidden ? open() : close()));
    wrap.querySelector(".cc-chat-close").addEventListener("click", close);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) close(); });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || busy) return;
      busy = true;
      input.value = "";
      add(CC.esc(text), "user");
      messages.push({ role: "user", content: text });
      const row = add(`<span class="typing"><i></i><i></i><i></i></span>`, "bot");
      try {
        const reply = await CC.ai({ mode: "widget", messages }, {
          onToken: (t) => { row.innerHTML = `<div class="md">${CC.md(t)}</div>`; log.scrollTop = log.scrollHeight; },
        });
        messages.push({ role: "assistant", content: reply });
      } catch (err) {
        messages.pop();
        row.textContent = CC.aiErrorMessage(err);
      } finally {
        busy = false;
        input.focus();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
