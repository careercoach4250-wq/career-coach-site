/* Career Coach — service worker. Makes the site installable as an app and
   keeps the pages readable offline. Pages, styles, scripts, and job data are network-first (so
   visitors always get the latest when online); only icons are cache-first.
   /api/ calls (AI coach, forms) and cross-origin requests like
   Cal.com and Google Fonts are never intercepted. Bump VERSION on changes to
   the precache list. */
const VERSION = "cc-v2";
const PAGES = [
  "index", "about", "job-finding", "coaching-roadmaps", "ai-coach",
  "get-started", "privacy", "terms", "offline"
];
const ASSETS = [
  "/styles.css", "/cc-core.js", "/chat-widget.js", "/pwa.js", "/ai-coach.js", "/job-finding.js", "/roadmap-builder.js",
  "/get-started.js", "/jobs.js", "/resume-review.js",
  "/jobs-data.json", "/manifest.webmanifest",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"
];

// Cloudflare Pages redirects /about.html -> /about. Browsers won't serve a
// redirected response to a navigation, so store a clean copy.
async function clean(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

async function put(cache, key, res) {
  if (res.ok) await cache.put(key, await clean(res));
}

// "/about", "/about.html" and "/" vs "/index.html" are the same page.
function variants(pathname) {
  if (pathname === "/" || pathname === "/index" || pathname === "/index.html") return ["/", "/index.html"];
  if (pathname.endsWith(".html")) return [pathname, pathname.slice(0, -5)];
  return [pathname, pathname + ".html"];
}

async function fromCache(req) {
  const cache = await caches.open(VERSION);
  for (const p of variants(new URL(req.url).pathname)) {
    const hit = await cache.match(p, { ignoreSearch: true });
    if (hit) return hit;
  }
  return null;
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    const urls = PAGES.map((p) => "/" + p + ".html").concat(ASSETS);
    await Promise.all(urls.map((u) => fetch(u).then((res) => put(cache, u, res)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  // Icons rarely change: serve from cache. Everything else is network-first
  // so pages, styles, and scripts always match after a deploy.
  if (!url.pathname.startsWith("/icons/")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => put(c, url.pathname, copy));
          return res;
        })
        .catch(async () => (await fromCache(req)) ||
          (req.mode === "navigate" ? (await fromCache(new Request("/offline.html"))) : Response.error()))
    );
    return;
  }

  // Icons: cache first, refresh in the background.
  e.respondWith(
    fromCache(req).then((hit) => {
      const fresh = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => put(c, url.pathname, copy));
        return res;
      });
      return hit || fresh;
    })
  );
});
