self.addEventListener("push", (event) => {
  const data = event.data?.json?.() ?? { title: "NEXORA", body: "You have a new notification." };
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/favicon.ico" }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/notifications"));
});
