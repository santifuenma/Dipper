// Piezas compartidas entre Inicio, Tarjeta, Categoría y Movimientos.
import { html, ICON } from "./dom.js";
import { dayKey, dayTitle, euros, timeOf } from "./format.js";
import { cardBorder, cardFg, categoryIcon } from "./icons.js";

const PENDING_ICON =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1B1F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4M12 16h.01"/></svg>';

// Agrupa pagos (ya ordenados del más reciente al más antiguo) por día.
export function groupByDay(charges) {
  const groups = [];
  for (const c of charges) {
    const k = dayKey(c.occurredAt);
    let g = groups[groups.length - 1];
    if (!g || g.key !== k) {
      g = { key: k, label: dayTitle(c.occurredAt), rows: [] };
      groups.push(g);
    }
    g.rows.push(c);
  }
  return groups;
}

// Lista de movimientos agrupada por día (estilo Tarjeta.dc.html / Categoria.dc.html).
// mode "category": icono de categoría + "Categoría · hora". mode "card": punto de tarjeta + "hora · ···· 1234".
export function movementGroups(charges, { cats, cards, mode = "category" }) {
  const wrap = document.createElement("div");
  for (const g of groupByDay(charges)) {
    const group = html(`
      <div style="margin-top:10px">
        <div data-label style="font-size:13px;font-weight:700;color:#5A5470;margin:0 0 6px 4px"></div>
        <div data-rows style="border:1.5px solid rgba(27,27,31,.22);border-radius:22px;background:#fff;overflow:hidden"></div>
      </div>
    `);
    group.querySelector("[data-label]").textContent = g.label;
    const rowsEl = group.querySelector("[data-rows]");
    g.rows.forEach((c, i) => {
      const cat = cats.find((x) => x.id === c.categoryId);
      const card = cards.find((x) => x.id === c.cardId);
      const row = html(`
        <a data-press style="display:flex;align-items:center;gap:12px;padding:10px 14px">
          <span data-lead></span>
          <span style="flex:1;min-width:0">
            <span data-merchant style="display:block;font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span>
            <span data-sub style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:#5A5470"></span>
          </span>
          <span data-amount style="font-size:17px;font-weight:800;white-space:nowrap"></span>
        </a>
      `);
      row.href = "#/movimiento?id=" + c.id;
      if (i < g.rows.length - 1) row.style.borderBottom = "1px solid rgba(27,27,31,.08)";
      const lead = row.querySelector("[data-lead]");
      const sub = row.querySelector("[data-sub]");
      if (mode === "category") {
        lead.style.cssText = "flex:none;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-sizing:border-box";
        if (cat) {
          lead.style.background = cat.color;
          lead.innerHTML = categoryIcon(cat.icon, 20);
        } else {
          lead.style.border = "1.5px dashed rgba(27,27,31,.5)";
          lead.innerHTML = PENDING_ICON;
        }
        sub.textContent = (cat ? cat.name : "Por revisar") + " · " + timeOf(c.occurredAt);
      } else {
        lead.remove();
        const dot = document.createElement("span");
        dot.setAttribute("aria-hidden", "true");
        dot.style.cssText = "flex:none;width:10px;height:10px;border-radius:50%;box-sizing:border-box;border:1px solid rgba(27,27,31,.3)";
        dot.style.background = card ? card.color : "#fff";
        const txt = document.createElement("span");
        txt.textContent = timeOf(c.occurredAt) + (card ? " · ···· " + card.last4 : c.walletCard ? " · " + c.walletCard : "");
        sub.append(dot, txt);
      }
      row.querySelector("[data-merchant]").textContent = c.merchant;
      row.querySelector("[data-amount]").textContent = euros(c.amountCents);
      rowsEl.append(row);
    });
    wrap.append(group);
  }
  return wrap;
}

// Fichas de tarjeta (estilo de Nuevo gasto): tus tarjetas y al final "Efectivo / Otros" (id null).
// firstId: la tarjeta con la que se pagó va la primera (en Pago). cash: false quita "Efectivo".
export function cardChips(cards, selectedId, onPick, firstId, { cash = true } = {}) {
  const opts = [
    ...cards.map((k) => ({ id: k.id, name: k.name, sub: "···· " + k.last4, bg: k.color, fg: cardFg(k.color) })),
    ...(cash ? [{ id: null, name: "Efectivo", sub: "Otros", bg: "#fff", fg: "#1B1B1F" }] : []),
  ];
  if (firstId !== undefined) {
    const i = opts.findIndex((o) => o.id === firstId);
    if (i > 0) opts.unshift(...opts.splice(i, 1));
  }
  return opts.map((o) => {
    const on = selectedId === o.id;
    const b = html(`
      <button type="button" style="flex:none;width:128px;height:56px;box-sizing:border-box;padding:0 12px;border:1.5px solid rgba(27,27,31,.22);border-radius:16px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;text-align:left;cursor:pointer;transition:transform .3s cubic-bezier(.3,1.6,.5,1),opacity .2s,box-shadow .2s">
        <span data-n style="font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%"></span>
        <span data-s style="font-size:12px;font-weight:600;letter-spacing:1.2px"></span>
      </button>
    `);
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.style.background = o.bg;
    b.style.color = o.fg;
    b.style.borderColor = cardBorder(o.bg);
    b.style.opacity = on ? "1" : ".55";
    b.style.transform = on ? "translateY(-2px)" : "none";
    b.style.boxShadow = on ? "0 0 0 2px #F1EDF9,0 0 0 4px #1B1B1F" : "none";
    b.querySelector("[data-n]").textContent = o.name;
    b.querySelector("[data-s]").textContent = o.sub;
    b.addEventListener("click", () => onPick(o.id));
    return b;
  });
}

