/**
 * TaskFlow Pro — Service Worker v3.5
 * Dual Layer Worker: Caching Platform & Notification Dispatcher
 */

const CACHE_NAME = 'taskflow-cache-v3.5';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request).then((networkResponse) => {
                if (event.request.method === 'GET' && networkResponse.status === 200) {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }
                return networkResponse;
            });
        }).catch(() => {
            if (event.request.mode === 'navigate') {
                return caches.match('/index.html');
            }
        })
    );
});

// HANDLER CLICK UNTUK TOMBOL DI INTERFACES NOTIFIKASI OS
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); // Tutup pop-up banner di desktop/HP

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Cari tab TaskFlow Pro yang sedang terbuka
            for (const client of clientList) {
                if ('focus' in client) {
                    // Kirim sinyal instruksi lewat kanal postMessage ke Main Thread untuk stop alarm
                    if (event.action === 'dismiss') {
                        client.postMessage({ command: 'STOP_ALARM' });
                    }
                    return client.focus();
                }
            }
            // Jika aplikasi belum terbuka, jalankan instance baru
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});