// Ryve FCM Service Worker
// Handles background messaging triggers and action links

importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// Initialize with standard configuration
// Replace placeholders with real values for production deployments
const firebaseConfig = {
  apiKey: "your_firebase_api_key",
  authDomain: "your_project.firebaseapp.com",
  projectId: "your_project_id",
  storageBucket: "your_project.appspot.com",
  messagingSenderId: "your_sender_id",
  appId: "your_app_id"
};

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "your_firebase_api_key") {
  firebase.initializeApp(firebaseConfig);
  
  const messaging = firebase.messaging();
  
  // Handle background notifications
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    
    const notificationTitle = payload.data?.title || payload.notification?.title || 'Ryve Alert';
    const notificationOptions = {
      body: payload.data?.body || payload.notification?.body || 'You have a new update.',
      icon: '/icons/icon-192x192.png',
      badge: '/favicon.svg',
      data: {
        clickAction: payload.data?.clickAction || '/'
      }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} else {
  console.warn('[firebase-messaging-sw.js] Firebase credentials not configured. Background notifications disabled.');
}

// Notification click event handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickAction = event.notification.data?.clickAction || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with the app
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then((focusedClient) => {
            return focusedClient.navigate(clickAction);
          });
        }
      }
      // If not, open a new one
      if (clients.openWindow) {
        return clients.openWindow(clickAction);
      }
    })
  );
});
