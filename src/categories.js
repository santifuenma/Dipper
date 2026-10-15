// Categorías: las 6 por defecto del diseño, editables y borrables, y las que cree el usuario.
import { json, readJson } from "./util.js";

export const DEFAULT_CATEGORIES = [
  { icon: "sup", name: "Súper", color: "#CDF56B", budget_cents: 38000 },
  { icon: "com", name: "Comida fuera", color: "#FFC2A1", budget_cents: 24000 },
  { icon: "tra", name: "Transporte", color: "#A9D8FF", budget_cents: 18000 },
  { icon: "oci", name: "Ocio", color: "#FFA8D2", budget_cents: 15000 },
  { icon: "rop", name: "Ropa", color: "#CDB6FF", budget_cents: 25000 },
  { icon: "sus", name: "Suscripciones", color: "#98EBC6", budget_cents: 20000 },
];

const ICONS = DEFAULT_CATEGORIES.map((c) => c.icon);
const COLORS = DEFAULT_CATEGORIES.map((c) => c.color);

export function seedCategories(env, userId) {
  const now = Date.now();
  const stmt = env.DB.prepare(
    "INSERT INTO categories (user_id, icon, name, color, budget_cents, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  return env.DB.batch(DEFAULT_CATEGORIES.map((c, i) => stmt.bind(userId, c.icon, c.name, c.color, c.budget_cents, i, now)));
}

export async function listCategories(env, userId) {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.icon, c.name, c.color, c.budget_cents AS budgetCents,
            (SELECT COUNT(*) FROM charges ch WHERE ch.category_id = c.id) AS charges
     FROM categories c WHERE c.user_id = ? ORDER BY c.position, c.id`
  )
    .bind(userId)
    .all();
  return results;
}

function validate(body) {
  const name = String(body.name || "").trim().slice(0, 24);
  if (!name) return { error: "Ponle un nombre a la categoría." };
  if (!ICONS.includes(body.icon)) return { error: "Elige un icono." };
  if (!COLORS.includes(body.color)) return { error: "Elige un color." };
  return { name, icon: body.icon, color: body.color };
}

async function create(request, env, user) {
  const v = validate(await readJson(request));
  if (v.error) return json({ error: v.error }, 400);
  const { pos } = await env.DB.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM categories WHERE user_id = ?")
    .bind(user.id)
    .first();
  const res = await env.DB.prepare(
    "INSERT INTO categories (user_id, icon, name, color, budget_cents, position, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)"
  )
    .bind(user.id, v.icon, v.name, v.color, pos, Date.now())
    .run();
  return json({ category: { id: res.meta.last_row_id, ...v } }, 201);
}

async function update(request, env, user, id) {
  const v = validate(await readJson(request));
  if (v.error) return json({ error: v.error }, 400);
  const res = await env.DB.prepare("UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ? AND user_id = ?")
    .bind(v.name, v.icon, v.color, id, user.id)
    .run();
  if (!res.meta.changes) return json({ error: "Esa categoría ya no existe." }, 404);
  return json({ category: { id, ...v } });
}

// Sus pagos vuelven a "Por revisar" y se olvidan los comercios recordados en ella.
async function remove(env, user, id) {
  const cat = await env.DB.prepare("SELECT id FROM categories WHERE id = ? AND user_id = ?").bind(id, user.id).first();
  if (!cat) return json({ error: "Esa categoría ya no existe." }, 404);
  const [moved] = await env.DB.batch([
    env.DB.prepare("UPDATE charges SET status = 'pending', category_id = NULL WHERE category_id = ? AND user_id = ?").bind(id, user.id),
    env.DB.prepare("DELETE FROM merchant_rules WHERE category_id = ? AND user_id = ?").bind(id, user.id),
    env.DB.prepare("DELETE FROM categories WHERE id = ? AND user_id = ?").bind(id, user.id),
  ]);
  return json({ ok: true, movedToPending: moved.meta.changes });
}

export async function handleCategories(request, env, url, user) {
  const p = url.pathname;
  const m = request.method;
  if (p === "/api/categories" && m === "GET") return json({ categories: await listCategories(env, user.id) });
  if (p === "/api/categories" && m === "POST") return create(request, env, user);
  const match = p.match(/^\/api\/categories\/(\d+)(\/delete)?$/);
  if (match && m === "POST") {
    const id = Number(match[1]);
    return match[2] ? remove(env, user, id) : update(request, env, user, id);
  }
  return null;
}
