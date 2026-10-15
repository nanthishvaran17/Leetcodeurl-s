// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// Must match the config in your firebase.ts exactly
const firebaseConfig = {
  apiKey: "AIzaSyAsP9hOeAxrIO5hbmlrPhmGa3p1vv-1Jek",
  authDomain: "leetcode-student-data.firebaseapp.com",
  projectId: "leetcode-student-data",
  storageBucket: "leetcode-student-data.firebasestorage.app",
  messagingSenderId: "384483144435",
  appId: "1:384483144435:web:bcc3284e79ed3ac5323d86",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'LeetCode Intelligence Alert';
  const notificationBody = payload.notification?.body || payload.data?.body || payload.data?.message || 'New update received.';
  
  const notificationOptions = {
    body: notificationBody,
    icon: '/nec_25_logo.png',
    badge: '/nec_25_logo.png',
    vibrate: [200, 100, 200, 100, 200], // Phone vibration pattern (like WhatsApp/SMS)
    requireInteraction: true,           // Keeps notification visible on lock screen/desktop
    silent: false,                      // Ensures audio chime & vibration trigger
    data: {
      url: payload.data?.action_route || payload.data?.actionRoute || payload.fcmOptions?.link || '/',
    },
    tag: payload.data?.notificationId || payload.data?.tag || ('notif_' + Date.now()),
    renotify: true,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click (Deep linking)
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
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

  const targetUrl = notificationData.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
