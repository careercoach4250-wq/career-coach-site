/* Career Coach — AI FAQ assistant. Calls /api/chat (Cloudflare Pages Function backed by
   Claude) for answers; falls back to local keyword matching if that call fails for any
   reason (no API key configured, rate limited, network error, etc). */
(function () {
  const QA = [
    { kw: ["what is", "what's career coach", "about", "what do you do"],
      a: "Career Coach is a roadmap-first career platform for Tulane students — one connected path from exploring career options to getting hired: Discover, Plan, Prepare, Connect, Apply." },
    { kw: ["who is it for", "who can use", "eligib", "class year", "freshman", "sophomore", "junior", "senior"],
      a: "Every Tulane undergraduate, all four class years — from exploring your first year to applying in your last." },
    { kw: ["free", "cost", "price", "pricing", "pay", "expensive"],
      a: "We haven't decided on pricing yet — that's still an open question. Nothing costs anything right now since the site isn't live." },
    { kw: ["sign up", "get started", "start", "join", "begin", "roadmap"],
      a: "Head to \"Start My Roadmap\" at the top of any page — it's the intake form where you share your goals." },
    { kw: ["email", "tulane.edu", "domain", "restrict"],
      a: "Access is limited to @tulane.edu email addresses." },
    { kw: ["resume"],
      a: "Resume review gives you a match score, detected strengths, and improvement suggestions — see the Coaching & Roadmaps page. It's designed and prototyped but not yet connected to this site." },
    { kw: ["mock interview", "interview"],
      a: "Tell us you're interested (and generally available) on the Get Started form, and the team follows up directly — live scheduling isn't built yet." },
    { kw: ["privacy", "data", "safe", "secure"],
      a: "We haven't finalized a privacy policy yet. Nothing on this site is live or collecting real data right now." },
    { kw: ["contact", "support", "question", "help", "reach", "talk to"],
      a: "Use the \"Have a question instead?\" form on the Get Started page." },
    { kw: ["team", "who built", "who made", "founders"],
      a: "Seven Tulane students direct Career Coach's strategy — see the About page to meet everyone." },
    { kw: ["deploy", "live", "launch", "real"],
      a: "This site is still a preview — nothing is deployed to a public domain yet." },
  ];

  const FALLBACK = "I don't have an answer for that yet. Try the Contact form on the Get Started page.";
  const MAX_LEN = 500;

  function findAnswer(text) {
    const q = text.toLowerCase();
    let best = null, bestScore = 0;
    for (const entry of QA) {
      let score = 0;
      for (const kw of entry.kw) if (q.includes(kw)) score++;
      if (score > bestScore) { bestScore = score; best = entry; }
    }
    return best ? best.a : FALLBACK;
  }

  async function askAI(text, history) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: text.slice(0, MAX_LEN), history }),
    });
    if (!res.ok) throw new Error("chat api error " + res.status);
    const data = await res.json();
    if (!data.reply) throw new Error("chat api: no reply");
    return data.reply;
  }

  function addMessage(log, text, who) {
    const row = document.createElement("div");
    row.className = "cc-msg cc-msg-" + who;
    row.textContent = text;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function build() {
    const wrap = document.createElement("div");
    wrap.className = "cc-chat";
    wrap.innerHTML = `
      <button class="cc-chat-toggle" type="button" aria-label="Ask a question" aria-expanded="false">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 4h16v12H7l-3 3V4z" fill="none" stroke="white" stroke-width="1.8" stroke-linejoin="round"/></svg>
      </button>
      <div class="cc-chat-panel" hidden>
        <div class="cc-chat-head">
          <span>Ask Career Coach <span class="cc-chat-tag">AI assistant</span></span>
          <button class="cc-chat-close" type="button" aria-label="Close">&times;</button>
        </div>
        <div class="cc-chat-log" role="log" aria-live="polite"></div>
        <form class="cc-chat-form">
          <input type="text" placeholder="Ask about pricing, getting started..." aria-label="Your question" autocomplete="off">
          <button type="submit" aria-label="Send">&rarr;</button>
        </form>
      </div>
    `;
    document.body.appendChild(wrap);

    const toggle = wrap.querySelector(".cc-chat-toggle");
    const panel = wrap.querySelector(".cc-chat-panel");
    const closeBtn = wrap.querySelector(".cc-chat-close");
    const log = wrap.querySelector(".cc-chat-log");
    const form = wrap.querySelector(".cc-chat-form");
    const input = form.querySelector("input");

    let greeted = false;
    const history = [];
    function open() {
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      if (!greeted) {
        addMessage(log, "Hi! I'm the Career Coach assistant — ask me about pricing, who it's for, how to get started, and more.", "bot");
        greeted = true;
      }
      input.focus();
    }
    function close() {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }
    toggle.addEventListener("click", () => (panel.hidden ? open() : close()));
    closeBtn.addEventListener("click", close);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      addMessage(log, text, "user");
      input.value = "";

      const typing = document.createElement("div");
      typing.className = "cc-msg cc-msg-bot cc-msg-typing";
      typing.textContent = "…";
      log.appendChild(typing);
      log.scrollTop = log.scrollHeight;

      askAI(text, history)
        .then((reply) => {
          typing.remove();
          addMessage(log, reply, "bot");
          history.push({ role: "user", content: text }, { role: "assistant", content: reply });
        })
        .catch(() => {
          typing.remove();
          addMessage(log, findAnswer(text), "bot");
        });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
