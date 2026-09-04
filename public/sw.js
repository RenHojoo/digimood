const CACHE_NAME = "digimood-cache-v3";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./icon.png",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const response = await fetch(event.request);
        if (
          response.ok &&
          (url.pathname.includes("/assets/") ||
            url.pathname.endsWith(".js") ||
            url.pathname.endsWith(".css") ||
            url.pathname.endsWith(".png") ||
            url.pathname.endsWith(".jpg") ||
            url.pathname.endsWith(".svg") ||
            url.pathname.endsWith(".woff2") ||
            url.pathname.endsWith(".json") ||
            url.pathname.endsWith(".html"))
        ) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        const fallback = await cache.match("./index.html");
        return fallback || new Response("Offline", { status: 503 });
      }
    })
  );
});
