// Pagos de Apple Pay: enlace personal, recepción desde Atajos y pantalla "Por revisar".
import { listCategories } from "./categories.js";
import { merchantInfo } from "./merchants.js";
import { json, randomToken, readJson, sha256 } from "./util.js";

// "12,50 €", "€12.50", "1.234,56", "1,234.56", "-3" -> número
export function parseAmount(raw) {
  if (typeof raw === "number") return raw;
  let s = String(raw ?? "").replace(/[^\d.,-]/g, "");
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    const dec = lastComma > lastDot ? "," : ".";
    const thou = dec === "," ? "." : ",";
    s = s.split(thou).join("").replace(dec, ".");
  } else if (lastComma > -1) {
    s = s.replace(",", ".");
  }
  return parseFloat(s);
}

// Saca todos los objetos JSON de un texto: uno solo, una lista, o varios seguidos
// (así llegan los pagos que el atajo tenía guardados en el iPhone sin conexión).
export function parseObjects(text) {
  const t = String(text || "").trim();
  if (!t) return [];
  try {
    const v = JSON.parse(t);
    return (Array.isArray(v) ? v : [v]).filter((o) => o && typeof o === "object");
  } catch {}
  const out = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}" && depth > 0) {
      depth--;
      if (depth === 0) {
        try {
          out.push(JSON.parse(t.slice(start, i + 1)));
        } catch {}
      }
    }
  }
  return out;
}

async function readPayments(request) {
  const type = request.headers.get("content-type") || "";
  const objects = type.includes("form") ? [Object.fromEntries(await request.formData())] : parseObjects(await request.text());
  // La cola del iPhone puede venir como texto dentro de un JSON: {"cola": "{...}\n{...}"}
  const out = [];
  out.fromQueue = false;
  for (const o of objects) {
    const cola = pick(o, "cola", "queue");
    if (cola !== undefined) out.fromQueue = true;
    if (typeof cola === "string") out.push(...parseObjects(cola));
    else if (cola && typeof cola === "object") out.push(...(Array.isArray(cola) ? cola : [cola]));
    else out.push(o);
  }
  return out;
}

// Busca un campo sin importar mayúsculas: Atajos puede mandar "Importe" o "importe".
function pick(body, ...names) {
  for (const key of Object.keys(body)) {
    if (names.includes(key.toLowerCase())) return body[key];
  }
  return undefined;
}

function matchCard(cards, walletCard) {
  if (!walletCard) return null;
  const w = walletCard.toLowerCase();
  return (
    cards.find((c) => c.wallet_name && c.wallet_name.toLowerCase() === w) ||
    cards.find((c) => c.last4 && w.includes(c.last4)) ||
    null
  );
}

export async function ingest(request, env, token) {
  if (request.method !== "POST") return json({ error: "Usa POST." }, 405);
  if (!token || !token.startsWith("dpr_")) return json({ error: "Enlace no válido." }, 401);
  const user = await env.DB.prepare("SELECT id FROM users WHERE ingest_token = ?").bind(token).first();
  if (!user) return json({ error: "Enlace no válido." }, 401);

  const all = await readPayments(request);
  const payments = all.slice(0, 200);
  console.log("ingest", { contentType: request.headers.get("content-type"), objetos: payments.length });
  const { results: cards } = await env.DB.prepare("SELECT id, wallet_name, last4 FROM cards WHERE user_id = ?").bind(user.id).all();
  let received = 0;
  let added = 0;

  for (const body of payments) {
    const amountRaw = pick(body, "importe", "amount", "cantidad");
    const amount = parseAmount(amountRaw);
    if (!Number.isFinite(amount) || amount === 0) continue;
    received++;

    const raw = String(pick(body, "comercio", "merchant") ?? "").trim().slice(0, 120) || "Desconocido";
    const walletCard = String(pick(body, "tarjeta", "card") ?? "").trim().slice(0, 80);
    const fecha = pick(body, "fecha", "date");
    let date = new Date(fecha || Date.now());
    if (Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 86400000) date = new Date();
    // Con fecha, el mismo pago reenviado (p. ej. desde la cola sin conexión) no se duplica.
    const key = fecha ? await sha256([fecha, amountRaw, raw, walletCard].join("|")) : null;

    const m = merchantInfo(raw);
    const card = matchCard(cards, walletCard);
    const rule = await env.DB.prepare("SELECT category_id FROM merchant_rules WHERE user_id = ? AND merchant_key = ?")
      .bind(user.id, m.key)
      .first();

    const res = await env.DB.prepare(
      `INSERT OR IGNORE INTO charges (user_id, amount_cents, merchant_raw, merchant_key, merchant_name, card_id, wallet_card,
         category_id, status, source, occurred_at, created_at, ingest_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'applepay', ?, ?, ?)`
    )
      .bind(
        user.id,
        Math.round(amount * 100),
        raw,
        m.key,
        m.name,
        card ? card.id : null,
        walletCard || null,
        rule ? rule.category_id : null,
        rule ? "done" : "pending",
        date.getTime(),
        Date.now(),
        key
      )
      .run();
    added += res.meta.changes;
  }

  // Una cola vacía (envío nocturno sin pagos pendientes) no es un error.
  if (!received && all.fromQueue) return json({ ok: true, recibidos: 0, nuevos: 0 });
  if (!received) return json({ error: "Falta el importe." }, 400);
  return json({ ok: true, recibidos: received, nuevos: added }, 201);
}

