// Avisos push de la PWA: registrar el service worker y activar o quitar los avisos en este dispositivo.
import { api } from "./api.js";

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// Registra el service worker (solo hace falta una vez) y le deja mandar la app a una pantalla al tocar un aviso.
// Actualizaciones: el service worker nuevo se instala solo y toma el control, pero esta página sigue con el código
// viejo en memoria. Se recarga en el siguiente cambio de pantalla (nunca a mitad de escribir algo) y, para no esperar
// a que el sistema se acuerde, se busca versión nueva cada vez que se vuelve a la app.
export function startServiceWorker(go) {
  if (!("serviceWorker" in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller; // la primera instalación no cuenta como actualización
  let updated = false;
  navigator.serviceWorker.register("/sw.js").then((reg) => {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") reg.update().catch(() => {});
    });
    reg.update().catch(() => {});
  }).catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) updated = true;
  });
  window.addEventListener("hashchange", () => {
    if (updated) location.reload();
  });
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
