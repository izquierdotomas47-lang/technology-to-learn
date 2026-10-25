const CACHE = 'ttl-ultimate-v81';

const FILES = [
    './',
    './index.html',
    './css/estilos.css?v=80',
    './js/app.js',
    './manifest.json',
    './assets/cosmo.jpg',
    './assets/alien.svg'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(FILES))
            .catch(err => console.warn('Precache incompleto:', err))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then(keys => Promise.all(
                keys.filter(key => key !== CACHE).map(key => caches.delete(key))
            ))
        ])
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    // Never intercept YouTube embeds or any other cross-origin request
    try {
        if (new URL(request.url).origin !== self.location.origin) return;
    } catch {
        return;
    }
    if (request.headers && request.headers.has('range')) return;

    // HTML must refresh so configuration changes, such as the Google Client ID, arrive immediately.
    if (request.mode === 'navigate' || request.url.endsWith('/index.html')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response?.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
                    return response;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    // Keep source files fresh in Live Server and deployed sessions, with cache as offline fallback.
    const pathname = new URL(request.url).pathname;
    if (/\.(?:css|js)$/.test(pathname)) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response?.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) return cached;

            return fetch(request).then(response => {
                // Cache only valid same-origin responses (never error pages)
                if (response && response.ok && response.type === 'basic') {
                    const copy = response.clone();
                    caches.open(CACHE).then(cache => cache.put(request, copy));
                }
                return response;
            }).catch(() => {
                // Offline fallback for navigation requests
                if (request.mode === 'navigate') return caches.match('./index.html');
                return Response.error();
            });
        })
    );
});
