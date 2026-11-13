const CACHE = "holdem-drill-2.9.1";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "icon.svg",
  "fonts/fraunces-latin-500-normal.woff2", "fonts/fraunces-latin-700-normal.woff2", "fonts/instrument-sans-latin-400-normal.woff2",
  "fonts/instrument-sans-latin-500-normal.woff2", "fonts/instrument-sans-latin-600-normal.woff2", "fonts/instrument-sans-latin-700-normal.woff2"];
// Always ask the server for a fresh copy (cache: "reload" / "no-cache"), never the browser's own HTTP cache.
// Without that, a new version could store or show an index.html from the release before it: a phone once kept
// showing a broken Settings page from an old release whenever the connection was poor.
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))));
  self.skipWaiting();
});
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
// Network first so updates show up, cache as fallback for offline use
self.addEventListener("fetch", e => {
  // Only this app's own files.
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request.url, { cache: "no-cache" }).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(m => m || caches.match("index.html"))));
});
