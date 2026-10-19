// Pantalla "Categorías" (Ajustes › Categorías): tocar una la edita; deslizarla deja ver Editar y Borrar.
import { api } from "../api.js";
import { html, ICON } from "../dom.js";
import { categoryIcon } from "../icons.js";
import { listScreen, swipeList, swipeRow } from "../components.js";

// Categorías: igual que Tarjetas. Al borrar una, sus pagos vuelven a Por revisar.
export function renderCategorias() {
  const el = listScreen("Categorías", "#/categoria", "Añadir categoría");
  const list = el.querySelector("[data-list]");
  const error = el.querySelector(".error");
  const rows = swipeList(el, list);
  api("/categories")
    .then(({ categories }) => {
      rows.push(...categories.map((c) => {
        const a = html(`
          <a data-press class="card-box" style="padding:10px 12px;display:flex;align-items:center;gap:12px">
            <span data-ic class="ic-circle"></span>
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
