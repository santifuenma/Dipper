// Pantalla "Editar categoría" (nueva, mismo estilo que Nueva tarjeta). Sin ?id= crea una categoría.
import { api } from "../api.js";
import { back } from "../nav.js";
import { busy, html, ICON } from "../dom.js";
import { CATEGORY_COLORS, CATEGORY_ICONS, categoryIcon } from "../icons.js";

export function renderCategoriaForm(params) {
  const id = Number(params.get("id")) || null;
  const st = { name: "", icon: CATEGORY_ICONS[0], color: CATEGORY_COLORS[0], charges: 0, confirmDelete: false };

  const el = html(`
    <div class="screen">
      <div class="topbar">
        <a href="#/" data-back class="icon-btn" aria-label="Volver">${ICON.back}</a>
        <span style="font-size:20px;font-weight:800;letter-spacing:-.3px">${id ? "Editar categoría" : "Nueva categoría"}</span>
        ${id ? `<button type="button" data-delete class="round-btn" aria-label="Borrar categoría">${ICON.trash}</button>` : `<span style="width:44px"></span>`}
      </div>

      <div style="flex:1;min-height:0;padding:8px 0 4px">
        <div style="position:relative;overflow:hidden;width:100%;height:min(164px,16dvh);box-sizing:border-box;border:1.5px solid rgba(27,27,31,.22);border-radius:30px;background:#fff">
          <div data-fill class="fill" style="height:62%"></div>
          <div style="position:relative;z-index:2;height:100%;box-sizing:border-box;padding:14px 18px;display:flex;flex-direction:column;justify-content:space-between">
            <span data-picon></span>
            <span data-pname style="font-size:30px;font-weight:800;letter-spacing:-1px;line-height:1.05"></span>
          </div>
        </div>

        <div data-delete-hint class="hint-danger" style="margin-top:10px"></div>
        <form novalidate style="margin-top:12px;display:flex;flex-direction:column;gap:12px">
          <label style="display:block">
            <span style="display:block;font-size:13px;font-weight:700;color:#5A5470;margin-bottom:6px">Nombre</span>
            <input name="name" type="text" maxlength="24" placeholder="Súper" style="width:100%;height:48px;box-sizing:border-box;padding:0 16px;border:1.5px solid rgba(27,27,31,.22);border-radius:18px;background:#fff;font-size:17px;font-weight:600;color:#1B1B1F">
          </label>
          <div>
            <div style="font-size:13px;font-weight:700;color:#5A5470;margin-bottom:8px">Icono</div>
            <div data-icons style="display:flex;gap:10px;flex-wrap:wrap"></div>
          </div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#5A5470;margin-bottom:8px">Color</div>
            <div data-swatches style="display:flex;gap:10px;flex-wrap:wrap"></div>
          </div>
          <div class="error" role="alert"></div>
        </form>
      </div>

      <button type="button" data-save class="btn btn-lima" style="flex:none;margin-top:10px" disabled>Guardar categoría</button>
    </div>
  `);

  const form = el.querySelector("form");
  const fill = el.querySelector("[data-fill]");
  const picon = el.querySelector("[data-picon]");
  const pname = el.querySelector("[data-pname]");
  const icons = el.querySelector("[data-icons]");
  const swatches = el.querySelector("[data-swatches]");
  const save = el.querySelector("[data-save]");
  const del = el.querySelector("[data-delete]");
  const delHint = el.querySelector("[data-delete-hint]");
  const error = el.querySelector(".error");

  const ring = (on) => (on ? "0 0 0 3px #F0EAFF,0 0 0 5px #1B1B1F" : "none");

  function draw() {
    fill.style.color = st.color;
    picon.innerHTML = categoryIcon(st.icon, 34, 2);
    pname.textContent = st.name.trim() || "Nombre";
    pname.style.opacity = st.name.trim() ? "1" : ".45";

    icons.replaceChildren(
      ...CATEGORY_ICONS.map((ic) => {
        const b = document.createElement("button");
        b.type = "button";
        const on = ic === st.icon;
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.setAttribute("aria-label", "Icono " + ic);
        b.style.cssText = `width:44px;height:44px;border-radius:50%;border:1.5px solid rgba(27,27,31,.25);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .3s cubic-bezier(.3,1.6,.5,1),box-shadow .2s;background:${on ? st.color : "#fff"};transform:${on ? "scale(1.1)" : "none"};box-shadow:${ring(on)}`;
        b.innerHTML = categoryIcon(ic, 20);
        b.addEventListener("click", () => {
          st.icon = ic;
          draw();
        });
        return b;
      })
    );

    swatches.replaceChildren(
      ...CATEGORY_COLORS.map((c) => {
        const b = document.createElement("button");
        b.type = "button";
        const on = c === st.color;
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.setAttribute("aria-label", "Color " + c);
        b.style.cssText = `width:44px;height:44px;border-radius:50%;border:1.5px solid rgba(27,27,31,.25);cursor:pointer;transition:transform .3s cubic-bezier(.3,1.6,.5,1),box-shadow .2s;background:${c};transform:${on ? "scale(1.1)" : "none"};box-shadow:${ring(on)}`;
        b.addEventListener("click", () => {
          st.color = c;
          draw();
        });
        return b;
      })
    );

    save.disabled = !st.name.trim();
    if (del) {
      del.classList.toggle("danger", st.confirmDelete);
      const pagos =
        st.charges === 0 ? "" : st.charges === 1 ? " Su pago volverá a Por revisar." : ` Sus ${st.charges} pagos volverán a Por revisar.`;
      delHint.textContent = st.confirmDelete ? "Toca otra vez la papelera para borrarla." + pagos : "";
    }
  }

  form.addEventListener("input", () => {
    error.textContent = "";
    st.name = form.name.value;
    draw();
  });

  save.addEventListener("click", async () => {
    if (save.disabled) return;
    busy(save, true);
    try {
      await api(id ? `/categories/${id}` : "/categories", { name: st.name, icon: st.icon, color: st.color });
      back("/categorias");
    } catch (err) {
      error.textContent = err.message;
    } finally {
      busy(save, false);
    }
  });

  if (del) {
    del.addEventListener("click", async () => {
      if (!st.confirmDelete) {
        st.confirmDelete = true;
        draw();
        return;
      }
      busy(del, true);
      try {
        await api(`/categories/${id}/delete`, {});
        back("/categorias");
      } catch (err) {
        error.textContent = err.message;
        busy(del, false);
      }
    });
  }

  draw();
  if (id) {
    api("/categories")
      .then(({ categories }) => {
        const c = categories.find((x) => x.id === id);
        if (!c) {
          error.textContent = "Esa categoría ya no existe.";
          return;
        }
        Object.assign(st, { name: c.name, icon: c.icon, color: c.color, charges: c.charges });
        form.name.value = c.name;
        draw();
      })
      .catch((err) => (error.textContent = err.message));
  }

  return el;
}
