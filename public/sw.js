const SHELL_CACHE = "nexora-shell-v1";
const MEDIA_CACHE = "nexora-commute-media-v1";
const OFFLINE_PAGE = "/offline.html";
const APP_ROOT = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll([OFFLINE_PAGE])).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("nexora-shell-") && key !== SHELL_CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/__nexora_offline__/")) {
    event.respondWith(serveCachedMedia(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && url.pathname === APP_ROOT) {
          const cache = await caches.open(SHELL_CACHE);
          await cache.put(APP_ROOT, response.clone());
        }
        return response;
      } catch {
        const shell = await caches.match(APP_ROOT, { cacheName: SHELL_CACHE });
        if (shell) return shell;
        return (await caches.match(OFFLINE_PAGE, { cacheName: SHELL_CACHE })) ||
          new Response("You are offline. Reconnect to load NEXORA.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname === "/manifest.webmanifest" || url.pathname.endsWith(".svg")) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || new Response("", { status: 504 });
      }
    })());
  }
});

async function serveCachedMedia(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const url = new URL(request.url);
  const cached = await cache.match(new URL(url.pathname, self.location.origin).toString());
  if (!cached) return new Response("This item is not in your offline pack.", { status: 404 });
  const range = request.headers.get("range");
  if (!range) return cached;

  const blob = await cached.blob();
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return new Response(null, { status: 416 });
  const start = match[1] ? Number(match[1]) : Math.max(0, blob.size - Number(match[2]));
  const end = match[2] ? Math.min(Number(match[2]), blob.size - 1) : blob.size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= blob.size) {
    return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + blob.size } });
  }
  const headers = new Headers(cached.headers);
  headers.set("Content-Range", "bytes " + start + "-" + end + "/" + blob.size);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(end - start + 1));
  return new Response(blob.slice(start, end + 1), { status: 206, headers });
}

self.addEventListener("sync", (event) => {
  if (event.tag !== "nexora-outbox-sync") return;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) client.postMessage({ type: "NEXORA_OUTBOX_SYNC" });
  })());
});
