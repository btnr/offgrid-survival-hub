/* ==========================================================
   Service Worker – Offline-Cache
   Strategie: App-Shell wird bei der Installation vorab
   gecacht (Precache) und dann "Cache First" ausgeliefert.
   Bei jeder Code-Änderung CACHE_VERSION erhöhen, damit
   Clients die neue Version laden.
   ========================================================== */
'use strict';

const CACHE_VERSION = 'v1';
const CACHE_NAME = `offgrid-hub-${CACHE_VERSION}`;

// Relative Pfade → funktioniert auch in Unterordnern (z. B. GitHub Pages)
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('offgrid-hub-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Nur GET-Anfragen der eigenen Origin behandeln
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Navigation (Seitenaufruf): immer die App-Shell liefern → startet offline
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch(request))
    );
    return;
  }

  // Assets: Cache First, bei Cache-Miss aus dem Netz holen und nachcachen
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
