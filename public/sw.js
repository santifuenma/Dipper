// Service worker de Dipper: recibe los avisos push y los enseña como notificación.
// El aviso llega vacío; aquí se pregunta a la API qué pagos hay por revisar (con la sesión de la app).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

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
