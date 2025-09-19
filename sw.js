const CACHE_NAME = 'schedule-app-v2'; // Оновив версію кешу
const urlsToCache = [
    '/',
    'index.html',
    'style.css',
    'script.js',
    'icon.png',
    'manifest.json'
];

// Інсталяція Service Worker та кешування основних ресурсів
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache');
            return cache.addAll(urlsToCache);
        })
    );
});

// Активація Service Worker та очищення старого кешу
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Перехоплення запитів та повернення відповіді з кешу або мережі
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Якщо ресурс є в кеші, повернути його. Інакше - запит до мережі.
            return response || fetch(event.request);
        })
    );
});
