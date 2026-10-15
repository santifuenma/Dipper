// Pantalla "Pago" (nueva, acordada): cambiar la categoría o la tarjeta de un pago, o borrarlo.
import { api } from "../api.js";
import { back } from "../nav.js";
import { busy, html, ICON } from "../dom.js";
import { euros, when } from "../format.js";
import { cardChips } from "../components.js";

const LABEL = "font-size:13px;font-weight:700;color:#5A5470";

export function renderMovimiento(params) {
  const id = Number(params.get("id"));
  const st = { sel: null, original: null, card: null, originalCard: null, categories: [], cards: [], charge: null, confirmDelete: false };

  const el = html(`
    <div class="screen">
      <div class="topbar">
        <a href="#/" data-back class="icon-btn" aria-label="Volver">${ICON.back}</a>
        <span style="font-size:20px;font-weight:800;letter-spacing:-.3px">Pago</span>
        <button type="button" data-delete class="round-btn" aria-label="Borrar pago" hidden>${ICON.trash}</button>
      </div>
      <div style="flex:1;min-height:0;padding:8px 0 12px">
        <div data-del-hint class="hint-danger" style="margin-bottom:10px"></div>
        <div data-card class="card-box" style="border-radius:28px;padding:16px 18px" hidden>
          <div data-amount style="font-size:52px;font-weight:800;line-height:1;letter-spacing:-2px"></div>
          <div data-merchant style="margin-top:10px;font-size:22px;font-weight:800;letter-spacing:-.4px"></div>
          <div data-raw style="margin-top:2px;font-size:13px;font-weight:600;color:#5A5470;overflow-wrap:anywhere"></div>
          <div data-sub style="margin-top:8px;font-size:14px;font-weight:600;color:#5A5470"></div>
        </div>
        <div data-cats-wrap hidden style="margin-top:14px">
          <div style="${LABEL}">Categoría</div>
          <div data-chips style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div>
        </div>
        <div data-cards-wrap hidden style="margin-top:14px">
          <div style="${LABEL}">Tarjeta</div>
          <div data-cards class="noscroll" style="display:flex;gap:8px;overflow-x:auto;margin:2px -20px 0;padding:8px 20px"></div>
        </div>
        <div class="error" role="alert" style="margin-top:8px"></div>
      </div>
      <button type="button" data-save class="btn btn-lima" style="flex:none;margin-top:10px" disabled>Guardar</button>
    </div>
  `);

  const q = (s) => el.querySelector(s);
  const save = q("[data-save]");
  const del = q("[data-delete]");
  const error = q(".error");

  const changed = () => (st.sel !== st.original && st.sel !== null) || st.card !== st.originalCard;

  function drawSub() {
    const c = st.charge;
    const card = st.cards.find((k) => k.id === st.card);
    const cardTxt = card
      ? `${card.name} ···· ${card.last4}`
      : st.card === null && st.card !== st.originalCard
        ? "Efectivo u otros"
        : c.walletCard || (c.source === "manual" ? "Efectivo u otros" : "Tarjeta desconocida");
    q("[data-sub]").textContent = `${when(c.occurredAt)} · ${cardTxt}`;
  }

  function draw() {
    q("[data-chips]").replaceChildren(
      ...st.categories.map((c) => {
        const b = document.createElement("button");
        b.type = "button";
        const on = st.sel === c.id;
        b.className = "chip" + (on ? " on" : "");
        b.setAttribute("aria-pressed", on ? "true" : "false");
        if (on) b.style.background = c.color;
        b.textContent = c.name;
        b.addEventListener("click", () => {
          st.sel = c.id;
          draw();
        });
        return b;
      })
    );
    q("[data-cards]").replaceChildren(
      ...cardChips(st.cards, st.card, (cid) => {
        st.card = cid;
        draw();
      })
    );
    drawSub();
    save.disabled = !changed();
    del.classList.toggle("danger", st.confirmDelete);
    q("[data-del-hint]").textContent = st.confirmDelete ? "Toca otra vez la papelera para borrar este pago." : "";
  }

  save.addEventListener("click", async () => {
    if (save.disabled) return;
    const body = {};
    if (st.sel !== st.original && st.sel !== null) body.categoryId = st.sel;
    if (st.card !== st.originalCard) body.cardId = st.card;
    busy(save, true);
    try {
      await api(`/charges/${id}`, body);
      back("/");
    } catch (err) {
      error.textContent = err.message;
      busy(save, false);
    }
  });

  del.addEventListener("click", async () => {
    if (!st.confirmDelete) {
      st.confirmDelete = true;
      draw();
      return;
    }
    busy(del, true);
    try {
      await api(`/charges/${id}/delete`, {});
      back("/");
    } catch (err) {
      error.textContent = err.message;
      busy(del, false);
    }
  });

  api(`/charges/${id}`)
    .then(({ charge, cards, categories }) => {
      Object.assign(st, { charge, cards, categories, sel: charge.categoryId, original: charge.categoryId, card: charge.cardId, originalCard: charge.cardId });
      q("[data-card]").hidden = false;
      q("[data-cats-wrap]").hidden = false;
      q("[data-cards-wrap]").hidden = false;
      del.hidden = false;
      q("[data-amount]").textContent = euros(charge.amountCents);
      q("[data-merchant]").textContent = charge.merchant;
      q("[data-raw]").textContent = charge.merchantRaw !== charge.merchant ? charge.merchantRaw : "";
      draw();
    })
    .catch((err) => (error.textContent = err.message));

  return el;
}
