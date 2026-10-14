// Offline Service Worker for BookishEngine Static Mirror
const CACHE_NAME = 'bookishengine-offline-v1';
const PREFIX = '/bookish-engine';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Intercept Next.js Image Optimization
  if (url.pathname.includes('/_next/image')) {
    const targetUrl = url.searchParams.get('url');
    if (targetUrl) {
      let cleanImg = decodeURIComponent(targetUrl);
      if (PREFIX && !cleanImg.startsWith(PREFIX) && cleanImg.startsWith('/')) {
        cleanImg = PREFIX + cleanImg;
      }
      event.respondWith(
        fetch(cleanImg).catch(() => {
          return new Response(
            Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), c => c.charCodeAt(0)),
            { headers: { 'Content-Type': 'image/png' } }
          );
        })
      );
      return;
    }
  }

  // 2. Intercept Auth & Analytics APIs
  if (url.pathname.includes('/api/')) {
    if (url.pathname.includes('/auth/refresh') || url.pathname.includes('/auth/sessions')) {
      event.respondWith(
        new Response(
          JSON.stringify({
            status: 200,
            authenticated: true,
            user: { id: 'usr_huntlax', name: 'Huntlax', username: 'Huntlax' },
            session: { id: 'sess_offline', active: true }
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      );
      return;
    }

    event.respondWith(
      new Response(JSON.stringify({ success: true, offline: true }), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
    return;
  }
});
