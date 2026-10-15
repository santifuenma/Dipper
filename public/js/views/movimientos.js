// Pantalla "Movimientos" (nueva, acordada): todos los pagos del mes, opcionalmente de una tarjeta o categoría.
import { api } from "../api.js";
import { emptyNote, movementGroups } from "../components.js";
import { html, ICON } from "../dom.js";
import { euros, monthLabel } from "../format.js";
import { view } from "./inicio.js";

export function renderMovimientos(params) {
  const cardId = Number(params.get("tarjeta")) || null;
  const catId = Number(params.get("categoria")) || null;

  const el = html(`
    <div class="screen" style="padding-bottom:0">
      <div class="topbar">
        <a href="#/" data-back class="icon-btn" aria-label="Volver">${ICON.back}</a>
        <span style="font-size:20px;font-weight:800;letter-spacing:-.3px">Movimientos</span>
        <span data-month style="font-size:13px;font-weight:700;padding:7px 12px;border-radius:99px;background:#fff;border:1.5px solid rgba(27,27,31,.22)"></span>
      </div>
      <div style="padding:8px 0 max(16px, env(safe-area-inset-bottom))">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:0 4px">
          <span data-filter style="font-size:17px;font-weight:800"></span>
          <span data-total style="font-size:17px;font-weight:800;white-space:nowrap"></span>
        </div>
        <div data-list></div>
        <div class="error" role="alert"></div>
      </div>
    </div>
  `);

  api("/month?month=" + (view.month || ""))
    .then((data) => {
      el.querySelector("[data-month]").textContent = monthLabel(data.month);
      let list = data.charges;
      let title = "Todos";
      if (cardId) {
        list = list.filter((c) => c.cardId === cardId);
        const k = data.cards.find((x) => x.id === cardId);
        title = k ? k.name : "Tarjeta";
      }
      if (catId) {
        list = list.filter((c) => c.categoryId === catId);
        const t = data.categories.find((x) => x.id === catId);
        title = t ? t.name : "Categoría";
      }
      el.querySelector("[data-filter]").textContent = `${title} · ${list.length} ${list.length === 1 ? "pago" : "pagos"}`;
      el.querySelector("[data-total]").textContent = euros(list.reduce((a, c) => a + c.amountCents, 0));
      el.querySelector("[data-list]").replaceChildren(
        list.length
          ? movementGroups(list, { cats: data.categories, cards: data.cards, mode: catId ? "card" : "category" })
          : emptyNote("No hay pagos este mes.")
      );
    })
    .catch((err) => (el.querySelector(".error").textContent = err.message));

  return el;
}
