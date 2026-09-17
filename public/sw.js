/**
 * Service Worker for Smart Chat PWA
 * Caches core app shell assets and handles push/notification events
 */

const CACHE_NAME = 'smart-chat-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/assets/img/favicon/favicon.svg',
  '/assets/img/icons/pwa/icon-192.png',
  '/assets/img/icons/pwa/icon-512.png'
];

// Install Event: Pre-cache essential app shell assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing SW...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching App Shell');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up outdated caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating SW...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-first with Cache Fallback for dynamic requests, Cache-first for static shell assets
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip socket.io and CDN external calls from cache
  if (url.pathname.includes('/socket.io') || url.hostname.includes('cdn.socket.io')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Clone and store successful network responses in cache
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if network fails (Offline mode)
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Push Event: Handle background push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received:', event);
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Smart Chat Notification', body: event.data.text() };
    }
  }

  const options = {
    body: data.body || 'You have a new message in Smart Chat',
    icon: data.icon || '/assets/img/icons/pwa/icon-192.png',
    badge: '/assets/img/favicon/favicon.svg',
    tag: data.tag || 'smart-chat-push',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: data.url || '/'
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Smart Chat Alert', options)
  );
});

// Notification Click Event: Focus open client or open new window
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received:', event.notification);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
