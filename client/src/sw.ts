/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// Precaches the built app shell (JS/CSS/HTML). Anything not in this
// manifest — every /api/* request in particular — is never intercepted
// here, so it just goes straight to the network as normal. This app's
// data (tickets, CRM, chat) must never be served stale from cache.
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

interface PushPayload {
  title: string;
  body: string;
  url: string;
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = { title: 'Apex Portal', body: '', url: '/' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    /* ignore malformed payload */
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const windowClient = client as WindowClient;
        windowClient.navigate(url);
        return windowClient.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
