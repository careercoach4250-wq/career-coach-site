/* Career Coach — AI Career Coach page (ai-coach.html). A full chat app on
   top of /api/coach (mode "coach", streamed): conversation history saved in
   this browser (localStorage), suggested prompts, follow-up chips, a stop
   button, and Markdown-formatted answers. The student's profile (CC.profile)
   is sent with every message so they never have to re-explain themselves.
   Other pages can open a conversation with ai-coach.html?q=<question>. */
(function () {
  const CC = window.CC;
  const KEY = "cc_chats";
  const MAX_CHATS = 30;
  const $ = (id) => document.getElementById(id);
  const scrollEl = $("coach-scroll"), msgsEl = $("coach-messages"), welcome = $("coach-welcome");
  const form = $("coach-form"), input = $("coach-input"), sendBtn = $("coach-send"), stopBtn = $("coach-stop");
  const historyEl = $("coach-history"), followEl = $("followups");
  const FOLLOWUPS = ["Tell me more", "What should I do this week?", "Give me a concrete example", "Turn that into a checklist"];

  let chats = load();
  let current = null;
  let controller = null;

  function load() {
    try { const c = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(c) ? c : []; } catch { return []; }
  }
  function persist() {
    chats.sort((a, b) => b.updated - a.updated);
    chats = chats.slice(0, MAX_CHATS);
    try { localStorage.setItem(KEY, JSON.stringify(chats)); } catch { /* storage full or unavailable */ }
  }

  function ago(ts) {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    const d = Math.floor(h / 24);
    return d === 1 ? "yesterday" : d + "d ago";
  }

  function renderHistory() {
    historyEl.innerHTML = chats.map((c) => `
      <li class="${current && c.id === current.id ? "active" : ""}">
        <button type="button" class="coach-history-item" data-id="${c.id}">
          <span class="t">${CC.esc(c.title)}</span><span class="d">${ago(c.updated)}</span>
        </button>
        <button type="button" class="coach-history-del" data-del="${c.id}" aria-label="Delete conversation: ${CC.esc(c.title)}">&times;</button>
      </li>`).join("");
    $("coach-history-empty").hidden = chats.length > 0;
  }

  function greeting() {
    const p = CC.profile.get();
    $("coach-greeting").textContent = p.name ? `Hi ${p.name}, what's on your mind?` : "What's on your mind?";
    $("coach-profile-nudge").hidden = CC.profile.has();
    const s = CC.profile.summary();
    $("coach-subtitle").textContent = s ? `Coaching you as: ${s}` : "Your career advisor, available 24/7";
  }

  function msgHTML(m) {
    if (m.role === "user") return `<div class="msg msg-user"><div class="bubble">${CC.esc(m.content)}</div></div>`;
    return `<div class="msg msg-ai"><span class="coach-avatar" aria-hidden="true">✦</span><div class="bubble md">${CC.md(m.content)}<div class="msg-tools"><button type="button" class="link-btn" data-copy>Copy</button></div></div></div>`;
  }

  function renderChat() {
    const has = current && current.messages.length;
    welcome.hidden = !!has;
    msgsEl.innerHTML = has ? current.messages.map(msgHTML).join("") : "";
    followEl.hidden = !has || current.messages[current.messages.length - 1].role !== "assistant";
    if (!followEl.hidden) followEl.innerHTML = FOLLOWUPS.map((f) => `<button type="button" class="followup">${f}</button>`).join("");
    renderHistory();
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function openChat(id) {
    current = chats.find((c) => c.id === id) || null;
    renderChat();
    closeSidebar();
    input.focus();
  }

  function newChat() {
    if (controller) controller.abort();
    current = null;
    renderChat();
    closeSidebar();
    input.value = "";
    autosize();
    input.focus();
  }

  function setBusy(on) {
    sendBtn.hidden = on;
    stopBtn.hidden = !on;
    input.disabled = false;
    followEl.hidden = true;
  }

  async function send(text) {
    text = text.trim();
    if (!text || controller) return;
    if (!current) {
      current = { id: "c" + Date.now().toString(36), title: text.replace(/\s+/g, " ").slice(0, 60), updated: Date.now(), messages: [] };
      chats.unshift(current);
    }
    current.messages.push({ role: "user", content: text });
    current.updated = Date.now();
    persist();
    renderChat();
    followEl.hidden = true;

    msgsEl.insertAdjacentHTML("beforeend", `<div class="msg msg-ai" id="pending"><span class="coach-avatar" aria-hidden="true">✦</span><div class="bubble md"><span class="typing"><i></i><i></i><i></i></span></div></div>`);
    const bubble = msgsEl.querySelector("#pending .bubble");
    scrollEl.scrollTop = scrollEl.scrollHeight;
    controller = new AbortController();
    setBusy(true);
    let partial = "";
    try {
      const reply = await CC.ai({ mode: "coach", messages: current.messages }, {
        signal: controller.signal,
        onToken: (t) => {
          partial = t;
          const nearBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 120;
          bubble.innerHTML = CC.md(t);
          if (nearBottom) scrollEl.scrollTop = scrollEl.scrollHeight;
        },
      });
      current.messages.push({ role: "assistant", content: reply });
    } catch (err) {
      if (err.name === "AbortError" && partial) {
        current.messages.push({ role: "assistant", content: partial + "\n\n*(stopped)*" });
      } else if (err.name !== "AbortError") {
        const last = current.messages.pop();
        input.value = last.content;
        autosize();
        bubble.innerHTML = `<p class="form-status-error">${CC.esc(CC.aiErrorMessage(err))}</p>`;
        controller = null;
        setBusy(false);
        persist();
        if (!current.messages.length) { chats = chats.filter((c) => c !== current); persist(); renderHistory(); }
        return;
      }
    }
    controller = null;
    setBusy(false);
    current.updated = Date.now();
    persist();
    renderChat();
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 200) + "px";
  }

  // ---- Events ----------------------------------------------------------------

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = input.value;
    input.value = "";
    autosize();
    send(t);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  input.addEventListener("input", autosize);
  stopBtn.addEventListener("click", () => controller && controller.abort());

  $("prompt-grid").addEventListener("click", (e) => {
    const chip = e.target.closest(".prompt-chip");
    if (!chip) return;
    const prompt = chip.dataset.prompt;
    if (chip.hasAttribute("data-fill")) {
      input.value = prompt;
      autosize();
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    } else send(prompt);
  });
  followEl.addEventListener("click", (e) => {
    const b = e.target.closest(".followup");
    if (b) send(b.textContent);
  });
  msgsEl.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    const idx = [...msgsEl.querySelectorAll(".msg")].indexOf(b.closest(".msg"));
    const m = current && current.messages[idx];
    if (!m) return;
    try { await navigator.clipboard.writeText(m.content); b.textContent = "Copied!"; } catch { b.textContent = "Couldn't copy"; }
    setTimeout(() => (b.textContent = "Copy"), 1500);
  });
  historyEl.addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      chats = chats.filter((c) => c.id !== del.dataset.del);
      if (current && current.id === del.dataset.del) current = null;
      persist();
      renderChat();
      return;
    }
    const item = e.target.closest("[data-id]");
    if (item) openChat(item.dataset.id);
  });
  $("coach-new").addEventListener("click", newChat);
  $("coach-new-top").addEventListener("click", newChat);

  // Mobile drawer
  const sidebar = $("coach-sidebar"), scrim = $("coach-scrim"), menu = $("coach-menu");
  function closeSidebar() { sidebar.classList.remove("open"); scrim.hidden = true; menu.setAttribute("aria-expanded", "false"); }
  menu.addEventListener("click", () => {
    const open = !sidebar.classList.contains("open");
    sidebar.classList.toggle("open", open);
    scrim.hidden = !open;
    menu.setAttribute("aria-expanded", String(open));
  });
  scrim.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSidebar(); });

  CC.profile.onChange(greeting);
  greeting();
  renderChat();

  const q = new URLSearchParams(location.search).get("q");
  if (q) {
    history.replaceState(null, "", location.pathname);
    send(q.slice(0, 2000));
  } else if (window.matchMedia("(min-width: 900px)").matches) {
    input.focus();
  }
})();
