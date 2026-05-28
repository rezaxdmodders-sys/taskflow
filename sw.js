/**
 * TaskFlow Pro — Service Worker v3.7
 * Dual Layer Worker: Advanced Push, OS Note Interceptor & Background Sync
 */

const CACHE_NAME = 'taskflow-cache-v3.7';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
        .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) return caches.delete(cache);
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
        }).catch(() => caches.match('/index.html'))
    );
});

// Background Sync Engine (Mengirim data saat internet kembali online)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-tasks') {
        console.log('[Background Ghost] Sinkronisasi data lokal ke cloud mendesak dijalankan...');
        // Eksekusi logic fetch post database cloud lu di sini
    }
});

self.addEventListener('push', (event) => {
    let data = { title: 'TaskFlow Pro', body: 'Ada tugas mendesak menanti!', url: '/' };
    if (event.data) {
        try { data = event.data.json(); } catch (e) { data.body = event.data.text(); }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: 'https://cdn-icons-png.flaticon.com/512/9068/9068672.png',
            badge: 'https://cdn-icons-png.flaticon.com/512/9068/9068672.png',
            tag: 'alarm-urgent',
            renotify: true,
            vibrate: [500, 110, 500, 110, 450],
            data: { url: data.url || '/' },
            actions: [{ action: 'dismiss', title: 'Matikan Alarm' }]
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    if (event.action === 'dismiss') {
                        client.postMessage({ command: 'STOP_ALARM' });
                    }
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(event.notification.data.url || '/');
        })
    );
});
