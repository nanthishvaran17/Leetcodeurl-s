// Firebase Cloud Messaging Service Worker for Nandha LeetCode Intelligence Platform
// Supports background push notifications, heads-up banners, vibration patterns, and deep link navigation.

importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// Default institutional Firebase credentials
let firebaseConfig = {
  apiKey: "AIzaSyAsP9hOeAxrIO5hbmlrPhmGa3p1vv-1Jek",
  authDomain: "leetcode-student-data.firebaseapp.com",
  projectId: "leetcode-student-data",
  storageBucket: "leetcode-student-data.firebasestorage.app",
  messagingSenderId: "384483144435",
  appId: "1:384483144435:web:bcc3284e79ed3ac5323d86",
};

// Check for dynamic URL query parameters passed during registration
try {
  if (self.location && self.location.search) {
    const urlParams = new URLSearchParams(self.location.search);
    const qApiKey = urlParams.get('apiKey');
    if (qApiKey) {
      firebaseConfig = {
        apiKey: qApiKey,
        authDomain: urlParams.get('authDomain') || firebaseConfig.authDomain,
        projectId: urlParams.get('projectId') || firebaseConfig.projectId,
        storageBucket: urlParams.get('storageBucket') || firebaseConfig.storageBucket,
        messagingSenderId: urlParams.get('messagingSenderId') || firebaseConfig.messagingSenderId,
        appId: urlParams.get('appId') || firebaseConfig.appId,
      };
    }
  }
} catch (e) {
  console.warn('[firebase-messaging-sw.js] Could not parse query params:', e);
}

// Initialize Firebase App in service worker scope
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle Background Push Messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'LeetCode Intelligence Alert';
  const notificationBody = payload.notification?.body || payload.data?.body || payload.data?.message || 'New update received.';
  const actionRoute = payload.data?.actionRoute || payload.data?.action_route || payload.data?.route || payload.fcmOptions?.link || '/dashboard';
  const notificationId = payload.data?.notificationId || payload.data?.tag || ('notif_' + Date.now());

  const notificationOptions = {
    body: notificationBody,
    icon: '/round_logo.png',
    badge: '/favicon-32x32.png',
    vibrate: [200, 100, 200, 100, 200], // Phone vibration pattern
    requireInteraction: true,           // Keeps notification visible on lock screen/desktop
    silent: false,                      // Ensures audio chime & vibration trigger
    actions: [
      { action: 'open', title: '👉 Open Details' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    data: {
      url: actionRoute,
      actionRoute: actionRoute,
      notificationId: notificationId,
      ...payload.data
    },
    tag: notificationId,
    renotify: true,
  };

  if ('setAppBadge' in self.navigator) {
    self.navigator.setAppBadge().catch(() => {});
  }

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click (Deep linking & client window focus)
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  if (event.action === 'dismiss') {
    return;
  }
  const notificationData = event.notification.data || {};

  // Handle downloaded report notification click
  if (notificationData.type === 'DOWNLOAD_COMPLETE') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if ('focus' in client) {
            client.focus();
            client.postMessage({
              type: 'OPEN_DOWNLOADED_FILE',
              payload: notificationData,
            });
            return;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
    return;
  }

  const targetUrl = notificationData.actionRoute || notificationData.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window matching target URL if available
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url && client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Alternatively focus any open application window and post navigate message
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          client.focus();
          if (client.postMessage) {
            client.postMessage({
              type: 'NAVIGATE_TO_ROUTE',
              route: targetUrl,
              data: notificationData
            });
          }
          return;
        }
      }
      // If no window is open, launch a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// PWA Service Worker Core Lifecycle & Caching
const CACHE_NAME = 'nec-leetcode-pwa-v2';
const STATIC_ASSETS = [
  '/',
  '/site.webmanifest',
  '/round_logo.png',
  '/favicon.png',
  '/favicon-32x32.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        );
      }),
    ])
  );
});

// Network-First with Cache Fallback for Static Assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip API calls, web socket connections, and non-http schemes
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws') || !url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200 && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('/');
        });
      })
  );
});
