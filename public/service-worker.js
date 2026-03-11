// Service Worker per DMB App - Aggiornamento Automatico
const CACHE_VERSION = 'dmb-v1.0.3';
const CACHE_NAME = `dmb-cache-${CACHE_VERSION}`;

// File da cachare
const urlsToCache = [
  '/',
  '/index.html',
];

// Installazione service worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  // Forza l'attivazione immediata
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(urlsToCache);
    })
  );
});

// Attivazione service worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Elimina tutte le cache vecchie
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Prendi il controllo di tutti i client immediatamente
      return self.clients.claim();
    })
  );
});

// Strategia: Network First, poi Cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clona la risposta
        const responseToCache = response.clone();
        
        // Aggiorna la cache con la nuova risposta
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      })
      .catch(() => {
        // Se la rete fallisce, usa la cache
        return caches.match(event.request);
      })
  );
});

// Messaggio per forzare aggiornamento
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
