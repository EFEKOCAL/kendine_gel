// Çevrimdışı destek. Ağ öncelikli: güncel sürüm varsa onu al (3 sn içinde), yoksa önbellekten sun.
// CACHE adını her yayında değiştirmek gerekmez; eski önbellek activate'te temizlenir.
const CACHE = "kendinegel-v2";
const FILES = ["./", "./index.html", "./css/style.css", "./js/data.js", "./js/guide.js", "./js/store.js", "./js/app.js", "./icon.svg", "./manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  const net = fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  });
  e.respondWith(
    Promise.race([net, timeout(3000)])
      .catch(() => caches.match(e.request).then(r => r || net))
      .catch(() => e.request.mode === "navigate" ? caches.match("./index.html") : Response.error())
  );
});
// Bildirime tıklanınca açık sekmeyi öne getir.
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(cs => cs[0] ? cs[0].focus() : self.clients.openWindow("./#/odak")));
});
