// Presupuesto: total del mes y reparto por categoría (se aplica a todos los meses).
import { json, readJson } from "./util.js";

const MAX = 100000000; // 1.000.000 €

async function save(request, env, user) {
  const { monthlyBudgetCents, categories } = await readJson(request);
  const monthly = Math.round(Number(monthlyBudgetCents));
  if (!Number.isFinite(monthly) || monthly < 0 || monthly > MAX) return json({ error: "Ese total no es válido." }, 400);
  if (!Array.isArray(categories)) return json({ error: "Faltan las categorías." }, 400);

  const stmts = [env.DB.prepare("UPDATE users SET monthly_budget_cents = ? WHERE id = ?").bind(monthly, user.id)];
  for (const c of categories) {
    const cents = Math.round(Number(c.budgetCents));
    if (!Number.isInteger(c.id) || !Number.isFinite(cents) || cents < 0 || cents > MAX) {
      return json({ error: "Algún importe no es válido." }, 400);
    }
    stmts.push(env.DB.prepare("UPDATE categories SET budget_cents = ? WHERE id = ? AND user_id = ?").bind(cents, c.id, user.id));
  }
  await env.DB.batch(stmts);
  return json({ ok: true });
}

export async function handleBudget(request, env, url, user) {
  if (url.pathname === "/api/budget" && request.method === "POST") return save(request, env, user);
  return null;
}
