/* ==========================================================
   Service Worker – Offline-Cache
   Strategie: App-Shell wird bei der Installation vorab
   gecacht (Precache) und dann "Cache First" ausgeliefert.

   Bei JEDER Code-Änderung CACHE_VERSION erhöhen. Geräte laden
   die neue Version dann im Hintergrund und zeigen den Hinweis
   "Neue Version verfügbar". Erst nach Tippen auf "Neu laden"
   wird umgeschaltet – nie mitten in der Benutzung.
   ========================================================== */
'use strict';

const CACHE_VERSION = 'v2';
const CACHE_PREFIX = 'offgrid-hub-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

// Relative Pfade → funktioniert auch in Unterordnern (z. B. GitHub Pages)
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' umgeht den HTTP-Cache des Browsers, damit wirklich
  // die neuen Dateien in den neuen Cache kommen (keine Mischversion).
  // Kein skipWaiting() hier: die neue Version wartet, bis der Nutzer
  // im Hinweis auf "Neu laden" tippt.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const type = event.data?.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: CACHE_VERSION });
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Nur GET-Anfragen der eigenen Origin behandeln
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Navigation (Seitenaufruf): immer die App-Shell liefern → startet offline
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME)
        .then((cache) => cache.match('./index.html'))
        .then((cached) => cached || fetch(request))
    );
    return;
  }

  // Assets: Cache First aus dem Cache DIESER Version, bei Cache-Miss aus dem Netz
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request, { ignoreSearch: true }).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') cache.put(request, response.clone());
          return response;
        });
      })
    )
  );
});
