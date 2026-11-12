const CACHE = "holdem-drill-2.2.3";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "icon.svg",
  "fonts/fraunces-latin-500-normal.woff2", "fonts/fraunces-latin-700-normal.woff2", "fonts/instrument-sans-latin-400-normal.woff2",
  "fonts/instrument-sans-latin-500-normal.woff2", "fonts/instrument-sans-latin-600-normal.woff2", "fonts/instrument-sans-latin-700-normal.woff2"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
// Network first so updates show up, cache as fallback for offline use
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && new URL(e.request.url).origin === location.origin) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then(m => m || caches.match("index.html"))));
});
