// Firebase Cloud Messaging Service Worker
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js"
);

// This will be replaced at runtime with actual config
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "FIREBASE_CONFIG") {
    try {
      const firebaseConfig = JSON.parse(event.data.config);
      firebase.initializeApp(firebaseConfig);
      const messaging = firebase.messaging();

      // Handle background messages
      messaging.onBackgroundMessage((payload) => {
        console.log("Background message received:", payload);

        const notificationTitle =
          payload.notification?.title ||
          payload.data?.title ||
          "New Notification";
        const notificationOptions = {
          body:
            payload.notification?.body ||
            payload.data?.body ||
            "You have a new message",
          icon: payload.notification?.icon || "/favicon.ico",
          badge: payload.notification?.badge || "/favicon.ico",
          data: payload.data || {},
          requireInteraction: true,
          actions: [
            { action: "open", title: "Open" },
            { action: "close", title: "Close" },
          ],
        };

        return self.registration.showNotification(
          notificationTitle,
          notificationOptions
        );
      });
    } catch (error) {
      console.error("Failed to initialize Firebase in service worker:", error);
    }
  }
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event);
  event.notification.close();

  if (event.action === "close") {
    return;
  }

  const url = event.notification.data?.link || "/dashboard";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("/dashboard") && "focus" in client) {
            return client.focus().then(() => {
              if (event.notification.data?.link) {
                client.navigate(url);
              }
            });
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
