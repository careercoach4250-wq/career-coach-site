/* Career Coach — Customer Support chat widget. Loaded only on faq.html and
   pricing.html (see those files' own <script> tag). A separate, narrower
   bot from the sitewide "Ask Career Coach" bubble (chat-widget.js): this
   one answers only from the FAQ and Pricing pages, via /api/support.
   Owned by the customer-service agent; see ceo/customer-service/CLAUDE.md
   for why it's built this way. */
(function () {
  const CC = window.CC;
  if (!CC) return;

  const GREETING =
    "Hi, I'm Career Coach's automated support assistant (not a person) — I can answer questions from our FAQ and Pricing pages. If I don't know something, I'll offer to pass it to our team.";

  function page() {
    if (document.body.classList.contains("page-pricing")) return "pricing";
    if (document.body.classList.contains("page-faq")) return "faq";
    return "other";
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  function build() {
    const wrap = document.createElement("div");
    wrap.className = "cc-chat cc-chat-support";
    wrap.innerHTML = `
      <button class="cc-chat-toggle" type="button" aria-label="Customer support" aria-expanded="false">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="white" stroke-width="1.8"/><path d="M9 10a3 3 0 1 1 4 2.8V14" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17" r="0.9" fill="white"/></svg>
      </button>
      <div class="cc-chat-panel" hidden>
        <div class="cc-chat-head">
          <span>Customer Support <span class="cc-chat-tag">Automated</span></span>
          <button class="cc-chat-close" type="button" aria-label="Close">&times;</button>
        </div>
        <div class="cc-chat-log" role="log" aria-live="polite"></div>
        <form class="cc-chat-form">
          <input type="text" placeholder="Ask about pricing, accounts, privacy…" aria-label="Your question" autocomplete="off" maxlength="500">
          <button type="submit" aria-label="Send">&rarr;</button>
        </form>
      </div>`;
    document.body.appendChild(wrap);

    const toggle = wrap.querySelector(".cc-chat-toggle");
    const panel = wrap.querySelector(".cc-chat-panel");
    const log = wrap.querySelector(".cc-chat-log");
    const form = wrap.querySelector(".cc-chat-form");
    const input = form.querySelector("input");
    const conversationId = uuid();
    const history = [];
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
        add(CC.esc(GREETING), "bot");
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
      const row = add(`<span class="typing"><i></i><i></i><i></i></span>`, "bot");
      try {
        const res = await fetch("/api/support", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: text, history, page: page(), conversationId }),
        });
        if (!res.ok) throw new Error("support_error_" + res.status);
        const data = await res.json();
        const reply = data && data.reply ? data.reply : "Something went wrong on our end. Please try again in a moment.";
        row.innerHTML = `<div class="md">${CC.md(reply)}</div>`;
        history.push({ role: "user", content: text }, { role: "assistant", content: reply });
      } catch {
        row.textContent = "Couldn't reach support right now. Please try again, or use the contact form on our Get Started page.";
      } finally {
        log.scrollTop = log.scrollHeight;
        busy = false;
        input.focus();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
