// Sun Miles PMS — service worker for Web Push notifications.
// This file must be at the root so its scope covers all pages.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: "Sun Miles PMS", body: event.data?.text() ?? "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? "Sun Miles PMS", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag ?? "alarm",
      data: { url: data.url ?? "/" },
      requireInteraction: true, // stays until dismissed
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        const existing = wins.find((w) => w.url.includes(target));
        if (existing) return existing.focus();
        return clients.openWindow(target);
      })
  );
});
