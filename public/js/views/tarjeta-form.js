// Pantalla "Nueva tarjeta" (NuevaTarjeta.dc.html). Con ?id= es "Editar tarjeta" y permite borrarla.
import { api } from "../api.js";
import { back } from "../nav.js";
import { busy, html, ICON } from "../dom.js";
import { CARD_COLORS } from "../icons.js";

export function renderTarjetaForm(params) {
  const id = Number(params.get("id")) || null;
  // ?wallet= viene de "Por revisar": tarjeta nueva ya rellenada con el nombre que manda Wallet.
  const wallet = (params.get("wallet") || "").trim();
  const st = { name: wallet.slice(0, 22), last4: (wallet.match(/(\d{4})\D*$/) || [])[1] || "", walletName: wallet, color: CARD_COLORS[0].bg, walletNames: [], confirmDelete: false };

  const el = html(`
    <div class="screen">
      <div class="topbar">
        <a href="#/" data-back class="icon-btn" aria-label="Volver">${ICON.back}</a>
        <span style="font-size:20px;font-weight:800;letter-spacing:-.3px">${id ? "Editar tarjeta" : "Nueva tarjeta"}</span>
        ${id ? `<button type="button" data-delete class="round-btn" aria-label="Borrar tarjeta">${ICON.trash}</button>` : `<span style="width:44px"></span>`}
      </div>

      <div style="flex:1;min-height:0;padding:8px 0 4px">
        <div data-preview style="position:relative;overflow:hidden;width:100%;height:min(164px,16dvh);box-sizing:border-box;padding:16px 18px;border:1.5px solid rgba(27,27,31,.22);border-radius:28px;display:flex;flex-direction:column;justify-content:space-between;transition:background .35s,color .35s">
          <span aria-hidden="true" style="position:absolute;right:-56px;top:-56px;width:190px;height:190px;border-radius:50%;background:rgba(255,255,255,.22)"></span>
          <span aria-hidden="true" style="position:absolute;left:-40px;bottom:-70px;width:150px;height:150px;border-radius:50%;background:rgba(27,27,31,.08)"></span>
          <span style="position:relative;display:flex;justify-content:space-between;align-items:center">
            <span data-pname style="font-size:24px;font-weight:800;letter-spacing:-.5px"></span>
            <span aria-hidden="true" style="display:flex">
              <span style="width:24px;height:24px;box-sizing:border-box;border-radius:50%;border:2.5px solid currentColor"></span>
              <span style="width:24px;height:24px;margin-left:-10px;border-radius:50%;background:currentColor"></span>
            </span>
          </span>
          <span style="position:relative">
            <span aria-hidden="true" style="display:block;width:36px;height:26px;box-sizing:border-box;border-radius:7px;border:2.5px solid currentColor;margin-bottom:10px"></span>
            <span data-plast style="font-size:24px;font-weight:700;letter-spacing:3px"></span>
          </span>
        </div>

        <div data-del-hint class="hint-danger" style="margin-top:10px"></div>
        <form novalidate style="margin-top:12px;display:flex;flex-direction:column;gap:10px">
          <label style="display:block">
            <span style="display:block;font-size:13px;font-weight:700;color:#5A5470;margin-bottom:6px">Nombre</span>
            <input name="name" type="text" maxlength="22" placeholder="Día a día" style="width:100%;height:48px;box-sizing:border-box;padding:0 16px;border:1.5px solid rgba(27,27,31,.22);border-radius:18px;background:#fff;font-size:17px;font-weight:600;color:#1B1B1F">
          </label>
          <label style="display:block">
            <span style="display:block;font-size:13px;font-weight:700;color:#5A5470;margin-bottom:6px">Últimos 4 dígitos</span>
            <input name="last4" type="text" inputmode="numeric" maxlength="4" placeholder="4821" style="width:100%;height:48px;box-sizing:border-box;padding:0 16px;border:1.5px solid rgba(27,27,31,.22);border-radius:18px;background:#fff;font-size:17px;font-weight:600;letter-spacing:3px;color:#1B1B1F">
            <span style="display:block;margin-top:6px;font-size:13px;font-weight:500;color:#5A5470">Solo guardamos los 4 últimos. Nunca el número completo.</span>
          </label>
          <label style="display:block">
            <span style="display:block;font-size:13px;font-weight:700;color:#5A5470;margin-bottom:6px">Nombre en Wallet</span>
            <input name="walletName" type="text" placeholder="Como aparece en Apple Wallet" style="width:100%;height:48px;box-sizing:border-box;padding:0 16px;border:1.5px solid rgba(27,27,31,.22);border-radius:18px;background:#fff;font-size:17px;font-weight:600;color:#1B1B1F">
            <span style="display:block;margin-top:6px;font-size:13px;font-weight:500;color:#5A5470">Así reconocemos la tarjeta cuando llega un pago de Apple Pay.</span>
          </label>
          <div data-seen hidden>
            <div style="font-size:13px;font-weight:700;color:#5A5470;margin-bottom:8px">Llegaron en tus pagos</div>
            <div data-seen-chips style="display:flex;flex-wrap:wrap;gap:8px"></div>
          </div>

          <div>
            <div style="font-size:13px;font-weight:700;color:#5A5470;margin-bottom:8px">Color</div>
            <div data-swatches style="display:flex;gap:10px;flex-wrap:wrap"></div>
          </div>
          <div class="error" role="alert"></div>
        </form>
      </div>

      <button type="button" data-save class="btn btn-lima" style="flex:none;margin-top:10px" disabled>Guardar tarjeta</button>
    </div>
  `);

  const form = el.querySelector("form");
  const preview = el.querySelector("[data-preview]");
  const pname = el.querySelector("[data-pname]");
  const plast = el.querySelector("[data-plast]");
  const swatches = el.querySelector("[data-swatches]");
  const seen = el.querySelector("[data-seen]");
  const seenChips = el.querySelector("[data-seen-chips]");
  const save = el.querySelector("[data-save]");
  const del = el.querySelector("[data-delete]");
  const error = el.querySelector(".error");

  function draw() {
    const col = CARD_COLORS.find((c) => c.bg === st.color) || CARD_COLORS[0];
    preview.style.background = col.bg;
    preview.style.color = col.fg;
    pname.textContent = st.name.trim() || "Nombre de la tarjeta";
    pname.style.opacity = st.name.trim() ? "1" : ".55";
    plast.textContent = "···· " + (st.last4 + "••••").slice(0, 4);

    swatches.replaceChildren(
      ...CARD_COLORS.map((c) => {
        const b = document.createElement("button");
        b.type = "button";
        const on = c.bg === st.color;
        b.setAttribute("aria-label", c.name);
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.style.cssText = `width:44px;height:44px;border-radius:50%;border:1.5px solid rgba(27,27,31,.25);cursor:pointer;transition:transform .3s cubic-bezier(.3,1.6,.5,1),box-shadow .2s;background:${c.bg};transform:${on ? "scale(1.1)" : "none"};box-shadow:${on ? "0 0 0 3px #F0EAFF,0 0 0 5px #1B1B1F" : "none"}`;
        b.addEventListener("click", () => {
          st.color = c.bg;
          draw();
        });
        return b;
      })
    );

    seen.hidden = st.walletNames.length === 0;
    seenChips.replaceChildren(
      ...st.walletNames.map((n) => {
        const b = document.createElement("button");
        b.type = "button";
        const on = n === st.walletName;
        b.className = "chip" + (on ? " on" : "");
        if (on) b.style.background = "#CDF56B";
        b.textContent = n;
        b.addEventListener("click", () => {
          st.walletName = n;
          form.walletName.value = n;
          draw();
        });
        return b;
      })
    );

    save.disabled = !(st.name.trim() && st.last4.length === 4);
    if (del) {
      del.classList.toggle("danger", st.confirmDelete);
      el.querySelector("[data-del-hint]").textContent = st.confirmDelete
        ? "Toca otra vez la papelera para borrarla. Sus pagos se conservan."
        : "";
    }
  }

  form.addEventListener("input", () => {
    error.textContent = "";
    st.name = form.name.value;
    form.last4.value = form.last4.value.replace(/\D/g, "").slice(0, 4);
    st.last4 = form.last4.value;
    st.walletName = form.walletName.value.trim();
    draw();
  });

  save.addEventListener("click", async () => {
    if (save.disabled) return;
    busy(save, true);
    try {
      const body = { name: st.name, last4: st.last4, walletName: st.walletName, color: st.color };
      await api(id ? `/cards/${id}` : "/cards", body);
      back("/tarjetas");
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
        await api(`/cards/${id}/delete`, {});
        back("/tarjetas");
      } catch (err) {
        error.textContent = err.message;
        busy(del, false);
      }
    });
  }

  if (wallet) {
    form.name.value = st.name;
    form.last4.value = st.last4;
    form.walletName.value = st.walletName;
  }
  draw();
  api("/cards")
    .then((data) => {
      st.walletNames = data.walletNames;
      if (id) {
        const c = data.cards.find((x) => x.id === id);
        if (!c) {
          error.textContent = "Esa tarjeta ya no existe.";
          return;
        }
        Object.assign(st, { name: c.name, last4: c.last4, walletName: c.walletName || "", color: c.color });
        form.name.value = c.name;
        form.last4.value = c.last4;
        form.walletName.value = c.walletName || "";
      }
      draw();
    })
    .catch((err) => (error.textContent = err.message));

  return el;
}
