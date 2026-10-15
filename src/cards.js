// Tarjetas: crear, editar, borrar. Se reconocen en los pagos por el nombre de Wallet o los 4 últimos dígitos.
import { json, readJson } from "./util.js";

const COLORS = ["#FF6B4A", "#FFC93C", "#3F5BFF", "#1B1B1F", "#7A4DF5", "#6FE0AA"];

function validate(body) {
  const name = String(body.name || "").trim().slice(0, 22);
  const last4 = String(body.last4 || "").replace(/\D/g, "");
  const walletName = String(body.walletName || "").trim().slice(0, 80) || null;
  const color = COLORS.includes(body.color) ? body.color : null;
  if (!name) return { error: "Ponle un nombre a la tarjeta." };
  if (last4.length !== 4) return { error: "Escribe los 4 últimos dígitos." };
  if (!color) return { error: "Elige un color." };
  return { name, last4, walletName, color };
}

// Asigna a esta tarjeta los pagos que llegaron sin tarjeta reconocida.
async function relink(env, userId, card) {
  // Si ya hay otra tarjeta con el mismo nombre de Wallet, sus pagos pendientes pasan a preguntar la tarjeta.
  if (card.walletName) {
    await env.DB.prepare(
      `UPDATE charges SET card_check = 1 WHERE user_id = ? AND status = 'pending' AND LOWER(wallet_card) = LOWER(?)
         AND (SELECT COUNT(*) FROM cards c WHERE c.user_id = ? AND LOWER(c.wallet_name) = LOWER(?)) > 1`
    )
      .bind(userId, card.walletName, userId, card.walletName)
      .run();
  }
  const { results } = await env.DB.prepare(
    "SELECT id, wallet_card FROM charges WHERE user_id = ? AND card_id IS NULL AND wallet_card IS NOT NULL AND card_check = 0"
  )
    .bind(userId)
    .all();
  const w = card.walletName ? card.walletName.toLowerCase() : null;
  const ids = results
    .filter((r) => {
      const wc = r.wallet_card.toLowerCase();
      return (w && wc === w) || wc.includes(card.last4);
    })
    .map((r) => r.id);
  if (!ids.length) return;
  await env.DB.prepare(`UPDATE charges SET card_id = ? WHERE id IN (${ids.map(() => "?").join(",")})`)
    .bind(card.id, ...ids)
    .run();
}

async function list(env, user) {
  const { results: cards } = await env.DB.prepare(
    "SELECT id, name, last4, wallet_name AS walletName, color FROM cards WHERE user_id = ? ORDER BY id"
  )
    .bind(user.id)
    .all();
  // Nombres de tarjeta que ya han llegado en pagos, para elegirlos con un toque.
  const { results: seen } = await env.DB.prepare(
    "SELECT wallet_card AS name, MAX(occurred_at) AS last FROM charges WHERE user_id = ? AND wallet_card IS NOT NULL GROUP BY wallet_card ORDER BY last DESC LIMIT 12"
  )
    .bind(user.id)
    .all();
  return json({ cards, walletNames: seen.map((s) => s.name) });
}

async function create(request, env, user) {
  const v = validate(await readJson(request));
  if (v.error) return json({ error: v.error }, 400);
  const res = await env.DB.prepare(
    "INSERT INTO cards (user_id, name, last4, wallet_name, color, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(user.id, v.name, v.last4, v.walletName, v.color, Date.now())
    .run();
  const card = { id: res.meta.last_row_id, ...v };
  await relink(env, user.id, card);
  return json({ card }, 201);
}

async function update(request, env, user, id) {
  const v = validate(await readJson(request));
  if (v.error) return json({ error: v.error }, 400);
  const res = await env.DB.prepare("UPDATE cards SET name = ?, last4 = ?, wallet_name = ?, color = ? WHERE id = ? AND user_id = ?")
    .bind(v.name, v.last4, v.walletName, v.color, id, user.id)
    .run();
  if (!res.meta.changes) return json({ error: "Esa tarjeta ya no existe." }, 404);
  const card = { id, ...v };
  await relink(env, user.id, card);
  return json({ card });
}

async function remove(env, user, id) {
  // Los pagos se conservan; solo pierden la tarjeta.
  await env.DB.prepare("UPDATE charges SET card_id = NULL WHERE card_id = ? AND user_id = ?").bind(id, user.id).run();
  const res = await env.DB.prepare("DELETE FROM cards WHERE id = ? AND user_id = ?").bind(id, user.id).run();
  if (!res.meta.changes) return json({ error: "Esa tarjeta ya no existe." }, 404);
  return json({ ok: true });
}

export async function handleCards(request, env, url, user) {
  const p = url.pathname;
  const m = request.method;
  if (p === "/api/cards" && m === "GET") return list(env, user);
  if (p === "/api/cards" && m === "POST") return create(request, env, user);
  const match = p.match(/^\/api\/cards\/(\d+)(\/delete)?$/);
  if (match && m === "POST") {
    const id = Number(match[1]);
    return match[2] ? remove(env, user, id) : update(request, env, user, id);
  }
  return null;
}
