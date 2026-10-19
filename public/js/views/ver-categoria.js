// Pantalla "Tap en categoría" (Categoria.dc.html). El botón de arriba abre "Editar categoría".
import { api } from "../api.js";
import { emptyNote, fitMovements, movementGroups, seeAllLink } from "../components.js";
import { html, ICON } from "../dom.js";
import { euros, eurosInt, monthLabel } from "../format.js";
import { categoryIcon } from "../icons.js";
import { view } from "./inicio.js";

const CLOCK =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B1B1F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;margin-top:1px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

export function renderVerCategoria(params) {
  const id = Number(params.get("id"));
  const el = html(`
    <div class="screen" style="padding-bottom:0">
      <div class="topbar">
        <a href="#/" data-back class="icon-btn" aria-label="Volver">${ICON.back}</a>
        <span data-title style="font-size:20px;font-weight:800;letter-spacing:-.3px"></span>
        <a href="#/categoria?id=${id}" data-press aria-label="Editar categoría" class="round-btn">${ICON.edit}</a>
      </div>
      <div data-body style="padding:8px 0 max(16px, env(safe-area-inset-bottom))"></div>
      <div class="error" role="alert"></div>
    </div>
  `);
  const body = el.querySelector("[data-body]");

  api(`/month?month=${view.month || ""}&categoria=${id}`)
    .then((data) => {
      const cat = data.categories.find((c) => c.id === id);
      if (!cat) {
        el.querySelector(".error").textContent = "Esa categoría ya no existe.";
        return;
      }
      el.querySelector("[data-title]").textContent = cat.name;
      const mine = data.charges; // ya vienen solo los de esta categoría
      const spent = cat.spentCents;
      const budget = cat.budgetCents;
      const left = cat.leftCents;
      const isCurrent = data.month === data.current;

      const top = html(`
        <div>
          <div style="position:relative;overflow:hidden;width:100%;height:164px;box-sizing:border-box;border:1.5px solid rgba(27,27,31,.22);border-radius:28px;background:#fff">
            <div data-fill class="fill"></div>
            <div style="position:relative;z-index:2;height:100%;box-sizing:border-box;padding:14px 18px;display:flex;flex-direction:column;justify-content:space-between">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <span data-ic></span>
                <span data-pill hidden style="font-size:14px;font-weight:700;padding:5px 12px;border-radius:99px;background:#1B1B1F;color:#fff"></span>
              </div>
              <div>
                <div style="display:flex;align-items:baseline;gap:8px">
                  <span data-spent style="font-size:64px;font-weight:800;line-height:1;letter-spacing:-2.5px"></span>
                  <span style="font-size:30px;font-weight:700">€</span>
                </div>
                <div data-of style="font-size:16px;font-weight:700"></div>
              </div>
            </div>
          </div>
          <div data-hint hidden style="margin-top:10px;display:flex;gap:10px;align-items:flex-start;padding:11px 14px;border:1.5px dashed rgba(27,27,31,.4);border-radius:20px">
            ${CLOCK}
            <span data-hint-txt style="font-size:16px;font-weight:600;line-height:1.35"></span>
          </div>
          <div data-bycard-wrap>
            <div style="margin-top:16px;font-size:17px;font-weight:800">Por tarjeta</div>
            <div data-bycard style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"></div>
          </div>
          <div style="margin-top:16px;font-size:17px;font-weight:800">Movimientos</div>
        </div>
      `);
      const fill = top.querySelector("[data-fill]");
      fill.style.color = cat.color;
      fill.style.height = (budget > 0 ? Math.min(100, (spent / budget) * 100) : 0) + "%";
      top.querySelector("[data-ic]").innerHTML = categoryIcon(cat.icon, 34, 2);
      top.querySelector("[data-spent]").textContent = eurosInt(spent);
      const monthTxt = isCurrent ? "este mes" : "en " + monthLabel(data.month);
      top.querySelector("[data-of]").textContent = budget > 0 ? `de ${eurosInt(budget)} € ${monthTxt}` : monthTxt;

      if (budget > 0) {
        const pill = top.querySelector("[data-pill]");
        pill.hidden = false;
        pill.textContent = left >= 0 ? `quedan ${eurosInt(left)} €` : `te pasas ${eurosInt(-left)} €`;
      }

      // "Te quedan 18 días. Para llegar a fin de mes, tocan unos 3,80 € al día."
      if (isCurrent && budget > 0) {
        const hint = top.querySelector("[data-hint]");
        const txt = top.querySelector("[data-hint-txt]");
        const days = data.daysLeft;
        hint.hidden = false;
        if (left <= 0) {
          txt.textContent = `Te has pasado ${eurosInt(-left)} € este mes.`;
        } else if (cat.perDayCents === null) {
          txt.textContent = `Último día del mes. Te quedan ${eurosInt(left)} €.`;
        } else {
          txt.append(`Te quedan ${days} ${days === 1 ? "día" : "días"}. Para llegar a fin de mes, tocan unos `);
          const b = document.createElement("b");
          b.style.fontWeight = "800";
          b.textContent = euros(cat.perDayCents) + " al día";
          txt.append(b, ".");
        }
      }

      const byCard = new Map(cat.byCard.map((x) => [x.cardId, x.spentCents]));
      const cardsWith = data.cards.filter((k) => byCard.get(k.id));
      top.querySelector("[data-bycard-wrap]").hidden = cardsWith.length === 0;
      top.querySelector("[data-bycard]").replaceChildren(
        ...cardsWith.map((k) => {
          const chip = html(`
            <span style="display:flex;align-items:center;gap:8px;height:40px;box-sizing:border-box;padding:0 14px 0 10px;border:1.5px solid rgba(27,27,31,.22);border-radius:99px;background:#fff;font-size:15px;font-weight:700">
              <span data-dot aria-hidden="true" style="width:16px;height:16px;border-radius:50%;box-sizing:border-box;border:1.5px solid rgba(27,27,31,.22)"></span>
              <span data-txt></span>
            </span>
          `);
          chip.querySelector("[data-dot]").style.background = k.color;
          chip.querySelector("[data-txt]").textContent = `${k.name} · ${eurosInt(byCard.get(k.id))} €`;
          return chip;
        })
      );

      const groups = mine.length
        ? movementGroups(mine, { cats: data.categories, cards: data.cards, mode: "card" })
        : emptyNote("Todavía no hay pagos en esta categoría este mes.");
      body.replaceChildren(top, groups, ...(mine.length ? [seeAllLink(`#/movimientos?categoria=${id}`)] : []));
      if (mine.length) fitMovements(el, groups);
    })
    .catch((err) => (el.querySelector(".error").textContent = err.message));

  return el;
}
