// Avisos push de la PWA (Web Push con VAPID). El aviso va "vacío": al recibirlo, el service worker
// (public/sw.js) pide a la API qué pagos hay por revisar y muestra la notificación. Así no hace falta
// cifrar el contenido y los datos no pasan por Apple.
import { b64url, enc, json, readJson } from "./util.js";

const MAX_PER_USER = 10;
// Solo se envía a los servicios de push de los navegadores (la dirección la manda el cliente).
const PUSH_HOSTS = [/(^|\.)push\.apple\.com$/, /^fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/];

export const pushConfigured = (env) => !!(env.VAPID_PUBLIC && env.VAPID_PRIVATE);

function validEndpoint(endpoint) {
  if (typeof endpoint !== "string" || endpoint.length > 600) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

// Cabecera Authorization de VAPID: un JWT firmado con la clave privada del servidor (ES256).
export async function vapidHeader(env, endpoint, subject, now = Date.now()) {
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey("jwk", JSON.parse(env.VAPID_PRIVATE), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${body}`));
  return `vapid t=${header}.${body}.${b64url(sig)}, k=${env.VAPID_PUBLIC}`;
}

// Avisa a todos los dispositivos del usuario. Las suscripciones caducadas (404/410) se borran.
export async function notifyUser(env, userId, subject) {
  if (!pushConfigured(env)) return 0;
  const { results } = await env.DB.prepare("SELECT endpoint FROM push_subscriptions WHERE user_id = ?").bind(userId).all();
  let sent = 0;
  await Promise.allSettled(
    results.map(async ({ endpoint }) => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: await vapidHeader(env, endpoint, subject), TTL: "3600", Urgency: "high", "Content-Length": "0" },
        });
        if (res.status === 404 || res.status === 410) {
          await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint).run();
        } else if (res.ok) sent++;
        else console.log("push", res.status);
      } catch (err) {
        console.log("push error", String(err));
      }
    })
  );
  return sent;
}

export async function handlePush(request, env, url, user) {
  const p = url.pathname;
  const m = request.method;
  if (!p.startsWith("/api/push/")) return null;
  if (m === "GET" && p === "/api/push/key") {
    // test: solo el entorno de pruebas enseña el botón "Enviar aviso de prueba".
    return pushConfigured(env)
      ? json({ key: env.VAPID_PUBLIC, test: env.AVISO_PRUEBA === "si" })
      : json({ error: "Los avisos no están configurados en este servidor." }, 503);
  }
  if (m !== "POST") return null;

  if (p === "/api/push/subscribe") {
    const { endpoint, keys } = await readJson(request);
    if (!validEndpoint(endpoint)) return json({ error: "Este dispositivo no admite avisos." }, 400);
    await env.DB.batch([
      env.DB.prepare("INSERT OR REPLACE INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)").bind(
        endpoint,
        user.id,
        keys && typeof keys.p256dh === "string" ? keys.p256dh.slice(0, 200) : null,
        keys && typeof keys.auth === "string" ? keys.auth.slice(0, 100) : null,
        Date.now()
      ),
      // Máximo de dispositivos por usuario: se van los más antiguos.
      env.DB.prepare(
        `DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint NOT IN
           (SELECT endpoint FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT ${MAX_PER_USER})`
      ).bind(user.id, user.id),
    ]);
    return json({ ok: true }, 201);
  }
  if (p === "/api/push/unsubscribe") {
    const { endpoint } = await readJson(request);
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?").bind(user.id, String(endpoint || "")).run();
    return json({ ok: true });
  }
  if (p === "/api/push/test") {
    if (env.AVISO_PRUEBA !== "si") return json({ error: "No encontrado." }, 404);
    if (!pushConfigured(env)) return json({ error: "Los avisos no están configurados en este servidor." }, 503);
    return json({ ok: true, sent: await notifyUser(env, user.id, url.origin) });
  }
  return null;
}
