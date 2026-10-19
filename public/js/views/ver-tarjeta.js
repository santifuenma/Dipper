// Pantalla "Tap en tarjeta" (Tarjeta.dc.html).
import { api } from "../api.js";
import { emptyNote, fitMovements, movementGroups, seeAllLink } from "../components.js";
import { html, ICON, iconSize } from "../dom.js";
import { eurosInt, monthLabel } from "../format.js";
import { cardBorder, cardFg } from "../icons.js";
import { view } from "./inicio.js";


export function renderVerTarjeta(params) {
  const id = Number(params.get("id"));
  const el = html(`
    <div class="screen" style="padding-bottom:0">
      <div class="topbar">
        <a href="#/" data-back class="icon-btn" aria-label="Volver">${ICON.back}</a>
        <span class="title">Tarjeta</span>
        <a href="#/tarjeta?id=${id}" data-press aria-label="Editar tarjeta" class="round-btn">${ICON.edit}</a>
      </div>
      <div data-body style="padding:8px 0 max(16px, env(safe-area-inset-bottom))"></div>
      <div class="error" role="alert"></div>
    </div>
  `);
  const body = el.querySelector("[data-body]");

  api(`/month?month=${view.month || ""}&tarjeta=${id}`)
    .then((data) => {
      const card = data.cards.find((c) => c.id === id);
      if (!card) {
        el.querySelector(".error").textContent = "Esa tarjeta ya no existe.";
        return;
      }
      const mine = data.charges; // ya vienen solo los de esta tarjeta

      const top = html(`
        <div>
          <div class="card-in" data-card style="position:relative;overflow:hidden;width:100%;height:164px;box-sizing:border-box;padding:16px 18px;border:1.5px solid rgba(27,27,31,.22);border-radius:28px;display:flex;flex-direction:column;justify-content:space-between">
            <span aria-hidden="true" style="position:absolute;right:-56px;top:-56px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.28)"></span>
            <span aria-hidden="true" style="position:absolute;left:-40px;bottom:-70px;width:150px;height:150px;border-radius:50%;background:rgba(27,27,31,.07)"></span>
            <span style="position:relative;display:flex;justify-content:space-between;align-items:center">
              <span data-name style="font-size:26px;font-weight:800;letter-spacing:-.5px"></span>
              <span aria-hidden="true" style="display:flex">
                <span style="width:24px;height:24px;box-sizing:border-box;border-radius:50%;border:2.5px solid currentColor"></span>
                <span style="width:24px;height:24px;margin-left:-10px;border-radius:50%;background:currentColor"></span>
              </span>
            </span>
            <span style="position:relative;display:flex;justify-content:space-between;align-items:flex-end">
              <span>
                <span aria-hidden="true" style="display:block;width:36px;height:26px;box-sizing:border-box;border-radius:7px;border:2.5px solid currentColor;margin-bottom:10px"></span>
                <span data-last style="font-size:24px;font-weight:700;letter-spacing:3px"></span>
              </span>
              <span data-ap hidden style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;padding:6px 11px;border-radius:99px;background:#fff;color:#1B1B1F">
                ${iconSize(ICON.check, 14)}
                Apple Pay activo
              </span>
            </span>
          </div>
          <div style="margin-top:14px">
            <div data-label style="font-size:15px;font-weight:600;color:#5A5470"></div>
            <div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap">
              <span data-spent style="font-size:64px;font-weight:800;line-height:1;letter-spacing:-2.5px"></span>
              <span style="font-size:28px;font-weight:700">€</span>
              <span data-pct style="margin-left:8px;font-size:15px;font-weight:700"></span>
            </div>
          </div>
          <div data-tiles-wrap style="margin-top:16px">
            <div style="font-size:17px;font-weight:800">Su parte de cada categoría</div>
            <div data-tiles class="noscroll" style="display:flex;gap:10px;overflow-x:auto;margin:8px -20px 0;padding:2px 20px"></div>
          </div>
          <div style="margin-top:16px;font-size:17px;font-weight:800">Movimientos</div>
        </div>
      `);
      const cardEl = top.querySelector("[data-card]");
      cardEl.style.background = card.color;
      cardEl.style.color = cardFg(card.color);
      cardEl.style.borderColor = cardBorder(card.color);
      top.querySelector("[data-name]").textContent = card.name;
      top.querySelector("[data-last]").textContent = "···· " + card.last4;
      top.querySelector("[data-ap]").hidden = !card.walletName;
      top.querySelector("[data-label]").textContent = "con esta tarjeta en " + monthLabel(data.month);
      top.querySelector("[data-spent]").textContent = eurosInt(card.spentCents);
      top.querySelector("[data-pct]").textContent = card.percentOfTotal + " % de lo gastado";

      const byCat = new Map(card.byCategory.map((x) => [x.categoryId, x.spentCents]));
      const tiles = data.categories.filter((t) => byCat.get(t.id));
      top.querySelector("[data-tiles-wrap]").hidden = tiles.length === 0;
      top.querySelector("[data-tiles]").replaceChildren(
        ...tiles.map((t) => {
          const amount = byCat.get(t.id);
          const tile = html(`
            <div style="flex:none;position:relative;overflow:hidden;width:112px;height:96px;box-sizing:border-box;border:1.5px solid rgba(27,27,31,.22);border-radius:20px;background:#fff">
              <div data-fill class="fill"></div>
              <div style="position:relative;z-index:2;height:100%;box-sizing:border-box;padding:10px 12px;display:flex;flex-direction:column;justify-content:space-between">
                <div data-name style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>
                <div data-amount style="font-size:22px;font-weight:800;letter-spacing:-.5px"></div>
              </div>
            </div>
          `);
          const fill = tile.querySelector("[data-fill]");
          fill.style.color = t.color;
          fill.style.height = (t.budgetCents > 0 ? Math.min(100, (amount / t.budgetCents) * 100) : 100) + "%";
          tile.querySelector("[data-name]").textContent = t.name;
          tile.querySelector("[data-amount]").textContent = eurosInt(amount) + " €";
          return tile;
        })
      );

      const groups = mine.length
        ? movementGroups(mine, { cats: data.categories, cards: data.cards, mode: "category" })
        : emptyNote("Todavía no hay pagos con esta tarjeta este mes.");
      body.replaceChildren(top, groups, ...(mine.length ? [seeAllLink(`#/movimientos?tarjeta=${id}`)] : []));
      if (mine.length) fitMovements(el, groups);
    })
    .catch((err) => (el.querySelector(".error").textContent = err.message));

  return el;
}
