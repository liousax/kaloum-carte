/* Agent recenseur NPI · Kaloum : garde l'appli et la carte pour travailler sans réseau. */
const VERSION = "recenseur-v2";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
];
const TILES = "recenseur-tuiles";
const MAX_TILES = 3000;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u =>
    fetch(u, { mode: u.startsWith("http") ? "no-cors" : "same-origin" }).then(r => c.put(u, r)).catch(() => {})
  ))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trimTiles(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_TILES) for (const k of keys.slice(0, keys.length - MAX_TILES)) await cache.delete(k);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* Page de l'appli : le réseau d'abord (pour recevoir les mises à jour), sinon la copie gardée */
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put("./index.html", c)); return r; })
      .catch(() => caches.match("./index.html").then(r => r || caches.match("./"))));
    return;
  }
  /* Tuiles satellite déjà vues : gardées pour le hors-ligne */
  if (url.hostname === "server.arcgisonline.com") {
    e.respondWith(caches.open(TILES).then(cache => cache.match(req).then(hit => hit || fetch(req).then(r => { cache.put(req, r.clone()); trimTiles(cache); return r; }))).catch(() => new Response("", { status: 504 })));
    return;
  }
  /* Bibliothèques, polices, icônes : la copie gardée d'abord */
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com") || url.hostname === "cdnjs.cloudflare.com" || url.hostname === "cdn.jsdelivr.net" || url.origin === location.origin) {
      const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c));
    }
    return r;
  })).catch(() => new Response("", { status: 504 })));
});
