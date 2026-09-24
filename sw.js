/* Career Coach — service worker. Makes the site installable as an app and
   keeps the pages readable offline. Pages and job data are network-first (so
   visitors always get the latest when online); static assets are cached.
   /api/ calls (chat, forms, roadmap preview) and cross-origin requests like
   Cal.com and Google Fonts are never intercepted. Bump VERSION on changes to
   the precache list. */
const VERSION = "cc-v1";
const PAGES = [
  "index", "how-it-works", "coaching-roadmaps", "who-its-for", "resources",
  "jobs", "our-motive", "about", "social", "get-started", "offline"
];
const ASSETS = [
  "/styles.css", "/mobile-nav.js", "/chat-widget.js", "/pwa.js",
  "/get-started.js", "/jobs.js", "/resume-review.js", "/roadmap-preview.js",
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

  if (req.mode === "navigate" || url.pathname.endsWith(".json")) {
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

  // Static assets: serve from cache, refresh in the background.
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
