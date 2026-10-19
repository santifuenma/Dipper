// Pantalla "Por revisar" (Pendientes.dc.html): pagos de Apple Pay sin categoría.
import { api } from "../api.js";
import { go } from "../app.js";
import { html, ICON, iconSize } from "../dom.js";
import { euros, when } from "../format.js";
import { cardChips, merchantEditor, penButton, rawLine } from "../components.js";


export function renderPorRevisar() {
  // Estado de cada pago: { sel, rem, card, name, editing, draft, done, appliedIds, saving }
  const state = new Map();
  let items = [];
  let categories = [];
  let merchants = [];
  let loaded = false;

  const el = html(`
    <div class="screen" style="padding-bottom:0">
      <div class="topbar">
        <a href="#/" data-back class="icon-btn" aria-label="Volver">${ICON.back}</a>
        <span style="font-size:20px;font-weight:800;letter-spacing:-.3px">Por revisar</span>
        <span data-count style="min-width:44px;height:32px;box-sizing:border-box;padding:0 12px;border-radius:99px;background:#1B1B1F;color:#fff;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center">·</span>
      </div>
      <div style="flex:1;min-height:0;padding:10px 0 max(24px, env(safe-area-inset-bottom))">
        <div style="font-size:16px;font-weight:500;line-height:1.4;color:#5A5470;margin-bottom:14px">Pagos de Apple Pay que llegaron solos. Confirma la categoría y Dipper la recordará para ese comercio.</div>
        <div data-list></div>
        <div class="error" role="alert"></div>
      </div>
    </div>
  `);

  const list = el.querySelector("[data-list]");
  const count = el.querySelector("[data-count]");
  const error = el.querySelector(".error");

  const catById = (id) => categories.find((c) => c.id === id);

  function openCard(it, st) {
    const card = html(`
      <div class="card-box" style="margin-bottom:14px;overflow:hidden">
        <div data-head style="padding:16px 16px 14px"></div>
        <a data-newcard data-press hidden style="margin:0 16px 14px;height:44px;box-sizing:border-box;padding:0 14px;border:1.5px dashed rgba(27,27,31,.4);border-radius:16px;display:flex;align-items:center;gap:10px;font-size:14px;font-weight:700">
          ${iconSize(ICON.plus, 20)}
          <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Tarjeta nueva · Guardarla en Dipper</span>
        </a>
        <div data-cardpick hidden style="padding:0 16px 10px">
          <div style="font-size:13px;font-weight:700;color:#5A5470">Tienes varias tarjetas con este nombre. ¿Con cuál pagaste?</div>
          <div data-cardchips class="noscroll" style="display:flex;gap:8px;overflow-x:auto;margin:2px -16px 0;padding:8px 16px"></div>
        </div>
        <div style="padding:12px 16px 14px;border-top:1.5px solid rgba(27,27,31,.1);background:var(--surface-2)">
          <div data-hint style="font-size:13px;font-weight:700;color:#5A5470"></div>
          <div data-cats class="chips-fill" style="margin-top:10px"></div>
        </div>
        <div data-foot style="padding:10px 16px 16px;border-top:1.5px solid rgba(27,27,31,.1)">
          <button type="button" role="switch" data-rem style="width:100%;display:flex;align-items:center;gap:10px;border:0;background:transparent;padding:6px 0;font-size:14px;font-weight:700;color:#1B1B1F;cursor:pointer;text-align:left">
            <span aria-hidden="true" data-sw style="position:relative;flex:none;width:44px;height:26px;border-radius:99px;box-sizing:border-box;border:1.5px solid rgba(27,27,31,.22);transition:background .2s">
              <span data-knob style="position:absolute;top:2px;width:18px;height:18px;border-radius:50%;background:#1B1B1F;transition:left .25s cubic-bezier(.3,1.6,.5,1)"></span>
            </span>
            Recordar este comercio
          </button>
          <button type="button" data-confirm class="btn btn-lima" style="margin-top:8px">Confirmar</button>
        </div>
      </div>
    `);

    const head = card.querySelector("[data-head]");
    const amount = euros(it.amountCents);
    const hint = card.querySelector("[data-hint]");
    const sug = catById(it.suggestedCategoryId);
    const drawHint = () => {
      hint.textContent = st.editing ? "Categoría de " + (st.draft || st.name) : sug ? "Sugerida: " + sug.name : "¿En qué categoría va?";
    };

    if (st.editing) {
      // Cambiando el nombre: campo con "Listo" y las fichas de tus comercios.
      const top = html(`
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
          <div style="font-size:13px;font-weight:700;color:#5A5470">Nombre del comercio</div>
          <div data-amount style="font-size:26px;font-weight:800;letter-spacing:-.6px;white-space:nowrap"></div>
        </div>
      `);
      top.querySelector("[data-amount]").textContent = amount;
      const editor = merchantEditor({
        value: st.draft,
        raw: it.merchantRaw,
        merchants,
        categories,
        onInput: (text) => {
          st.draft = text;
          drawHint();
        },
        onPick: (m) => {
          st.draft = m.name;
          if (catById(m.categoryId)) st.sel = m.categoryId;
          drawHint();
          drawCats();
        },
        onDone: (name) => {
          if (name) st.name = name;
          st.editing = false;
          draw();
        },
      });
      head.append(top, editor);
      card.querySelector("[data-foot]").hidden = true;
    } else {
      const top = html(`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div style="min-width:0">
            <div style="display:flex;align-items:center;gap:8px">
              <div data-name style="min-width:0;font-size:17px;font-weight:800;letter-spacing:-.2px;overflow-wrap:anywhere"></div>
            </div>
            <div data-raw></div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:13px;font-weight:500;color:#5A5470">
              <span data-dot aria-hidden="true" style="flex:none;width:10px;height:10px;border-radius:50%;box-sizing:border-box;border:1px solid rgba(27,27,31,.3)"></span>
              <span data-sub></span>
            </div>
          </div>
          <div data-amount style="font-size:26px;font-weight:800;letter-spacing:-.6px;white-space:nowrap"></div>
        </div>
      `);
      const name = top.querySelector("[data-name]");
      name.textContent = st.name;
      name.after(
        penButton(() => {
          st.editing = true;
          st.draft = st.name;
          draw();
        })
      );
      top.querySelector("[data-raw]").replaceWith(rawLine(it.merchantRaw));
      // Con tarjetas que se llaman igual, la línea enseña la elegida aquí.
      const shown = it.cardCheck ? it.cardOptions.find((k) => k.id === st.card) || null : it.card;
      top.querySelector("[data-dot]").style.background = shown ? shown.color : "#fff";
      const cardTxt = shown ? `${shown.name} ···· ${shown.last4}` : it.cardCheck ? "Elige la tarjeta" : it.walletCard || "Tarjeta desconocida";
      top.querySelector("[data-sub]").textContent = `${when(it.occurredAt)} · ${cardTxt}`;
      top.querySelector("[data-amount]").textContent = amount;
      head.append(top);
      // Pago de una tarjeta de Wallet que aún no está en Dipper: ofrecer guardarla ya rellenada.
      if (!it.card && it.walletCard && !it.cardCheck) {
        const nc = card.querySelector("[data-newcard]");
        nc.hidden = false;
        nc.href = "#/tarjeta?wallet=" + encodeURIComponent(it.walletCard);
      }
    }
    drawHint();

    if (it.cardCheck) {
      card.querySelector("[data-cardpick]").hidden = false;
      card.querySelector("[data-cardchips]").replaceChildren(
        ...cardChips(
          it.cardOptions,
          st.card,
          (id) => {
            st.card = id;
            draw();
          },
          undefined,
          { cash: false }
        )
      );
    }

    const chips = card.querySelector("[data-cats]");
    const confirmBtn = card.querySelector("[data-confirm]");
    const ordered = [...categories].sort((a, b) => (a.id === it.suggestedCategoryId ? -1 : b.id === it.suggestedCategoryId ? 1 : 0));
    // Las fichas de categoría se redibujan solas para no cerrar el campo del nombre.
    function drawCats() {
      chips.replaceChildren(
        ...ordered.map((c) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "chip" + (c.id === it.suggestedCategoryId ? " sug" : "") + (st.sel === c.id ? " on" : "");
          chip.setAttribute("aria-pressed", st.sel === c.id ? "true" : "false");
          chip.textContent = c.name;
          if (st.sel === c.id) chip.style.background = c.color;
          chip.addEventListener("click", () => {
            st.sel = c.id;
            drawCats();
          });
          return chip;
        })
      );
      confirmBtn.disabled = !st.sel || st.saving || (it.cardCheck && !st.card);
    }
    drawCats();

    const rem = card.querySelector("[data-rem]");
    rem.setAttribute("aria-checked", st.rem ? "true" : "false");
    card.querySelector("[data-sw]").style.background = st.rem ? "#CDF56B" : "#fff";
    card.querySelector("[data-knob]").style.left = st.rem ? "20px" : "2px";
    rem.addEventListener("click", () => {
      st.rem = !st.rem;
      draw();
    });

    confirmBtn.addEventListener("click", () => confirm(it, st));
    return card;
  }

  function doneCard(it, st) {
    const cat = catById(st.sel);
    const card = html(`
      <div class="stick" style="margin-bottom:14px;box-sizing:border-box;border:1.5px solid rgba(27,27,31,.22);border-radius:24px;padding:12px 16px;display:flex;align-items:center;gap:12px">
        <span style="flex:none;width:34px;height:34px;border-radius:50%;background:#1B1B1F;display:flex;align-items:center;justify-content:center"><span style="display:flex;color:#fff">${iconSize(ICON.check, 18)}</span></span>
        <span data-txt style="flex:1;min-width:0;font-size:16px;font-weight:700"></span>
        <button type="button" data-undo style="border:0;background:transparent;font-size:14px;font-weight:700;text-decoration:underline;color:#1B1B1F;cursor:pointer;padding:8px 0">Deshacer</button>
      </div>
    `);
    if (st.stuck) card.classList.remove("stick"); // la animación solo la primera vez
    st.stuck = true;
    card.style.background = cat ? cat.color : "#fff";
    card.querySelector("[data-txt]").textContent = `${st.name} → ${cat ? cat.name : ""}${st.rem ? " · recordado" : ""}`;
    const undoBtn = card.querySelector("[data-undo]");
    if (st.auto) undoBtn.hidden = true; // colocado solo por "recordar"; se deshace desde el original
    undoBtn.addEventListener("click", () => undo(it, st));
    return card;
  }

  function allDoneView() {
    return html(`
      <div style="margin-top:10px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:20px 10px">
        <div class="stick" style="width:120px;height:120px;border-radius:40px;border:1.5px solid rgba(27,27,31,.22);background:#fff;display:flex;align-items:center;justify-content:center;margin-bottom:8px">
          <span aria-hidden="true" style="display:flex;padding-left:8px">
            <span class="wig" style="width:28px;height:28px;border-radius:50%;background:#FFC93C;box-shadow:0 0 0 2px #fff;margin-left:-8px"></span>
            <span class="wig" style="width:28px;height:28px;border-radius:50%;background:#FFA8D2;box-shadow:0 0 0 2px #fff;margin-left:-8px;animation-delay:.25s"></span>
            <span class="wig" style="width:28px;height:28px;border-radius:50%;background:#98EBC6;box-shadow:0 0 0 2px #fff;margin-left:-8px;animation-delay:.5s"></span>
          </span>
        </div>
        <div style="font-size:28px;font-weight:800;letter-spacing:-.6px">Todo al día</div>
        <div style="font-size:16px;font-weight:500;color:#5A5470">No queda ningún pago por revisar.</div>
        <button type="button" data-home class="btn btn-lima" style="margin-top:14px">Volver al inicio</button>
      </div>
    `);
  }

  // Redibuja manteniendo la posición del scroll.
  function draw() {
    const scroll = el.scrollTop;
    const nodes = items.map((it) => {
      const st = state.get(it.id);
      return st.done ? doneCard(it, st) : openCard(it, st);
    });
    const open = items.filter((it) => !state.get(it.id).done).length;
    count.textContent = loaded ? String(open) : "·";
    if (loaded && open === 0) {
      const empty = allDoneView();
      empty.querySelector("[data-home]").addEventListener("click", () => go("/"));
      nodes.push(empty);
    }
    list.replaceChildren(...nodes);
    el.scrollTop = scroll;
  }

  async function confirm(it, st) {
    error.textContent = "";
    st.saving = true;
    draw();
    try {
      const body = { categoryId: st.sel, remember: st.rem };
      if (st.name !== it.merchant) body.name = st.name;
      if (it.cardCheck) body.cardId = st.card;
      const res = await api(`/pending/${it.id}/confirm`, body);
      st.done = true;
      st.appliedIds = res.appliedIds.filter((id) => id !== it.id);
      for (const id of st.appliedIds) {
        const other = state.get(id);
        if (other) Object.assign(other, { done: true, sel: st.sel, rem: true, auto: true, name: st.name });
      }
    } catch (err) {
      error.textContent = err.message;
    } finally {
      st.saving = false;
      draw();
    }
  }

  async function undo(it, st) {
    error.textContent = "";
    try {
      await api(`/pending/${it.id}/undo`, { forgetRule: st.rem, appliedIds: st.appliedIds || [] });
      for (const id of st.appliedIds || []) {
        const other = state.get(id);
        if (other) Object.assign(other, { done: false, auto: false, stuck: false });
      }
      st.done = false;
      st.stuck = false;
      st.appliedIds = [];
      draw();
    } catch (err) {
      error.textContent = err.message;
    }
  }

  api("/pending")
    .then((data) => {
      items = data.items;
      categories = data.categories;
      merchants = data.merchants || [];
      for (const it of items) state.set(it.id, { sel: it.suggestedCategoryId, rem: true, card: it.cardId, name: it.merchant, done: false });
      loaded = true;
      draw();
    })
    .catch((err) => (error.textContent = err.message));

  return el;
}
