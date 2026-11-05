// Bienvenida de las cuentas nuevas: el servidor recuerda en qué paso van (así se retoma en cualquier dispositivo),
// si ya vieron la guía del Inicio y qué les falta por configurar (el recordatorio suave del Inicio).
import { json, readJson } from "./util.js";

export const ONBOARDING_DONE = 8; // pasos 0-7; 8 = terminada

// Lo que enseña el usuario en `user.onboarding`: dónde va y qué mostrar en el Inicio.
export function onboardingOf(u) {
  return {
    step: Number.isInteger(u.onboarding_step) ? u.onboarding_step : ONBOARDING_DONE,
    tour: u.tour_seen === 0,
    reminder: u.reminder_off !== 1,
  };
}

// Qué cosas están ya configuradas. La app decide cómo contarlas; aquí solo se dice si están hechas.
async function checklist(env, userId) {
  const [cards, applepay, push, passkeys] = await env.DB.batch([
    env.DB.prepare("SELECT 1 AS x FROM cards WHERE user_id = ? LIMIT 1").bind(userId),
    env.DB.prepare("SELECT 1 AS x FROM charges WHERE user_id = ? AND source = 'applepay' LIMIT 1").bind(userId),
    env.DB.prepare("SELECT 1 AS x FROM push_subscriptions WHERE user_id = ? LIMIT 1").bind(userId),
    env.DB.prepare("SELECT 1 AS x FROM passkeys WHERE user_id = ? LIMIT 1").bind(userId),
  ]);
  return [
    { id: "tarjeta", done: cards.results.length > 0 },
    { id: "applepay", done: applepay.results.length > 0 },
    { id: "avisos", done: push.results.length > 0 },
    { id: "faceid", done: passkeys.results.length > 0 },
  ];
}

async function get(env, user) {
  const u = await env.DB.prepare("SELECT onboarding_step, tour_seen, reminder_off FROM users WHERE id = ?").bind(user.id).first();
  return json({ ...onboardingOf(u), checklist: await checklist(env, user.id) });
}

// Cambios parciales: { step } | { tourSeen: true } | { reminderOff: true } | { restart: true }.
async function update(request, env, user) {
  const body = await readJson(request);
  const sets = [];
  const args = [];
  if ("step" in body) {
    if (!Number.isInteger(body.step) || body.step < 0 || body.step > ONBOARDING_DONE) return json({ error: "Ese paso no existe." }, 400);
    sets.push("onboarding_step = ?");
    args.push(body.step);
  }
  if (body.tourSeen === true) sets.push("tour_seen = 1");
  if (body.reminderOff === true) sets.push("reminder_off = 1");
  // "Ver la guía otra vez": vuelve al primer paso y a enseñar la guía del Inicio.
  if (body.restart === true) sets.push("onboarding_step = 0", "tour_seen = 0", "reminder_off = 0");
  if (!sets.length) return json({ error: "No hay nada que cambiar." }, 400);
  await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...args, user.id).run();
  return get(env, user);
}

export async function handleOnboarding(request, env, url, user) {
  if (url.pathname !== "/api/onboarding") return null;
  if (request.method === "GET") return get(env, user);
  if (request.method === "POST") return update(request, env, user);
  return null;
}
