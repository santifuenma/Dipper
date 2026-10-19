// Pantalla "Tarjetas" (Ajustes › Tarjetas): tocar una la edita; deslizarla deja ver Editar y Borrar.
import { api } from "../api.js";
import { html } from "../dom.js";
import { cardBorder, cardFg } from "../icons.js";
import { listScreen, swipeList, swipeRow } from "../components.js";

// Tarjetas: deslizar una hacia la izquierda deja ver Editar y Borrar (con confirmación).
export function renderTarjetas() {
  const el = listScreen("Tarjetas", "#/tarjeta", "Añadir tarjeta");
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