async function applePayLink(env, url, user) {
  let row = await env.DB.prepare("SELECT ingest_token FROM users WHERE id = ?").bind(user.id).first();
  let token = row && row.ingest_token;
  if (!token) {
    token = "dpr_" + randomToken(18);
    await env.DB.prepare("UPDATE users SET ingest_token = ? WHERE id = ?").bind(token, user.id).run();
  }
  return json({ link: `${url.origin}/api/ingest/${token}`, token });
}

async function pending(env, user) {
  const categories = await listCategories(env, user.id);
  const { results } = await env.DB.prepare(
    `SELECT ch.id, ch.amount_cents, ch.merchant_raw, ch.merchant_name, ch.wallet_card, ch.occurred_at,
            ca.name AS card_name, ca.last4 AS card_last4, ca.color AS card_color
     FROM charges ch LEFT JOIN cards ca ON ca.id = ch.card_id
     WHERE ch.user_id = ? AND ch.status = 'pending'
     ORDER BY ch.occurred_at DESC`
  )
    .bind(user.id)
    .all();

  const items = results.map((r) => {
    const slug = merchantInfo(r.merchant_raw).slug;
    const sug = slug ? categories.find((c) => c.icon === slug) : null;
    return {
      id: r.id,
      amountCents: r.amount_cents,
      merchantRaw: r.merchant_raw,
      merchant: r.merchant_name,
      occurredAt: r.occurred_at,
      card: r.card_name ? { name: r.card_name, last4: r.card_last4, color: r.card_color } : null,
      walletCard: r.wallet_card,
      suggestedCategoryId: sug ? sug.id : null,
    };
  });
  return json({ items, categories });
}

async function confirm(request, env, user, id) {
  const { categoryId, remember } = await readJson(request);
  const charge = await env.DB.prepare("SELECT id, merchant_key FROM charges WHERE id = ? AND user_id = ? AND status = 'pending'")
    .bind(id, user.id)
    .first();
  if (!charge) return json({ error: "Ese pago ya no está pendiente." }, 404);
  const cat = await env.DB.prepare("SELECT id FROM categories WHERE id = ? AND user_id = ?").bind(Number.isInteger(categoryId) ? categoryId : -1, user.id).first();
  if (!cat) return json({ error: "Elige una categoría." }, 400);

  await env.DB.prepare("UPDATE charges SET status = 'done', category_id = ? WHERE id = ?").bind(cat.id, charge.id).run();

  let appliedIds = [];
  if (remember) {
    await env.DB.prepare("INSERT OR REPLACE INTO merchant_rules (user_id, merchant_key, category_id, created_at) VALUES (?, ?, ?, ?)")
      .bind(user.id, charge.merchant_key, cat.id, Date.now())
      .run();
    // Los otros pagos pendientes del mismo comercio se colocan solos.
    const { results } = await env.DB.prepare(
      "UPDATE charges SET status = 'done', category_id = ? WHERE user_id = ? AND status = 'pending' AND merchant_key = ? RETURNING id"
    )
      .bind(cat.id, user.id, charge.merchant_key)
      .all();
    appliedIds = results.map((r) => r.id);
  }
  return json({ ok: true, appliedIds });
}

async function undo(request, env, user, id) {
  const { forgetRule, appliedIds } = await readJson(request);
  const charge = await env.DB.prepare("SELECT id, merchant_key, category_id FROM charges WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first();
  if (!charge) return json({ error: "No encontrado." }, 404);

  const ids = [charge.id, ...(Array.isArray(appliedIds) ? appliedIds.filter(Number.isInteger) : [])];
  const marks = ids.map(() => "?").join(",");
  await env.DB.prepare(
    `UPDATE charges SET status = 'pending', category_id = NULL WHERE user_id = ? AND merchant_key = ? AND id IN (${marks})`
  )
    .bind(user.id, charge.merchant_key, ...ids)
    .run();
  if (forgetRule) {
    await env.DB.prepare("DELETE FROM merchant_rules WHERE user_id = ? AND merchant_key = ? AND category_id = ?")
      .bind(user.id, charge.merchant_key, charge.category_id)
      .run();
  }
  return json({ ok: true });
}

async function pendingCount(env, user) {
  const { c } = await env.DB.prepare("SELECT COUNT(*) AS c FROM charges WHERE user_id = ? AND status = 'pending'").bind(user.id).first();
  return json({ count: c });
}

export async function handlePayments(request, env, url, user) {
  const p = url.pathname;
  const m = request.method;
  if (m === "GET" && p === "/api/applepay") return applePayLink(env, url, user);
  if (m === "GET" && p === "/api/pending") return pending(env, user);
  if (m === "GET" && p === "/api/pending/count") return pendingCount(env, user);
  const match = p.match(/^\/api\/pending\/(\d+)\/(confirm|undo)$/);
  if (match && m === "POST") {
    const id = Number(match[1]);
    return match[2] === "confirm" ? confirm(request, env, user, id) : undo(request, env, user, id);
  }
  return null;
}
