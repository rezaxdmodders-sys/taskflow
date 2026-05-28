/**
 * TaskFlow Pro — Service Worker v4.0
 * Core Architecture: Offline Caching, Background Sync, & Push Alarm Bridge
 */

const CACHE_NAME = 'taskflow-core-v4.0';
const ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
        .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.map((k) => { if (k !== CACHE_NAME) return caches.delete(k); })
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => {
            return res || fetch(e.request).then((networkRes) => {
                if (e.request.method === 'GET' && networkRes.status === 200) {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, networkRes.clone());
                        return networkRes;
                    });
                }
                return networkRes;
            });
        }).catch(() => caches.match('/index.html'))
    );
});

// BACKGROUND SYNC API: Mengirim antrean data lokal otomatis pas dapet internet
self.addEventListener('sync', (e) => {
    if (e.tag === 'sync-tasks') {
        console.log('[SW Ghost] Sinkronisasi latar belakang mendesak dipicu...');
        // Ruang eksekusi untuk sinkronisasi fetch API database cloud lu di masa depan
    }
});

// PUSH ALARM ENGINE: Bangunin perangkat terlepas dari status aplikasi aktif/mati
self.addEventListener('push', (e) => {
    let data = { title: 'TaskFlow Pro', body: 'Urgensi temporal terdeteksi! Cek tugas lu, bro.', url: '/' };
    if (e.data) {
        try { data = e.data.json(); } catch (err) { data.body = e.data.text(); }
    }

    e.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: 'https://cdn-icons-png.flaticon.com/512/9068/9068672.png',
            badge: 'https://cdn-icons-png.flaticon.com/512/9068/9068672.png',
            tag: 'temporal-alarm',
            renotify: true,
            vibrate: [400, 100, 400, 100, 300],
            data: { url: data.url || '/' },
            actions: [{ action: 'dismiss', title: 'Matikan Alarm' }]
        })
    );
});

self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
            for (const tab of tabs) {
                if ('focus' in tab) {
                    if (e.action === 'dismiss') {
                        tab.postMessage({ command: 'STOP_ALARM' });
                    }
                    return tab.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(e.notification.data.url || '/');
        })
    );
});
