// Avisos push de la PWA: registrar el service worker y activar o quitar los avisos en este dispositivo.
import { api } from "./api.js";

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// Registra el service worker (solo hace falta una vez) y le deja mandar la app a una pantalla al tocar un aviso.
export function startServiceWorker(go) {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data && e.data.type === "go" && typeof e.data.path === "string") go(e.data.path);
  });
}

const toBytes = (b64) => {
  const s = b64.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
};

async function current() {
  const reg = await navigator.serviceWorker.ready;
  return { reg, sub: await reg.pushManager.getSubscription() };
}

export async function pushEnabledHere() {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  try {
    return !!(await current()).sub;
  } catch {
    return false;
  }
}

// Hay que llamarla desde un toque del usuario: iOS no deja pedir el permiso de otra forma.
export async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Los avisos están bloqueados. Actívalos en Ajustes de iOS → Dipper → Notificaciones.");
  const { key } = await api("/push/key");
  const { reg, sub: old } = await current();
  const sub = old || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) }));
  await api("/push/subscribe", sub.toJSON());
}

export async function disablePush() {
  const { sub } = await current();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await api("/push/unsubscribe", { endpoint });
}

export const testPush = () => api("/push/test", {});

// Número de pagos por revisar sobre el icono de la app (si el sistema lo permite).
export function setBadge(n) {
  try {
    if (n > 0) navigator.setAppBadge(n);
    else navigator.clearAppBadge();
  } catch {}
}
