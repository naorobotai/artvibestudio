/**
 * Service Worker for ArtVibeStudio
 * Handles caching, offline support, and push notifications
 */

// Cache name and files to cache
const CACHE_NAME = 'artvibestudio-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/service-worker.js',
  '/favicon.ico',
  '/images/phone-mockup.webp',
  '/images/wallpaper.webp',
  '/images/stickers.webp',
  '/images/printable.webp',
  '/images/avatar.webp',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&family=Montserrat:wght@600;800&display=swap',
  'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
  'https://unpkg.com/swiper/swiper-bundle.min.css',
];

// Install event: Cache essential files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching files');
      return cache.addAll(urlsToCache);
    }).catch((error) => {
      console.error('Service Worker: Caching failed', error);
    })
  );
  // Force the service worker to activate immediately
  self.skipWaiting();
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated');
      return self.clients.claim(); // Take control of all clients immediately
    })
  );
});

// Fetch event: Serve cached files or fetch from network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached response if found
      if (response) {
        return response;
      }
      // Otherwise, fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Cache the new response for future use (only for GET requests)
        if (event.request.method === 'GET') {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }
        return networkResponse;
      }).catch((error) => {
        console.error('Service Worker: Fetch failed', error);
        // Fallback for offline mode
        return caches.match('/index.html');
      });
    })
  );
});

// Push event: Handle push notifications from Firebase Cloud Messaging
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push event received');
  let data = {};
  if (event.data) {
    data = event.data.json();
  }
  const title = data.title || 'ArtVibeStudio Update';
  const options = {
    body: data.body || 'You have a new notification from ArtVibeStudio!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: {
      url: data.url || 'https://artvibestudio.store', // Redirect URL when notification is clicked
    },
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event: Open the website or a specific URL
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  event.notification.close();
  const urlToOpen = event.notification.data.url || 'https://artvibestudio.store';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if the site is already open
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});