// Movimientos: datos de un mes (Inicio, tarjeta, categoría, lista) y cambiar o borrar un pago.
import { listCategories } from "./categories.js";
import { normalize } from "./merchants.js";
import { cleanMerchantName, listMerchants, renameMerchantStmts } from "./payments.js";
import { json, readJson } from "./util.js";

const monthKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit" });
export const monthKey = (ts) => monthKeyFmt.format(ts).slice(0, 7); // "2026-10"

const CHARGE_COLS = `ch.id, ch.amount_cents AS amountCents, ch.merchant_name AS merchant, ch.merchant_raw AS merchantRaw,
  ch.card_id AS cardId, ch.wallet_card AS walletCard, ch.category_id AS categoryId, ch.status, ch.source,
  ch.occurred_at AS occurredAt`;

async function month(env, url, user) {
  const m = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") || "") ? url.searchParams.get("month") : monthKey(Date.now());
  const [y, mo] = m.split("-").map(Number);
  // Margen de un día a cada lado; luego se filtra por el mes en hora de Madrid.
  const from = Date.UTC(y, mo - 1, 1) - 86400000;
  const to = Date.UTC(y, mo, 1) + 86400000;
  const { results } = await env.DB.prepare(
    `SELECT ${CHARGE_COLS} FROM charges ch WHERE ch.user_id = ? AND ch.occurred_at >= ? AND ch.occurred_at < ? ORDER BY ch.occurred_at DESC`
  )
    .bind(user.id, from, to)
    .all();
  const charges = results.filter((c) => monthKey(c.occurredAt) === m);

  const { results: cards } = await env.DB.prepare(
    "SELECT id, name, last4, wallet_name AS walletName, color FROM cards WHERE user_id = ? ORDER BY id"
  )
    .bind(user.id)
    .all();
  const categories = await listCategories(env, user.id);
  const u = await env.DB.prepare("SELECT monthly_budget_cents AS b FROM users WHERE id = ?").bind(user.id).first();
  const { c: pendingCount } = await env.DB.prepare("SELECT COUNT(*) AS c FROM charges WHERE user_id = ? AND status = 'pending'")
    .bind(user.id)
    .first();

  return json({ month: m, current: monthKey(Date.now()), charges, cards, categories, monthlyBudgetCents: u.b, pendingCount });
}

async function getOne(env, user, id) {
  const charge = await env.DB.prepare(`SELECT ${CHARGE_COLS} FROM charges ch WHERE ch.id = ? AND ch.user_id = ?`).bind(id, user.id).first();
  if (!charge) return json({ error: "Ese pago ya no existe." }, 404);
  const { results: cards } = await env.DB.prepare("SELECT id, name, last4, color FROM cards WHERE user_id = ? ORDER BY id")
    .bind(user.id)
    .all();
  const card = cards.find((k) => k.id === charge.cardId) || null;
  return json({ charge, card, cards, categories: await listCategories(env, user.id), merchants: await listMerchants(env, user.id) });
}

// Cambia la categoría, la tarjeta y/o el nombre del comercio de un pago. cardId: null = efectivo u otros.
// El nombre se cambia en todos los pagos de ese comercio y se recuerda para los que lleguen.
async function update(request, env, user, id) {
  const body = await readJson(request);
  const charge = await env.DB.prepare("SELECT id, merchant_key FROM charges WHERE id = ? AND user_id = ?").bind(id, user.id).first();
  if (!charge) return json({ error: "Ese pago ya no existe." }, 404);

  const stmts = [];
  if ("merchant" in body) {
    const name = cleanMerchantName(body.merchant);
    if (!name) return json({ error: "Escribe el nombre del comercio." }, 400);
    stmts.push(...renameMerchantStmts(env, user.id, charge.merchant_key, name));
  }
  if ("categoryId" in body) {
    const cat = await env.DB.prepare("SELECT id FROM categories WHERE id = ? AND user_id = ?")
      .bind(Number.isInteger(body.categoryId) ? body.categoryId : -1, user.id)
      .first();
    if (!cat) return json({ error: "Elige una categoría." }, 400);
    stmts.push(env.DB.prepare("UPDATE charges SET category_id = ?, status = 'done' WHERE id = ?").bind(cat.id, id));
  }
  if ("cardId" in body) {
    let cardId = null;
    if (body.cardId !== null) {
      const card = await env.DB.prepare("SELECT id FROM cards WHERE id = ? AND user_id = ?")
        .bind(Number.isInteger(body.cardId) ? body.cardId : -1, user.id)
        .first();
      if (!card) return json({ error: "Esa tarjeta ya no existe." }, 400);
      cardId = card.id;
    }
    stmts.push(env.DB.prepare("UPDATE charges SET card_id = ? WHERE id = ?").bind(cardId, id));
  }
  if (!stmts.length) return json({ error: "No hay nada que cambiar." }, 400);
  await env.DB.batch(stmts);
  return json({ ok: true });
}

// Gasto añadido a mano (efectivo, Bizum, recibos…): entra ya con su categoría.
async function createManual(request, env, user) {
  const { amountCents, merchant, categoryId, cardId, date } = await readJson(request);
  const amount = Math.round(Number(amountCents));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) return json({ error: "Escribe un importe." }, 400);
  const cat = await env.DB.prepare("SELECT id, name FROM categories WHERE id = ? AND user_id = ?").bind(Number.isInteger(categoryId) ? categoryId : -1, user.id).first();
  if (!cat) return json({ error: "Elige una categoría." }, 400);
  let card = null;
  if (cardId) {
    card = await env.DB.prepare("SELECT id FROM cards WHERE id = ? AND user_id = ?").bind(cardId, user.id).first();
    if (!card) return json({ error: "Esa tarjeta ya no existe." }, 400);
  }
  const now = Date.now();
  let when = Number(date) || now;
  if (when > now + 86400000 || when < now - 400 * 86400000) when = now;

  const name = String(merchant || "").trim().slice(0, 80) || cat.name;
  const res = await env.DB.prepare(
    `INSERT INTO charges (user_id, amount_cents, merchant_raw, merchant_key, merchant_name, card_id, wallet_card,
       category_id, status, source, occurred_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'done', 'manual', ?, ?)`
  )
    .bind(user.id, amount, name, normalize(name) || "MANUAL", name, card ? card.id : null, cat.id, when, now)
    .run();
  return json({ id: res.meta.last_row_id }, 201);
}

async function remove(env, user, id) {
  const res = await env.DB.prepare("DELETE FROM charges WHERE id = ? AND user_id = ?").bind(id, user.id).run();
  if (!res.meta.changes) return json({ error: "Ese pago ya no existe." }, 404);
  return json({ ok: true });
}

export async function handleCharges(request, env, url, user) {
  const p = url.pathname;
  const m = request.method;
  if (p === "/api/month" && m === "GET") return month(env, url, user);
  if (p === "/api/charges" && m === "POST") return createManual(request, env, user);
  const match = p.match(/^\/api\/charges\/(\d+)(\/delete)?$/);
  if (!match) return null;
  const id = Number(match[1]);
  if (m === "GET" && !match[2]) return getOne(env, user, id);
  if (m === "POST") return match[2] ? remove(env, user, id) : update(request, env, user, id);
  return null;
}
