'use strict';

const cacheName = 'teacher-control-public-assets-v2';
const assetUrls = new Set([
  'manifest.webmanifest',
  'apple-touch-icon.png',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
].map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    const requests = [...assetUrls].map(url => new Request(url, {
      credentials: 'omit',
      redirect: 'error',
    }));
    await cache.addAll(requests);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || !assetUrls.has(request.url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(request)) ?? fetch(request);
  })());
});
