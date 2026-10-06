// Round 32: offline support for the staff counter page only (registered with
// scope "/counter"). Keeps a copy of the /counter page and the app's static
// files so the page still opens when the Wi-Fi is down. API calls are never
// cached here -- the page itself keeps unsent orders in the tablet's storage
// and sends them when the connection returns.
const CACHE = "tan90-counter-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("tan90-counter-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // The counter page itself: always try the network first (fresh menu and
  // orders), fall back to the last copy when offline.
  if (req.mode === "navigate" && url.pathname.startsWith("/counter")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("/counter", copy));
          }
          return res;
        })
        .catch(() => caches.match("/counter").then((hit) => hit || Response.error()))
    );
    return;
  }

  // Build files never change once published, so a cached copy is safe.
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/logo.png") {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
