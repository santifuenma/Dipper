// Pantalla "Pago" (nueva, acordada): cambiar la categoría, la tarjeta o el nombre del comercio de un pago, o borrarlo.
import { api, load } from "../api.js";
import { back } from "../nav.js";
import { busy, html, ICON } from "../dom.js";
import { dayFull, dayKey, euros, when } from "../format.js";
import { cardChips, merchantEditor, penButton, rawLine } from "../components.js";

export function renderPago(params) {
  const id = Number(params.get("id"));
  const st = { amount: 0, originalAmount: 0, editingAmount: false, date: 0, originalDate: 0, sel: null, original: null, card: null, originalCard: null, categories: [], cards: [], charge: null, confirmDelete: false, name: "", originalName: "", editing: false, merchants: [] };

  const el = html(`
    <div class="screen">
      <div class="topbar">
        <a href="#/" data-back class="icon-btn" aria-label="Volver">${ICON.back}</a>
        <span class="title">Pago</span>
        <button type="button" data-delete class="round-btn dash" aria-label="Borrar pago" hidden>${ICON.trash}</button>
      </div>
      <div style="flex:1;min-height:0;padding:8px 0 12px">
        <div data-del-hint class="hint-danger" style="margin-bottom:10px"></div>
        <div data-card class="card-box" style="border-radius:28px;padding:16px 18px" hidden>
          <div data-amount-box></div>
          <div data-merchant style="margin-top:10px"></div>
          <div data-sub style="margin-top:8px;font-size:14px;font-weight:600;color:#5A5470"></div>
        </div>
        <div data-cats-wrap hidden style="margin-top:14px">
          <div class="label">Categoría</div>
          <div data-cats class="chips-fill" style="margin-top:8px"></div>
        </div>
        <div data-cards-wrap hidden style="margin-top:14px">
          <div class="label">Tarjeta</div>
          <div data-cards class="noscroll" style="display:flex;gap:8px;overflow-x:auto;margin:2px -20px 0;padding:8px 20px"></div>
        </div>
        <div data-concept-wrap hidden style="margin-top:10px">
          <div class="label">Concepto</div>
          <label class="field" style="margin-top:6px;height:44px">
            <input data-concept type="text" maxlength="80" autocomplete="off" enterkeyhint="done" aria-label="Concepto" placeholder="Ej. regalo de Marta">
          </label>
        </div>
        <div data-date-wrap hidden style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div class="label">Fecha</div>
          <label data-date-pill style="position:relative;height:38px;box-sizing:border-box;padding:0 14px;border-radius:99px;display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;overflow:hidden;background:#fff;border:1.5px solid rgba(27,27,31,.22)">${ICON.calendar}<span data-date-txt></span></label>
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

  const changed = () => (st.sel !== st.original && st.sel !== null) || st.card !== st.originalCard || nameNow() !== st.originalName || st.date !== st.originalDate || st.amount !== st.originalAmount || conceptNow() !== st.originalConcept;
  const conceptNow = () => q("[data-concept]").value.trim().replace(/\s+/g, " ");
  // Si guarda sin tocar "Listo", vale lo que haya escrito.
  const nameNow = () => (st.editing && st.draft ? st.draft : st.name);

  // Importe con lápiz; al tocarlo, un campo numérico con "Listo". Vale la coma o el punto como decimal.
  function drawAmount() {
    const box = q("[data-amount-box]");
    if (st.editingAmount) {
      const form = html(`
        <form class="field has-btn" style="height:56px">
          <input data-input type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done" aria-label="Importe en euros" style="font-size:28px;font-weight:800">
          <span style="font-size:22px;font-weight:700;color:var(--ink)">€</span>
          <button type="submit" class="toggle" style="text-decoration:underline">Listo</button>
        </form>
      `);
      const input = form.querySelector("[data-input]");
      input.value = (st.amount / 100).toFixed(2).replace(".", ",");
      const read = () => {
        const v = Math.round(parseFloat(input.value.replace(",", ".").replace(/[^\d.-]/g, "")) * 100);
        return Number.isFinite(v) && v !== 0 ? v : null;
      };
      input.addEventListener("input", () => {
        const v = read();
        if (v !== null) st.amount = v;
        save.disabled = !changed();
      });
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const v = read();
        if (v === null) return;
        st.amount = v;
        st.editingAmount = false;
        drawAmount();
        draw();
      });
      box.replaceChildren(form);
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
      return;
    }
    const row = html(`<div style="display:flex;align-items:center;gap:10px"><span data-a style="font-size:52px;font-weight:800;line-height:1;letter-spacing:-2px"></span></div>`);
    row.querySelector("[data-a]").textContent = euros(st.amount);
    const pen = penButton(() => {
      st.editingAmount = true;
      drawAmount();
    });
    pen.setAttribute("aria-label", "Cambiar el importe");
    row.append(pen);
    box.replaceChildren(row);
  }

  // Nombre del comercio con lápiz; al tocarlo, el campo y las fichas de tus comercios.
  function drawMerchant() {
    const c = st.charge;
    const box = q("[data-merchant]");
    const raw = c.source === "applepay" ? c.merchantRaw : null;
    if (st.editing) {
      box.replaceChildren(
        merchantEditor({
          value: st.name,
          raw,
          merchants: st.merchants,
          categories: st.categories,
          max: 6,
          note: "Se cambia en todos los pagos de este comercio.",
          fits: () => q("[data-cards-wrap]").getBoundingClientRect().bottom <= save.getBoundingClientRect().top - 8,
          onInput: (text) => {
            st.draft = text.replace(/\s+/g, " ");
            save.disabled = !changed();
          },
          onPick: (m) => {
            st.draft = m.name;
            if (st.categories.some((k) => k.id === m.categoryId)) st.sel = m.categoryId;
            draw();
          },
          onDone: (name) => {
            if (name) st.name = name;
            st.editing = false;
            drawMerchant();
            draw();
          },
        })
      );
      return;
    }
    const row = html(`<div style="display:flex;align-items:center;gap:8px"><span data-n style="min-width:0;font-size:22px;font-weight:800;letter-spacing:-.4px;overflow-wrap:anywhere"></span></div>`);
    row.querySelector("[data-n]").textContent = st.name;
    row.append(
      penButton(() => {
        st.editing = true;
        st.draft = st.name;
        drawMerchant();
      })
    );
    box.replaceChildren(row);
    if (raw) box.append(rawLine(raw));
  }

  function drawSub() {
    const c = st.charge;
    const card = st.cards.find((k) => k.id === st.card);
    const cardTxt = card
      ? `${card.name} ···· ${card.last4}`
      : st.card === null && st.card !== st.originalCard
        ? "Efectivo u otros"
        : c.walletCard || (c.source === "manual" ? "Efectivo u otros" : "Tarjeta desconocida");
    q("[data-sub]").textContent = `${when(st.date)} · ${cardTxt}`;
    q("[data-date-txt]").textContent = dayFull(st.date);
  }

  // Selector de fecha nativo (invisible) sobre la pastilla; se conserva la hora del pago. Vale cualquier día,
  // también de meses que aún no han llegado.
  function buildDate() {
    const input = document.createElement("input");
    input.type = "date";
    input.setAttribute("aria-label", "Fecha del pago");
    input.style.cssText = "position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;-webkit-appearance:none;appearance:none;font-size:16px";
    input.addEventListener("change", () => {
      if (!input.value) return;
      const [y, m, d] = input.value.split("-").map(Number);
      const t = new Date(st.originalDate);
      st.date = new Date(y, m - 1, d, t.getHours(), t.getMinutes()).getTime();
      drawSub();
      save.disabled = !changed();
    });
    q("[data-date-pill]").append(input);
    input.value = dayKey(st.date);
  }

  function draw() {
    q("[data-cats]").replaceChildren(
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
      ...cardChips(
        st.cards,
        st.card,
        (cid) => {
          st.card = cid;
          draw();
        },
        st.originalCard
      )
    );
    drawSub();
    save.disabled = !changed();
    del.classList.toggle("danger", st.confirmDelete);
    q("[data-del-hint]").textContent = st.confirmDelete ? "Toca otra vez la papelera para borrar este pago." : "";
  }

  q("[data-concept]").addEventListener("input", () => {
    save.disabled = !changed();
  });

  save.addEventListener("click", async () => {
    if (save.disabled) return;
    const body = {};
    if (st.sel !== st.original && st.sel !== null) body.categoryId = st.sel;
    if (st.card !== st.originalCard) body.cardId = st.card;
    if (nameNow() !== st.originalName) body.merchant = nameNow();
    if (st.date !== st.originalDate) body.date = st.date;
    if (st.amount !== st.originalAmount) body.amountCents = st.amount;
    if (conceptNow() !== st.originalConcept) body.concept = conceptNow();
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

  load(`/charges/${id}`)
    .then(({ charge, cards, categories, merchants }) => {
      Object.assign(st, { charge, cards, categories, merchants: merchants || [], sel: charge.categoryId, original: charge.categoryId, card: charge.cardId, originalCard: charge.cardId, name: charge.merchant, originalName: charge.merchant, date: charge.occurredAt, originalDate: charge.occurredAt });
      q("[data-card]").hidden = false;
      q("[data-date-wrap]").hidden = false;
      buildDate();
      q("[data-cats-wrap]").hidden = false;
      q("[data-cards-wrap]").hidden = false;
      del.hidden = false;
      st.amount = st.originalAmount = charge.amountCents;
      st.originalConcept = charge.concept || "";
      q("[data-concept]").value = st.originalConcept;
      q("[data-concept-wrap]").hidden = false;
      drawAmount();
      drawMerchant();
      draw();
    })
    .catch((err) => (error.textContent = err.message));

  return el;
}
