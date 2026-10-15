// PANTALLAS PROVISIONALES del paso 3: listas para llegar a las tarjetas y categorías.
// En el paso 4 las sustituyen el carrusel de tarjetas y los mosaicos de categoría del Inicio.
import { api } from "../api.js";
import { html, ICON } from "../dom.js";
import { cardBorder, cardFg, categoryIcon } from "../icons.js";
import { swipeRow } from "../components.js";

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
      <a href="${addHref}" style="margin-top:12px;height:64px;box-sizing:border-box;border:1.5px dashed rgba(27,27,31,.4);border-radius:20px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:700" data-press>
        ${ICON.plus}
        ${addLabel}
      </a>
    </div>
  `);
}

// Filas deslizables: abrir una cierra las demás; tocar fuera de las filas abiertas las cierra.
function swipeList(el, list) {
  const rows = [];
  const openRows = (except) => rows.filter((r) => r !== except && r.isOpen());
  list.addEventListener("swipestart", (e) => openRows(e.target).forEach((r) => r.close()));
  el.addEventListener("click", (e) => openRows(e.target.closest("[data-list] > div")).forEach((r) => r.close()));
  return rows;
}

// Tarjetas: deslizar una hacia la izquierda deja ver Editar y Borrar (con confirmación).
export function renderTarjetas() {
  const el = shell("Tarjetas", "#/tarjeta", "Añadir tarjeta");
  const list = el.querySelector("[data-list]");
  const error = el.querySelector(".error");
  const rows = swipeList(el, list);
  api("/cards")
    .then(({ cards }) => {
      rows.push(...cards.map((c) => {
        const a = html(`
          <a data-press style="height:96px;box-sizing:border-box;padding:14px;border:1.5px solid rgba(27,27,31,.22);border-radius:20px;display:flex;flex-direction:column;justify-content:space-between">
            <span data-name style="font-size:17px;font-weight:800;letter-spacing:-.2px"></span>
            <span data-last style="font-size:14px;font-weight:600;letter-spacing:1.5px"></span>
          </a>
        `);
        a.href = "#/tarjeta?id=" + c.id;
        a.style.background = c.color;
        a.style.color = cardFg(c.color);
        a.style.borderColor = cardBorder(c.color);
        a.querySelector("[data-name]").textContent = c.name;
        a.querySelector("[data-last]").textContent = "···· " + c.last4 + (c.walletName ? "  ·  " + c.walletName : "");
        return swipeRow(a, {
          editHref: "#/tarjeta?id=" + c.id,
          onDelete: () => {
            error.textContent = "";
            return api(`/cards/${c.id}/delete`, {});
          },
          onError: (err) => (error.textContent = err.message),
        });
      }));
      list.replaceChildren(...rows);
    })
    .catch((err) => (error.textContent = err.message));
  return el;
}

// Categorías: igual que Tarjetas. Al borrar una, sus pagos vuelven a Por revisar.
export function renderCategorias() {
  const el = shell("Categorías", "#/categoria", "Añadir categoría");
  const list = el.querySelector("[data-list]");
  const error = el.querySelector(".error");
  const rows = swipeList(el, list);
  api("/categories")
    .then(({ categories }) => {
      rows.push(...categories.map((c) => {
        const a = html(`
          <a data-press class="card-box" style="padding:10px 12px;display:flex;align-items:center;gap:12px">
            <span data-ic style="flex:none;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center"></span>
            <span data-name style="flex:1;min-width:0;font-size:16px;font-weight:700"></span>
            <span style="flex:none;display:flex">${ICON.chevron}</span>
          </a>
        `);
        a.href = "#/categoria?id=" + c.id;
        const ic = a.querySelector("[data-ic]");
        ic.style.background = c.color;
        ic.innerHTML = categoryIcon(c.icon, 20);
        a.querySelector("[data-name]").textContent = c.name;
        return swipeRow(a, {
          editHref: "#/categoria?id=" + c.id,
          onDelete: () => {
            error.textContent = "";
            return api(`/categories/${c.id}/delete`, {});
          },
          onError: (err) => (error.textContent = err.message),
        });
      }));
      list.replaceChildren(...rows);
    })
    .catch((err) => (error.textContent = err.message));
  return el;
}
