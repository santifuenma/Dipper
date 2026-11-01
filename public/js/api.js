// Llamadas a la API con tres ayudas para que las pantallas se vean al instante:
//  - Una misma consulta que ya va en camino se comparte (no se repite).
//  - swr(): enseña lo último que se sabe y lo actualiza en cuanto llega la respuesta (stale-while-revalidate).
//  - prefetch(): empieza a pedir los datos de una pantalla antes de entrar en ella (al tocar).
// Cualquier cambio (POST) vacía lo guardado, así que nunca se enseña algo anterior a tu propio cambio.

const mem = new Map(); // ruta -> datos
const inflight = new Map(); // ruta -> promesa
const warm = new Set(); // rutas que se piden de nuevo tras cada cambio (la del Inicio)
let gen = 0; // sube con cada cambio: una respuesta anterior al cambio no se guarda

const COLD_KEY = "dipper_cold";
// Del arranque en frío (la app estaba cerrada) solo se guarda el Inicio, para pintarlo antes de que responda el servidor.
const COLD_OK = /^\/month$/;
let coldUsed = false;

function fetchJson(path, body) {
  return fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (res) => {
    let data = {};
    try {
      data = await res.json();
    } catch {}
    if (!res.ok) {
      const err = new Error(data.error || "No hay conexión. Inténtalo de nuevo.");
      err.status = res.status;
      throw err;
    }
    return data;
  });
}

function get(path) {
  let p = inflight.get(path);
  if (!p) {
    const g = gen;
    p = fetchJson(path)
      .then((data) => {
        if (g === gen) store(path, data);
        return data;
      })
      .finally(() => {
        if (inflight.get(path) === p) inflight.delete(path);
      });
    inflight.set(path, p);
  }
  return p;
}

function store(path, data) {
  mem.set(path, data);
  if (COLD_OK.test(path)) {
    try {
      localStorage.setItem(COLD_KEY, JSON.stringify({ path, data }));
    } catch {}
  }
}

function cold(path) {
  if (coldUsed) return null;
  coldUsed = true;
  try {
    const c = JSON.parse(localStorage.getItem(COLD_KEY) || "null");
    return c && c.path === path ? c.data : null;
  } catch {
    return null;
  }
}

function invalidate() {
  gen++;
  mem.clear();
  inflight.clear();
  coldUsed = true;
  for (const path of warm) get(path).catch(() => {});
}

export async function api(path, body) {
  if (body === undefined) return get(path);
  const res = await fetchJson(path, body);
  invalidate();
  return res;
}

// cb(datos, deMemoria): primero con lo que ya se sabe (si hay), luego con lo recién llegado.
// Si ya se enseñó algo y la red falla, no se avisa de error: se queda lo que había.
export function swr(path, cb) {
  const hit = mem.has(path) ? mem.get(path) : cold(path);
  if (hit) cb(hit, true);
  const before = hit ? JSON.stringify(hit) : null;
  return get(path)
    .then((data) => {
      // Si no ha cambiado nada, no se vuelve a pintar (así no se repiten las animaciones).
      if (before === null || JSON.stringify(data) !== before) cb(data, false);
      return data;
    })
    .catch((err) => {
      if (!hit) throw err;
    });
}

// Una sola respuesta (sin repintar después): la que ya se precargó o, si no, la que llegue. Para pantallas con
// estado propio, como Pago, que no pueden recibir datos nuevos mientras se editan.
export function load(path) {
  return mem.has(path) ? Promise.resolve(mem.get(path)) : get(path);
}

export function prefetch(path) {
  if (!mem.has(path)) get(path).catch(() => {});
}

// Ruta que se vuelve a pedir sola después de cada cambio.
export function keepWarm(path) {
  warm.clear();
  warm.add(path);
}

// Al salir de la cuenta no debe quedar nada de ella en el dispositivo.
export function forgetData() {
  gen++;
  mem.clear();
  inflight.clear();
  warm.clear();
  try {
    localStorage.removeItem(COLD_KEY);
  } catch {}
}
