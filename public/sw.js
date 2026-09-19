// public/sw.js
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // A simple pass-through network-only strategy.
  // This satisfies the PWA installability criteria without caching data.
  event.respondWith(fetch(event.request));
});
