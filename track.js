/* Career Coach — usage tracker. Records what visitors do (page views and
   key actions) as rows in our own Supabase `events` table. No outside
   analytics tool. Owned by research-analytics; see
   mktg research and analytics/ceo/analytics/KPI-PLAN.md.

   Records actions only: the event name, the page path, the referring
   site's host name, the link tag (utm_*), phone or computer, and a random
   ID for this browser. It never reads or sends what people type: no form
   answers, names, emails, resume text, chat messages or passwords.

   Key actions are noticed from the site's own /api/ calls (by their `mode`
   or `formType` only) and from a few clicks, so other scripts don't need to
   change. Other code can call CCTrack.event("name") for a new action.

   Debugging: add ?cc_debug=1 to any address to log events to the console.
   Team browsers: add ?cc_team=1 once so your rows are marked is_team and
   left out of the KPI queries (?cc_team=0 undoes it). */
(function () {
  // Public values: the project URL and the publishable (anon) key are meant
  // to be in browser code. Row level security only lets browsers add rows.
  const SUPABASE_URL = "";
  const SUPABASE_KEY = "";

  const ENDPOINT = SUPABASE_URL ? SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/events" : "";
  const K = { visitor: "cc_visitor_id", first: "cc_first_tag", team: "cc_team", debug: "cc_debug" };
  const TAGS = ["utm_source", "utm_medium", "utm_campaign"];
  const params = new URLSearchParams(location.search);

  // ---- storage that never throws (private windows can block it) ----------
  const mem = {};
  function get(k) { try { const v = localStorage.getItem(k); return v === null ? mem[k] || null : v; } catch { return mem[k] || null; } }
  function set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch { /* blocked: memory only */ } }
  function del(k) { delete mem[k]; try { localStorage.removeItem(k); } catch { /* no-op */ } }

  if (params.get("cc_team") === "1") set(K.team, "1");
  if (params.get("cc_team") === "0") del(K.team);
  if (params.get("cc_debug") === "1") set(K.debug, "1");
  const debug = get(K.debug) === "1";

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  let visitorId = get(K.visitor);
  if (!/^[0-9a-f-]{36}$/i.test(visitorId || "")) { visitorId = uuid(); set(K.visitor, visitorId); }

  // ---- where this visitor came from ---------------------------------------
  const clip = (v, n) => (v ? String(v).trim().toLowerCase().slice(0, n) : null);
  const tag = { utm_source: clip(params.get("utm_source"), 60), utm_medium: clip(params.get("utm_medium"), 60), utm_campaign: clip(params.get("utm_campaign"), 80) };
  const hasTag = TAGS.some((t) => tag[t]);

  let referrer = null;
  try { const r = document.referrer && new URL(document.referrer); if (r && r.host !== location.host) referrer = clip(r.host, 120); } catch { /* no-op */ }

  let first = null;
  try { first = JSON.parse(get(K.first) || "null"); } catch { first = null; }
  if (!first && (hasTag || referrer)) {
    first = { source: referrer, ...tag };
    set(K.first, JSON.stringify(first));
  }
  first = first || {};

  // Signed-in user, in memory only: the site's sign-in code calls
  // CCTrack.identify() on every page load once a session exists.
  let user = null;

  const ua = navigator.userAgent || "";
  const device = /Mobi|Android|iPhone|iPod/i.test(ua) ||
    (window.matchMedia && matchMedia("(pointer: coarse)").matches && innerWidth < 768) ? "phone" : "computer";

  function pagePath() {
    const h = location.hash.slice(1);
    return (location.pathname.replace(/\.html$/, "") || "/") + (/^[a-z0-9-]{1,40}$/.test(h) ? "#" + h : "");
  }

  // ---- sending -------------------------------------------------------------
  const send = window.fetch.bind(window);
  function event(name) {
    if (!/^[a-z_]{2,40}$/.test(name)) return;
    const row = {
      visitor_id: visitorId,
      user_id: user && user.token ? user.id : null,
      event: name,
      page: pagePath().slice(0, 120),
      source: referrer,
      ...tag,
      first_source: first.source || null,
      first_utm_source: first.utm_source || null,
      first_utm_medium: first.utm_medium || null,
      first_utm_campaign: first.utm_campaign || null,
      device,
      is_team: get(K.team) === "1",
    };
    if (debug) console.log("[CCTrack]", name, row);
    if (!ENDPOINT || !SUPABASE_KEY) return;
    const headers = { "content-type": "application/json", apikey: SUPABASE_KEY, Prefer: "return=minimal" };
    // Legacy anon keys are JWTs; new sb_publishable_ keys go in apikey only.
    const bearer = user && user.token ? user.token : (SUPABASE_KEY.startsWith("eyJ") ? SUPABASE_KEY : "");
    if (bearer) headers.Authorization = "Bearer " + bearer;
    send(ENDPOINT, { method: "POST", headers, body: JSON.stringify(row), keepalive: true })
      .then((res) => { if (!res.ok && debug) res.text().then((t) => console.warn("[CCTrack] insert failed", res.status, t)); })
      .catch((err) => { if (debug) console.warn("[CCTrack] insert failed", err); });
  }

  // ---- key actions from our own /api/ calls --------------------------------
  // Only `mode` / `formType` are read from the request; nothing else in it.
  const MODES = {
    resume: "resume_feedback", roadmap: "roadmap_built", coach: "coach_answer", widget: "widget_answer",
    cover_letter: "cover_letter_written", case: "case_practice",
    interview_questions: "interview_questions", interview_feedback: "interview_feedback",
  };
  window.fetch = function (input, init) {
    let name = null;
    try {
      const url = new URL(typeof input === "string" ? input : input.url, location.href);
      if (url.origin === location.origin && init && init.method === "POST" && typeof init.body === "string") {
        if (url.pathname === "/api/coach") name = MODES[JSON.parse(init.body).mode] || null;
        if (url.pathname === "/api/submit") name = JSON.parse(init.body).formType === "contact" ? "contact_sent" : "sign_up";
      }
    } catch { name = null; }
    const p = send(input, init);
    if (name) {
      p.then(async (res) => {
        if (!res.ok) return;
        // A JSON answer must not be an error, and a roadmap must contain one.
        // Only these two keys are looked at; the answer itself is not kept.
        if ((res.headers.get("content-type") || "").includes("application/json")) {
          const data = await res.clone().json().catch(() => null);
          if (!data || data.error || (name === "roadmap_built" && !data.roadmap)) return;
        }
        event(name);
      }).catch(() => {});
    }
    return p;
  };

  // ---- key actions from clicks ---------------------------------------------
  document.addEventListener("click", (e) => {
    const t = e.target.closest ? e.target : null;
    if (!t) return;
    if (t.closest("#rr-analyze")) event("resume_check");
    const star = t.closest(".job-save-btn");
    if (star && star.getAttribute("aria-pressed") !== "true") event("item_saved");
  }, true);

  // Cal.com mock-interview booking (the embed loads on first view of its tab).
  let lastBooking = 0;
  function onBooking() { if (Date.now() - lastBooking > 5000) { lastBooking = Date.now(); event("booking_created"); } }
  const calTimer = setInterval(() => {
    const ns = window.Cal && window.Cal.ns && window.Cal.ns["mock-interview"];
    if (!ns) return;
    clearInterval(calTimer);
    ns("on", { action: "bookingSuccessful", callback: onBooking });
    ns("on", { action: "bookingSuccessfulV2", callback: onBooking });
  }, 1000);

  // ---- keep the link tag on the way to sign-up -----------------------------
  // If storage is blocked, the tag survives in the Get Started address.
  const carry = hasTag ? tag : (first.utm_source ? first : null);
  function tagLinks() {
    if (!carry) return;
    document.querySelectorAll('a[href*="get-started"]').forEach((a) => {
      try {
        const u = new URL(a.getAttribute("href"), location.href);
        if (u.origin !== location.origin || u.searchParams.has("utm_source")) return;
        TAGS.forEach((t) => { if (carry[t]) u.searchParams.set(t, carry[t]); });
        a.setAttribute("href", u.pathname + u.search + u.hash);
      } catch { /* no-op */ }
    });
  }

  // ---- page views ----------------------------------------------------------
  function start() { tagLinks(); event("page_view"); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  let lastPage = pagePath();
  window.addEventListener("hashchange", () => { const p = pagePath(); if (p !== lastPage) { lastPage = p; event("page_view"); } });

  // ---- sign-in hook (for when the site has accounts) -----------------------
  // On every page load with a Supabase session:
  //   CCTrack.identify(session.user.id, session.access_token)
  // The first call in a browser records an `identify` row joining this
  // visitor_id and its first link tag to the account; every later event
  // carries the user_id. On sign-out: CCTrack.reset().
  window.CCTrack = {
    event,
    identify(id, token) {
      if (!/^[0-9a-f-]{36}$/i.test(id || "")) return;
      if (!token) return;
      const isNew = get("cc_identified") !== id;
      user = { id, token };
      if (isNew) { set("cc_identified", id); event("identify"); }
    },
    reset() { user = null; del("cc_identified"); },
    visitorId: () => visitorId,
  };
})();
