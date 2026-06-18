// ACL+ service worker. Handles incoming Web Push payloads and routes
// the user to the relevant page when they tap the notification.

self.addEventListener("push", function (event) {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: "ACL+", body: event.data.text() };
  }
  const title = payload.title || "ACL+";
  const options = {
    body: payload.body || "",
    icon: "/logo.png",
    badge: "/logo.png",
    tag: payload.tag || undefined,
    data: { url: payload.url || "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const url = new URL(client.url);
          if (url.pathname === target && "focus" in client) {
            return client.focus();
          }
        } catch {
          // ignore
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
