// Service Worker for Push Notifications
self.addEventListener("install", (event) => {
  console.log("Service Worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
  event.waitUntil(clients.claim());
});

// Handle push notifications
self.addEventListener("push", (event) => {
  console.log("Push notification received", event);

  let notificationData = {
    title: "New Notification",
    body: "You have a new message",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: {},
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || data.notification?.title || notificationData.title,
        body: data.body || data.notification?.body || notificationData.body,
        icon: data.icon || data.notification?.icon || notificationData.icon,
        badge: data.badge || data.notification?.badge || notificationData.badge,
        data: data.data || {},
      };
    } catch (e) {
      console.error("Error parsing push data:", e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data,
      requireInteraction: true,
      actions: [
        {
          action: "open",
          title: "Open",
        },
        {
          action: "close",
          title: "Close",
        },
      ],
    })
  );
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked", event);
  event.notification.close();

  if (event.action === "close") {
    return;
  }

  // Open the app or focus existing window
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const url = event.notification.data?.link || "/dashboard";

        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes("/dashboard") && "focus" in client) {
            return client.focus().then(() => {
              if (event.notification.data?.link) {
                client.navigate(url);
              }
            });
          }
        }

        // No window open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Handle background sync for offline messages
self.addEventListener("sync", (event) => {
  console.log("Background sync triggered", event);

  if (event.tag === "sync-messages") {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  try {
    // Fetch pending messages when back online
    const response = await fetch("/api/sync-messages", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const messages = await response.json();

      // Show notifications for unread messages
      for (const message of messages) {
        await self.registration.showNotification(message.title, {
          body: message.body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          data: message.data,
        });
      }
    }
  } catch (error) {
    console.error("Error syncing messages:", error);
  }
}
