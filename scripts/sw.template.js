// Service worker de Dipper (plantilla: `npm run build` genera public/sw.js con la versión y la lista de archivos).
// Dos trabajos:
//  1. Velocidad: guarda todos los archivos de la app (HTML, JS, CSS, iconos) y las fuentes, y los sirve desde el
//     dispositivo sin pasar por la red. Cada versión se descarga entera antes de usarse.
//  2. Avisos push: el aviso llega vacío; aquí se pregunta a la API qué pagos hay por revisar (con la sesión de la app).
// La API (/api/) nunca se guarda: los datos siempre vienen del servidor.

const VERSION = "__VERSION__";
const ASSETS = __ASSETS__;
const CACHE = "dipper-app-" + VERSION;
const FONTS = "dipper-fuentes";

self.addEventListener("install", (e) => {
  // "reload": se baja de la red, no de la caché del navegador, para guardar la versión nueva de verdad.
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) {
        if (k.startsWith("dipper-app-") && k !== CACHE) await caches.delete(k);
      }
      await self.clients.claim();
    })()
  )
);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
    // La app es una sola página: cualquier navegación abre el index guardado.
    const key = req.mode === "navigate" ? "/" : req;
    e.respondWith(
      caches
        .open(CACHE)
        .then((c) => c.match(key, { ignoreSearch: true }))
        .then((hit) => hit || fetch(req))
    );
    return;
  }

  // Fuentes de Google: una vez descargadas, siempre del dispositivo.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONTS).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === "opaque") c.put(req, res.clone());
        return res;
      })
    );
  }
});

const euros = (cents) => (Math.abs(cents) / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";

async function pendientes() {
  try {
    const res = await fetch("/api/pending", { credentials: "same-origin" });
    if (res.ok) return (await res.json()).items || [];
  } catch {}
  return null; // sin conexión o sin sesión
}

async function mostrar() {
  const items = await pendientes();
  const n = items ? items.length : 0;
  let title = "Dipper";
  let body = "Tienes pagos por revisar.";
  if (items && n === 0) body = "No tienes pagos por revisar.";
  else if (n === 1) {
    title = `${items[0].merchant} · ${euros(items[0].amountCents)}`;
    body = "¿En qué categoría lo ponemos?";
  } else if (n > 1) {
    title = `${n} pagos por revisar`;
    body = items.slice(0, 3).map((p) => `${p.merchant} ${euros(p.amountCents)}`).join(", ") + (n > 3 ? "…" : "");
  }
  try {
    if (n > 0) await self.navigator.setAppBadge(n);
    else await self.navigator.clearAppBadge();
  } catch {}
  // iOS exige enseñar siempre una notificación por cada aviso.
  await self.registration.showNotification(title, {
    body,
    tag: "pendientes",
    renotify: true,
    icon: "/icon-192.png",
    data: { path: "/por-revisar" },
  });
}

self.addEventListener("push", (e) => e.waitUntil(mostrar()));

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const path = (e.notification.data && e.notification.data.path) || "/";
  e.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (wins.length) {
        const w = wins[0];
        await w.focus();
        w.postMessage({ type: "go", path });
      } else {
        await self.clients.openWindow("/#" + path);
      }
    })()
  );
});
