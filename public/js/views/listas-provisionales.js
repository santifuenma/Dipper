// PANTALLAS PROVISIONALES del paso 3: listas para llegar a las tarjetas y categorías.
// En el paso 4 las sustituyen el carrusel de tarjetas y los mosaicos de categoría del Inicio.
import { api } from "../api.js";
import { html, ICON } from "../dom.js";
import { cardFg, categoryIcon } from "../icons.js";

function shell(title, addHref, addLabel) {
  return html(`
    <div class="screen">
      <div class="topbar">
        <a href="#/" data-back class="icon-btn" aria-label="Volver">${ICON.back}</a>
        <span style="font-size:20px;font-weight:800;letter-spacing:-.3px">${title}</span>
        <span style="width:44px"></span>
      </div>
      <div data-list style="margin-top:8px;display:flex;flex-direction:column;gap:10px"></div>
      <div class="error" role="alert" style="margin-top:10px"></div>
      <a href="${addHref}" style="margin-top:12px;height:64px;box-sizing:border-box;border:1.5px dashed rgba(27,27,31,.35);border-radius:20px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:700" data-press>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        ${addLabel}
      </a>
    </div>
  `);
}

export function renderTarjetas() {
  const el = shell("Tarjetas", "#/tarjeta", "Añadir tarjeta");
  const list = el.querySelector("[data-list]");
  api("/cards")
    .then(({ cards }) => {
      list.replaceChildren(
        ...cards.map((c) => {
          const a = html(`
            <a data-press style="height:96px;box-sizing:border-box;padding:14px;border:1.5px solid rgba(27,27,31,.22);border-radius:20px;display:flex;flex-direction:column;justify-content:space-between">
              <span data-name style="font-size:17px;font-weight:800;letter-spacing:-.2px"></span>
              <span data-last style="font-size:14px;font-weight:600;letter-spacing:1.5px"></span>
            </a>
          `);
          a.href = "#/tarjeta?id=" + c.id;
          a.style.background = c.color;
          a.style.color = cardFg(c.color);
          a.querySelector("[data-name]").textContent = c.name;
          a.querySelector("[data-last]").textContent = "···· " + c.last4 + (c.walletName ? "  ·  " + c.walletName : "");
          return a;
        })
      );
    })
    .catch((err) => (el.querySelector(".error").textContent = err.message));
  return el;
}

export function renderCategorias() {
  const el = shell("Categorías", "#/categoria", "Añadir categoría");
  const list = el.querySelector("[data-list]");
  api("/categories")
    .then(({ categories }) => {
      list.replaceChildren(
        ...categories.map((c) => {
          const a = html(`
            <a data-press class="card-box" style="border-radius:22px;padding:10px 12px;display:flex;align-items:center;gap:12px">
              <span data-ic style="flex:none;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center"></span>
              <span data-name style="flex:1;min-width:0;font-size:16px;font-weight:700"></span>
              <span style="font-size:14px;font-weight:700;text-decoration:underline">Editar</span>
            </a>
          `);
          a.href = "#/categoria?id=" + c.id;
          const ic = a.querySelector("[data-ic]");
          ic.style.background = c.color;
          ic.innerHTML = categoryIcon(c.icon, 20);
          a.querySelector("[data-name]").textContent = c.name;
          return a;
        })
      );
    })
    .catch((err) => (el.querySelector(".error").textContent = err.message));
  return el;
}
