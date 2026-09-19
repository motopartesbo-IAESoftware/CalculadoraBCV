/*
 * Calculadora BCV · Service Worker
 *
 * - Archivos estáticos: caché primero, red después (la página siempre carga).
 * - data/tasa.json: red primero, caché después (siempre la tasa más reciente).
 * - Offline: la app funciona con la última tasa conocida.
 */

const CACHE = "bcv-v3";
const ESTATICA = [
  ".",
  "index.html",
  "static/style.css",
  "static/app.js",
  "manifest.json",
  "static/icon-192.png",
  "static/icon-512.png",
];

// Instalar: cachear archivos estáticos
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ESTATICA))
      .then(() => self.skipWaiting())
  );
});

// Activar: limpiar cachés viejos
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Interceptar peticiones
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // data/tasa.json → red primero, caché después
  if (url.pathname.endsWith("tasa.json") || url.pathname.includes("data/tasa")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Todo lo demás: caché primero, red después
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      });
    }).catch(() => {
      if (e.request.destination === "document") {
        return caches.match("index.html");
      }
    })
  );
});