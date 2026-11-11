/* Service worker Paie Juste : cache local, hors ligne, aucune ressource externe.
   URLs relatives au script, pour que le cache et le scope restent dans le dossier
   de l'appli — en local « / », sur GitHub Pages « /Paie-juste/ ». */
const VERSION = "paie-juste-v0.6.0";
const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/app.css",
  "./js/app.js",
  "./js/calc.js",
  "./js/chain.js",
  "./js/compute.js",
  "./js/contrat-parse.js",
  "./js/db.js",
  "./js/demo.js",
  "./js/export.js",
  "./js/importer.js",
  "./js/bulletin-parse.js",
  "./js/sauvegarde.js",
  "./js/journee.js",
  "./js/letters.js",
  "./js/util.js",
  "./js/version.js",
  "./js/modules/pointer.js",
  "./js/modules/paie.js",
  "./js/modules/reclamer.js",
  "./js/modules/contrat.js",
  "./js/modules/donnees.js",
  "./vendor/pdfjs/pdf.min.mjs",
  "./vendor/pdfjs/pdf.worker.min.mjs",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];
self.addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  // L'OCR (≈ 8 Mo) est mis en cache au premier usage seulement.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(e.request)
          .then((res) => {
            if (res.ok && u.pathname.includes("/vendor/")) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(e.request, copy));
            }
            return res;
          })
          .catch(() => caches.match("./index.html")),
    ),
  );
});
