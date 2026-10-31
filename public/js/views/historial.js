// Pantalla "Historial": los pagos en el orden en que se registraron, con dónde quedaron. Tocar uno abre su Pago.
import { api } from "../api.js";
import { emptyNote, movementGroups } from "../components.js";
import { html, ICON } from "../dom.js";

export function renderHistorial() {
  const el = html(`
    <div class="screen" style="padding-bottom:0">
      <div class="topbar">
        <a href="#/" data-back class="icon-btn" aria-label="Volver">${ICON.back}</a>
        <span class="title">Historial</span>
        <span style="width:44px"></span>
      </div>
      <div style="padding:8px 0 max(16px, env(safe-area-inset-bottom))">
        <div style="margin:0 4px;font-size:13px;font-weight:600;color:#5A5470">Los últimos pagos registrados</div>
        <div data-list></div>
        <div class="error" role="alert"></div>
      </div>
    </div>
  `);

  api("/history")
    .then((data) => {
      el.querySelector("[data-list]").replaceChildren(
        data.charges.length
          ? movementGroups(data.charges, { cats: data.categories, cards: data.cards, mode: "history" })
          : emptyNote("Aún no hay pagos registrados.")
      );
    })
    .catch((err) => (el.querySelector(".error").textContent = err.message));

  return el;
}