// Quita movimientos del final hasta que la pantalla quepa sin scroll (deja al menos uno).
export function fitMovements(screen, groupsEl) {
  const run = () => {
    if (!screen.isConnected) return requestAnimationFrame(run);
    const overflow = () => screen.scrollHeight > screen.clientHeight + 1;
    while (overflow()) {
      const rows = groupsEl.querySelectorAll("[data-rows] > a");
      if (rows.length <= 1) break;
      const last = rows[rows.length - 1];
      const list = last.parentElement;
      last.remove();
      if (!list.children.length) list.parentElement.remove();
      else list.lastElementChild.style.borderBottom = "";
    }
  };
  requestAnimationFrame(run);
}

// Botón "Ver todos los movimientos"
export function seeAllLink(href) {
  const a = html(
    `<a class="btn btn-white" style="margin-top:14px">Ver todos los movimientos</a>`
  );
  a.href = href;
  return a;
}

export function emptyNote(text) {
  const d = document.createElement("div");
  d.style.cssText = "margin-top:10px;padding:16px;border:1.5px dashed rgba(27,27,31,.35);border-radius:20px;font-size:15px;font-weight:600;color:#5A5470;text-align:center";
  d.textContent = text;
  return d;
}

// Botón redondo con lápiz para cambiar el nombre del comercio.
export function penButton(onClick) {
  const b = html(
    `<button type="button" aria-label="Cambiar el nombre del comercio" style="flex:none;width:30px;height:30px;box-sizing:border-box;padding:0;border-radius:50%;border:1.5px solid rgba(27,27,31,.22);background:#fff;color:#1B1B1F;display:flex;align-items:center;justify-content:center;cursor:pointer">${ICON.pen}</button>`
  );
  b.addEventListener("click", onClick);
  return b;
}

// Línea gris con el nombre tal cual lo mandó Apple Pay.
export function rawLine(raw) {
  const d = document.createElement("div");
  d.style.cssText = "margin-top:2px;font-size:12px;font-weight:600;color:#8A83A3;overflow-wrap:anywhere";
  d.textContent = "Apple Pay: " + raw;
  return d;
}

const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Editor del nombre del comercio: campo + "Listo", el nombre de Apple Pay y las fichas "Tus comercios".
// Tocar una ficha pone su nombre y avisa con su categoría (onPick). onDone recibe el nombre escrito.
// fits(): en pantallas sin scroll, se quitan fichas del final hasta que todo quepa.
export function merchantEditor({ value, raw, merchants, categories, max = 8, note, fits, onInput, onPick, onDone }) {
  const el = html(`
    <div>
      <form data-form class="field has-btn" style="margin-top:8px;height:50px">
        <input data-input type="text" maxlength="60" autocomplete="off" autocapitalize="words" enterkeyhint="done" aria-label="Nombre del comercio">
        <button type="submit" class="toggle" style="text-decoration:underline">Listo</button>
      </form>
      <div data-raw></div>
      <div data-note style="margin-top:4px;font-size:12px;font-weight:600;color:#5A5470"></div>
      <div data-label style="font-size:13px;font-weight:700;color:#5A5470;margin-top:12px">Tus comercios</div>
      <div data-chips style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div>
    </div>
  `);
  const input = el.querySelector("[data-input]");
  const chipsEl = el.querySelector("[data-chips]");
  const label = el.querySelector("[data-label]");
  input.value = value;
  if (raw) el.querySelector("[data-raw]").replaceWith(rawLine(raw));
  if (note) el.querySelector("[data-note]").textContent = note;
  else el.querySelector("[data-note]").remove();
  let typed = false; // hasta que escriba se ven todas las fichas; luego, las que coinciden

  function drawChips() {
    const q = fold(input.value);
    const list = (typed && q ? merchants.filter((m) => fold(m.name).includes(q)) : merchants).slice(0, max);
    label.hidden = !list.length;
    chipsEl.replaceChildren(
      ...list.map((m) => {
        const cat = categories.find((c) => c.id === m.categoryId);
        const on = fold(m.name) === q;
        const b = html(
          `<button type="button" class="chip" style="display:flex;align-items:center;gap:6px"><span aria-hidden="true" style="flex:none;width:8px;height:8px;border-radius:50%;box-sizing:border-box"></span><span data-n></span></button>`
        );
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
        const dot = b.firstElementChild;
        if (on) {
          b.style.background = cat ? cat.color : "#fff";
          dot.style.background = "#1B1B1F";
        } else {
          dot.style.background = cat ? cat.color : "#fff";
          dot.style.border = "1px solid rgba(27,27,31,.3)";
        }
        b.querySelector("[data-n]").textContent = m.name;
        b.addEventListener("click", () => {
          input.value = m.name;
          drawChips();
          onPick(m);
        });
        return b;
      })
    );
    if (fits) {
      const trim = () => {
        while (chipsEl.children.length > 1 && !fits()) chipsEl.lastElementChild.remove();
      };
      if (el.isConnected) trim();
      else setTimeout(trim, 0);
    }
  }

  input.addEventListener("input", () => {
    typed = true;
    drawChips();
    if (onInput) onInput(input.value.trim());
  });
  el.querySelector("[data-form]").addEventListener("submit", (e) => {
    e.preventDefault();
    onDone(input.value.trim().replace(/\s+/g, " "));
  });
  drawChips();
  // Abierto: cursor en el campo con el texto seleccionado para escribir encima.
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
  return el;
}
