// Çevrimdışı destek. Ağ öncelikli: güncel sürüm varsa onu al, yoksa önbellekten sun.
// CACHE adını her yayında değiştirmek gerekmez; eski önbellek activate'te temizlenir.
const CACHE = "kendinegel-v1";
const FILES = ["./", "./index.html", "./css/style.css", "./js/data.js", "./js/guide.js", "./js/store.js", "./js/app.js", "./icon.svg", "./manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});
