// Piezas compartidas entre Inicio, Tarjeta, Categoría y Movimientos.
import { prefetch } from "./api.js";
import { html, ICON } from "./dom.js";
import { dayFull, dayKey, dayTitle, euros, timeOf } from "./format.js";
import { cardBorder, cardFg, categoryIcon } from "./icons.js";

// Agrupa pagos (ya ordenados del más reciente al más antiguo) por día.
export function groupByDay(charges, field = "occurredAt") {
  const groups = [];
  for (const c of charges) {
    const k = dayKey(c[field]);
    let g = groups[groups.length - 1];
    if (!g || g.key !== k) {
      g = { key: k, label: dayTitle(c[field]), rows: [] };
      groups.push(g);
    }
    g.rows.push(c);
  }
  return groups;
}

// Lista de movimientos agrupada por día (estilo Tarjeta.dc.html / Categoria.dc.html).
// mode "category": icono de categoría + "Categoría · hora". mode "card": punto de tarjeta + "hora · ···· 1234".
// mode "history": como "category" pero agrupado por el día en que se registró el pago, con "Categoría · tarjeta · hora de
// registro" y, si el pago es de otro día, una segunda línea con su fecha.
export function movementGroups(charges, { cats, cards, mode = "category" }) {
  const wrap = document.createElement("div");
  const history = mode === "history";
  for (const g of groupByDay(charges, history ? "createdAt" : "occurredAt")) {
    const group = html(`
      <div style="margin-top:10px">
        <div data-label class="label" style="margin:0 0 6px 4px"></div>
        <div data-rows style="border:1.5px solid rgba(27,27,31,.22);border-radius:20px;background:#fff;overflow:hidden"></div>
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
      row.href = "#/pago?id=" + c.id;
      row.addEventListener("pointerdown", () => prefetch("/charges/" + c.id), { passive: true }); // la pantalla Pago ya tiene sus datos al entrar
      if (i < g.rows.length - 1) row.style.borderBottom = "1px solid rgba(27,27,31,.08)";
      const lead = row.querySelector("[data-lead]");
      const sub = row.querySelector("[data-sub]");
      if (mode === "category" || history) {
        lead.className = "ic-circle";
        lead.style.boxSizing = "border-box";
        if (cat) {
          lead.style.background = cat.color;
          lead.innerHTML = categoryIcon(cat.icon, 20);
        } else {
          lead.style.border = "1.5px dashed rgba(27,27,31,.5)";
          lead.innerHTML = ICON.alert;
        }
        if (history) {
          const where = card ? card.name + " ···· " + card.last4 : c.walletCard || "Efectivo";
          sub.style.cssText = "display:block;font-size:13px;font-weight:500;color:#5A5470;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
          sub.textContent = `${cat ? cat.name : "Por revisar"} · ${where} · ${timeOf(c.createdAt)}`;
          if (dayKey(c.occurredAt) !== dayKey(c.createdAt)) {
            const when = document.createElement("span");
            when.style.cssText = "display:block;font-size:12px;font-weight:700;color:var(--ink)";
            when.textContent = "Pago del " + dayFull(c.occurredAt);
            sub.after(when);
          }
        } else {
          sub.textContent = (cat ? cat.name : "Por revisar") + " · " + timeOf(c.occurredAt);
        }
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
      if (c.concept) {
        const note = document.createElement("span");
        note.style.cssText = "display:block;font-size:13px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
        note.textContent = c.concept;
        row.querySelector("[data-merchant]").after(note);
      }
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
  d.style.cssText = "margin-top:10px;padding:16px;border:1.5px dashed rgba(27,27,31,.4);border-radius:20px;font-size:15px;font-weight:600;color:#5A5470;text-align:center";
  d.textContent = text;
  return d;
}

// Botón redondo con lápiz para cambiar el nombre del comercio.
export function penButton(onClick) {
  const b = html(
    `<button type="button" class="round-btn sm" aria-label="Cambiar el nombre del comercio">${ICON.edit}</button>`
  );
  b.addEventListener("click", onClick);
  return b;
}

// Línea gris con el nombre tal cual lo mandó Apple Pay.
export function rawLine(raw) {
  const d = document.createElement("div");
  d.style.cssText = "margin-top:2px;font-size:12px;font-weight:600;color:var(--faint);overflow-wrap:anywhere";
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
      <div data-label class="label" style="margin-top:12px">Tus comercios</div>
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

// Deslizar una fila hacia la izquierda (como en las apps de Apple) deja ver Editar y Borrar,
// en botones redondos como los del resto de Dipper (la papelera con borde punteado).
// Borrar pide confirmación como en Editar tarjeta: el primer toque la pone en rojo, el segundo borra.
const ACT_W = 98; // dos botones redondos de 44 px y un hueco de 10
const OPEN = ACT_W + 12; // lo que se aparta la tarjeta (con su hueco antes de los botones)

export function swipeRow(card, { editHref, onDelete, onError }) {
  const row = html(`
    <div style="position:relative">
      <div data-acts style="position:absolute;top:0;right:0;bottom:0;width:${ACT_W}px;display:flex;align-items:center;justify-content:flex-end;gap:10px;opacity:0">
        <a data-edit class="round-btn" aria-label="Editar">${ICON.edit}</a>
        <button type="button" data-del class="round-btn dash" aria-label="Borrar">${ICON.trash}</button>
      </div>
    </div>
  `);
  const acts = row.querySelector("[data-acts]");
  const edit = row.querySelector("[data-edit]");
  const del = row.querySelector("[data-del]");
  edit.href = editHref;
  card.style.position = "relative";
  card.style.touchAction = "pan-y";
  card.style.willChange = "transform";
  row.append(card);

  let x = 0; // desplazamiento actual (0 o negativo)
  let confirming = false;

  function setX(v, animate) {
    x = v;
    card.style.transition = animate ? "transform .45s cubic-bezier(.3,1.25,.5,1)" : "none";
    card.style.transform = v ? `translateX(${v}px)` : "";
    acts.style.opacity = String(Math.min(1, -v / 40));
  }
  function setConfirm(v) {
    confirming = v;
    del.classList.toggle("danger", v);
    del.setAttribute("aria-label", v ? "Toca otra vez para borrar" : "Borrar");
  }
  row.close = () => {
    setConfirm(false);
    setX(0, true);
  };
  row.isOpen = () => x !== 0;

  // Arrastre con el dedo: solo horizontal; el vertical sigue siendo scroll.
  let start = null;
  let dragged = false;
  card.addEventListener("pointerdown", (e) => {
    start = { px: e.clientX, py: e.clientY, x, id: e.pointerId, locked: null };
    dragged = false;
  });
  card.addEventListener("pointermove", (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.px;
    const dy = e.clientY - start.py;
    if (start.locked === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) start.locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (start.locked !== "x") return;
    if (!dragged) {
      dragged = true;
      try {
        card.setPointerCapture(e.pointerId);
      } catch {}
      row.dispatchEvent(new CustomEvent("swipestart", { bubbles: true }));
    }
    let v = Math.min(0, start.x + dx);
    if (v < -OPEN) v = -OPEN - (-OPEN - v) / 3; // tira con resistencia al pasarse
    setX(v, false);
  });
  const end = () => {
    if (!start) return;
    if (dragged) {
      if (confirming && x > -OPEN + 20) setConfirm(false);
      setX(x < -OPEN / 2 ? -OPEN : 0, true);
    }
    start = null;
  };
  card.addEventListener("pointerup", end);
  card.addEventListener("pointercancel", end);
  // Tras arrastrar no se abre la tarjeta; con la fila abierta, tocarla solo la cierra.
  card.addEventListener("click", (e) => {
    if (dragged || x !== 0) {
      e.preventDefault();
      if (!dragged) row.close();
      dragged = false;
    }
  });

  del.addEventListener("click", async () => {
    if (!confirming) return setConfirm(true);
    del.disabled = true;
    try {
      await onDelete();
      // Se va hacia la izquierda y la fila se cierra hacia arriba.
      row.style.overflow = "hidden";
      row.style.transition = "height .35s ease, margin .35s ease, opacity .25s";
      row.style.height = row.offsetHeight + "px";
      setX(-row.offsetWidth, true);
      requestAnimationFrame(() => {
        row.style.height = "0px";
        row.style.opacity = "0";
        row.style.marginBottom = "-10px";
      });
      setTimeout(() => row.remove(), 380);
    } catch (err) {
      del.disabled = false;
      setConfirm(false);
      if (onError) onError(err);
    }
  });
  return row;
}

// Pantalla de lista de Ajustes (Tarjetas, Categorías): título, filas y recuadro punteado para añadir.
export function listScreen(title, addHref, addLabel) {
  return html(`
    <div class="screen">
      <div class="topbar">
        <a href="#/" data-back class="icon-btn" aria-label="Volver">${ICON.back}</a>
        <span class="title">${title}</span>
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
export function swipeList(el, list) {
  const rows = [];
  const openRows = (except) => rows.filter((r) => r !== except && r.isOpen());
  list.addEventListener("swipestart", (e) => openRows(e.target).forEach((r) => r.close()));
  el.addEventListener("click", (e) => openRows(e.target.closest("[data-list] > div")).forEach((r) => r.close()));
  return rows;
}

// Tres bolitas de color que suben y bajan: la "firma" de Dipper (cuenta, registro, éxito, Por revisar).
// ring: anillo del color del fondo que las separa; outline: borde fino en lugar de anillo (recuadro del Inicio).
export function dots(size, { ring = "#fff", outline = false, colors = ["#FFC93C", "#FFA8D2", "#98EBC6"] } = {}) {
  const edge = outline ? "box-sizing:border-box;border:1.5px solid rgba(27,27,31,.4)" : `box-shadow:0 0 0 2px ${ring}`;
  return colors
    .map(
      (c, i) =>
        `<span class="wig" style="width:${size}px;height:${size}px;border-radius:50%;background:${c};${edge};margin-left:-8px${i ? `;animation-delay:${i * 0.25}s` : ""}"></span>`
    )
    .join("");
}

// Importe grande con cursor (Nuevo gasto, hoja de Presupuesto). el.show("12,5") lo pinta; vacío, un 0 gris.
export function bigAmount(label = "importe") {
  const el = html(`
    <div style="flex:none">
      <div data-label style="font-size:14px;font-weight:600;color:#5A5470"></div>
      <div style="display:flex;align-items:baseline;gap:6px">
        <span data-amount style="font-size:min(72px,8.6dvh);font-weight:800;line-height:1;letter-spacing:-3px"></span>
        <span class="caret" aria-hidden="true"></span>
        <span style="font-size:34px;font-weight:700">€</span>
      </div>
    </div>
  `);
  el.querySelector("[data-label]").textContent = label;
  const amount = el.querySelector("[data-amount]");
  el.show = (value) => {
    amount.textContent = value === "" ? "0" : value;
    amount.style.color = value === "" ? "rgba(27,27,31,.28)" : "#1B1B1F";
  };
  el.show("");
  return el;
}

// Teclado numérico de 3×4 (1–9, coma, 0, borrar). Sin decimales, el hueco de la coma queda vacío.
// Guarda el texto escrito ("12,5"); onChange lo recibe en cada tecla. maxLength cuenta también la coma.
export function keypad({ decimals = true, maxLength = 7, style = "", onChange }) {
  const grid = html(
    `<div data-keys style="${style}display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(4,minmax(0,1fr));gap:8px"></div>`
  );
  let value = "";
  const set = (v) => {
    value = v;
    onChange(value);
  };
  function press(k) {
    let a = value;
    if (k === "del") a = a.slice(0, -1);
    else if (k === ",") {
      if (!a.includes(",")) a = (a === "" ? "0" : a) + ",";
    } else {
      const i = a.indexOf(",");
      if (i >= 0 && a.length - i > 2) return;
      if (a === "0") a = k;
      else if (a.length < maxLength) a += k;
    }
    set(a);
  }
  grid.replaceChildren(
    ...["1", "2", "3", "4", "5", "6", "7", "8", "9", decimals ? "," : null, "0", "del"].map((k) => {
      if (k === null) return document.createElement("span");
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", k === "del" ? "Borrar" : k === "," ? "Coma decimal" : k);
      b.style.cssText = "min-height:0;border:1.5px solid rgba(27,27,31,.22);border-radius:16px;background:#fff;color:#1B1B1F;font-size:22px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer";
      b.setAttribute("data-press", "");
      if (k === "del") b.innerHTML = ICON.keyDelete;
      else b.textContent = k;
      b.addEventListener("click", () => press(k));
      return b;
    })
  );
  grid.setValue = set;
  return grid;
}

// Cuadrícula que se ordena arrastrando, como los iconos del iPhone: mantener pulsado HOLD ms levanta
// la pieza; al moverla, las demás se apartan con rebote para dejarle hueco; al soltar encaja y se
// avisa con el nuevo orden. Un toque normal sigue funcionando (abre la pieza).
// Las piezas se colocan con grid-row / grid-column (no se mueven en el DOM, así no se reinician
// sus animaciones). Tras rellenar la cuadrícula hay que llamar a grid.resetOrder().
export function makeReorderable(grid, { columns = 2, hold = 350, onOrder }) {
  const SPRING = "cubic-bezier(.3,1.35,.5,1)";
  const LIFT = "0 14px 30px rgba(27,27,31,.18)";
  let items = [];
  let press = null;
  let drag = null;
  let suppressUntil = 0; // el "click" que llega justo después de soltar no abre la pieza

  const place = () =>
    items.forEach((el, i) => {
      el.style.gridColumn = String((i % columns) + 1);
      el.style.gridRow = String(Math.floor(i / columns) + 1);
    });

  grid.resetOrder = () => {
    items = [...grid.children];
    for (const el of items) {
      el.style.webkitTouchCallout = "none"; // sin la vista previa de enlace de iOS al mantener pulsado
      el.style.webkitUserSelect = "none";
      el.style.userSelect = "none";
    }
    place();
  };

  // Las demás piezas se deslizan desde donde estaban a su sitio nuevo (técnica FLIP).
  function flip(change, except) {
    const before = new Map(items.map((el) => [el, el.getBoundingClientRect()]));
    change();
    for (const el of items) {
      if (el === except) continue;
      const a = before.get(el);
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (dx || dy) el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: 420, easing: SPRING });
    }
  }

  function start() {
    const el = press.el;
    const slots = items.map((x) => x.getBoundingClientRect());
    const from = items.indexOf(el);
    drag = { el, id: press.id, x0: press.x, y0: press.y, from, idx: from, slots, dx: 0, dy: 0, wob: el.classList.contains("wob") };
    press = null;
    try {
      el.setPointerCapture(drag.id);
    } catch {}
    el.classList.remove("wob"); // su temblor usa transform y no dejaría moverla
    el.style.zIndex = "5";
    el.style.transition = `transform .25s ${SPRING}, box-shadow .25s`;
    el.style.transform = "scale(1.05)";
    el.style.boxShadow = LIFT;
  }

  function move(e) {
    const d = drag;
    d.dx = e.clientX - d.x0;
    d.dy = e.clientY - d.y0;
    const home = d.slots[d.from];
    const cx = home.left + home.width / 2 + d.dx;
    const cy = home.top + home.height / 2 + d.dy;
    let best = d.idx;
    let bestDist = Infinity;
    d.slots.forEach((r, i) => {
      const dist = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    if (best !== d.idx) {
      flip(() => {
        items.splice(items.indexOf(d.el), 1);
        items.splice(best, 0, d.el);
        place();
      }, d.el);
      d.idx = best;
    }
    // La pieza sigue al dedo aunque su hueco en la cuadrícula haya cambiado.
    const slot = d.slots[d.idx];
    d.el.style.transition = "box-shadow .25s";
    d.el.style.transform = `translate(${home.left - slot.left + d.dx}px,${home.top - slot.top + d.dy}px) scale(1.05)`;
  }

  function end() {
    const d = drag;
    drag = null;
    suppressUntil = Date.now() + 500;
    d.el.style.transition = `transform .45s ${SPRING}, box-shadow .3s`;
    d.el.style.transform = "";
    d.el.style.boxShadow = "";
    setTimeout(() => {
      d.el.style.zIndex = "";
      d.el.style.transition = "";
      if (d.wob) d.el.classList.add("wob");
    }, 460);
    if (d.idx !== d.from) onOrder(items.slice());
  }

  grid.addEventListener("pointerdown", (e) => {
    const el = e.target.closest("[data-id]");
    if (!el || drag || !grid.contains(el)) return;
    press = { el, id: e.pointerId, x: e.clientX, y: e.clientY, timer: setTimeout(start, hold) };
  });
  grid.addEventListener("pointermove", (e) => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) {
      clearTimeout(press.timer);
      press = null;
    }
    if (drag && e.pointerId === drag.id) move(e);
  });
  const up = () => {
    if (press) {
      clearTimeout(press.timer);
      press = null;
    }
    if (drag) end();
  };
  grid.addEventListener("pointerup", up);
  grid.addEventListener("pointercancel", up);
  // Mientras se arrastra no hay scroll ni menú de enlace; tras arrastrar, soltar no abre la pieza.
  grid.addEventListener("touchmove", (e) => drag && e.preventDefault(), { passive: false });
  grid.addEventListener("contextmenu", (e) => e.preventDefault());
  grid.addEventListener(
    "click",
    (e) => {
      if (Date.now() > suppressUntil && !drag) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );
  return grid;
}
