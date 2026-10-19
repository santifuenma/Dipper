// Pantalla "Nuevo gasto" (NuevoGasto.dc.html). Sube desde abajo; se cierra con la ✕.
import { api } from "../api.js";
import { back } from "../nav.js";
import { busy, html, ICON, iconSize } from "../dom.js";
import { dayLabel } from "../format.js";
import { categoryIcon } from "../icons.js";
import { bigAmount, cardChips, keypad } from "../components.js";


export function renderNuevoGasto() {
  const st = { amount: "", cat: null, card: null, date: "hoy", other: null, cats: [], cards: [], saving: false };

  const el = html(`
    <div class="screen" style="gap:10px">
      <div class="topbar">
        <a href="#/" data-back class="icon-btn" aria-label="Cerrar">${ICON.close}</a>
        <span class="title">Nuevo gasto</span>
        <span style="width:44px"></span>
      </div>

      <div data-amount-box></div>

      <label class="field" style="flex:none;height:50px">
        <span style="display:flex;color:var(--muted)">${ICON.store}</span>
        <input name="merchant" type="text" maxlength="80" aria-label="Comercio o nota" placeholder="¿Dónde? Mercadona, gasolina…">
      </label>

      <div style="flex:none">
        <div class="label" style="margin-bottom:6px">Categoría</div>
        <div data-cats class="noscroll" style="display:flex;gap:8px;overflow-x:auto;margin:0 -20px;padding:2px 20px"></div>
      </div>

      <div style="flex:none">
        <div class="label" style="margin-bottom:6px">Tarjeta</div>
        <div data-cards class="noscroll" style="display:flex;gap:8px;overflow-x:auto;margin:-4px -20px 0;padding:8px 20px"></div>
      </div>

      <div style="flex:none">
        <div class="label" style="margin-bottom:6px">Fecha</div>
        <div data-dates style="display:flex;gap:8px"></div>
      </div>

      <div data-keys-box></div>

      <div class="error" role="alert"></div>
      <button type="button" data-save class="btn btn-lima" style="flex:none" disabled>Guardar gasto</button>
    </div>
  `);

  const q = (s) => el.querySelector(s);
  const value = () => parseFloat(st.amount.replace(",", ".")) || 0;
  const canSave = () => value() > 0 && st.cat !== null && !st.saving;

  // Importe y teclado: los mismos componentes que la hoja de Presupuesto.
  const amountEl = bigAmount();
  q("[data-amount-box]").replaceWith(amountEl);
  const keys = keypad({
    style: "flex:1;min-height:150px;",
    onChange: (v) => {
      st.amount = v;
      draw();
    },
  });
  q("[data-keys-box]").replaceWith(keys);

  function drawAmount() {
    amountEl.show(st.amount);
    q("[data-save]").disabled = !canSave();
  }

  function drawCats() {
    q("[data-cats]").replaceChildren(
      ...st.cats.map((c) => {
        const on = st.cat === c.id;
        const b = html(`<button type="button" style="flex:none;height:44px;box-sizing:border-box;padding:0 14px 0 12px;border-radius:99px;display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:#1B1B1F;cursor:pointer;white-space:nowrap;transition:background .2s,transform .3s cubic-bezier(.3,1.6,.5,1)"></button>`);
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.style.background = on ? c.color : "#fff";
        b.style.border = on ? "1.5px solid #1B1B1F" : "1.5px solid rgba(27,27,31,.22)";
        b.style.transform = on ? "translateY(-2px)" : "none";
        b.innerHTML = categoryIcon(c.icon, 20);
        b.append(c.name);
        b.addEventListener("click", () => {
          st.cat = c.id;
          drawCats();
          drawAmount();
        });
        return b;
      })
    );
  }

  function drawCards() {
    q("[data-cards]").replaceChildren(
      ...cardChips(st.cards, st.card, (id) => {
        st.card = id;
        drawCards();
      })
    );
  }

  // Las pastillas de fecha se crean una vez y luego solo se actualizan: si se redibujaran
  // mientras el calendario del iPhone está abierto, este se cerraría solo.
  const PILL = "position:relative;height:40px;box-sizing:border-box;padding:0 14px;border-radius:99px;display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;overflow:hidden";
  const datePills = {};

  function buildDates() {
    const box = q("[data-dates]");
    for (const [id, label] of [["hoy", "Hoy"], ["ayer", "Ayer"]]) {
      const b = html(`<button type="button" style="${PILL}"></button>`);
      b.textContent = label;
      b.addEventListener("click", () => {
        st.date = id;
        updateDates();
      });
      datePills[id] = b;
      box.append(b);
    }
    // "Otra fecha": no es un botón, sino una etiqueta con el selector de fecha nativo encima (invisible).
    const otra = html(`<label style="${PILL}">${ICON.calendar}<span data-otra-txt>Otra fecha</span></label>`);
    const input = document.createElement("input");
    input.type = "date";
    input.setAttribute("aria-label", "Otra fecha");
    input.max = new Date().toISOString().slice(0, 10);
    input.style.cssText = "position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;-webkit-appearance:none;appearance:none;font-size:16px";
    input.addEventListener("change", () => {
      if (!input.value) return;
      const [y, m, d] = input.value.split("-").map(Number);
      st.other = new Date(y, m - 1, d, 12).getTime();
      st.date = "otra";
      updateDates();
    });
    otra.append(input);
    datePills.otra = otra;
    box.append(otra);
  }

  function updateDates() {
    for (const [id, b] of Object.entries(datePills)) {
      const on = st.date === id;
      b.style.background = on ? "#1B1B1F" : "#fff";
      b.style.color = on ? "#fff" : "#1B1B1F";
      b.style.border = on ? "1.5px solid #1B1B1F" : "1.5px solid rgba(27,27,31,.22)";
      if (b.tagName === "BUTTON") b.setAttribute("aria-pressed", on ? "true" : "false");
    }
    datePills.otra.querySelector("[data-otra-txt]").textContent = st.date === "otra" && st.other ? dayLabel(st.other) : "Otra fecha";
  }

  function draw() {
    drawAmount();
  }

  function when() {
    if (st.date === "ayer") return Date.now() - 86400000;
    if (st.date === "otra" && st.other) return st.other;
    return Date.now();
  }

  function showDone() {
    const cat = st.cats.find((c) => c.id === st.cat);
    const card = st.cards.find((k) => k.id === st.card);
    const done = html(`
      <div style="position:absolute;inset:0;z-index:10;background:#F1EDF9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:32px;text-align:center">
        <div style="position:relative;width:200px;height:200px;margin-bottom:12px">
          <div class="plop" style="position:absolute;inset:0;box-sizing:border-box;border-radius:56px;border:1.5px solid rgba(27,27,31,.22);background:#fff;overflow:hidden">
            <div data-fill style="position:absolute;left:0;right:0;bottom:0;height:62%"></div>
          </div>
          <span class="plop" style="position:absolute;left:68px;top:68px;display:flex;color:var(--ink)">${iconSize(ICON.check, 64)}</span>
        </div>
        <div data-title style="font-size:30px;font-weight:800;letter-spacing:-.8px"></div>
        <div data-sub style="font-size:16px;font-weight:600;color:#5A5470"></div>
        <button type="button" data-again class="btn btn-lima" style="margin-top:18px">Añadir otro</button>
        <button type="button" data-home class="btn btn-white">Volver al inicio</button>
      </div>
    `);
    done.querySelector("[data-fill]").style.background = cat ? cat.color : "#CDF56B";
    done.querySelector("[data-title]").textContent = "Pegado en " + (cat ? cat.name : "");
    done.querySelector("[data-sub]").textContent = `${st.amount} € · ${card ? card.name : "Efectivo"} · ${dayLabel(when())}`;
    done.querySelector("[data-again]").addEventListener("click", () => {
      keys.setValue("");
      st.cat = null;
      q("[name=merchant]").value = "";
      done.remove();
      drawCats();
      draw();
    });
    done.querySelector("[data-home]").addEventListener("click", () => back("/"));
    el.append(done);
  }

  const save = q("[data-save]");
  save.addEventListener("click", async () => {
    if (!canSave()) return;
    st.saving = true;
    busy(save, true);
    try {
      await api("/charges", {
        amountCents: Math.round(value() * 100),
        merchant: q("[name=merchant]").value.trim(),
        categoryId: st.cat,
        cardId: st.card,
        date: when(),
      });
      showDone();
    } catch (err) {
      q(".error").textContent = err.message;
    } finally {
      st.saving = false;
      busy(save, false);
      drawAmount();
    }
  });

  buildDates();
  updateDates();
  draw();
  api("/month")
    .then((data) => {
      st.cats = data.categories;
      st.cards = data.cards;
      st.card = data.cards.length ? data.cards[0].id : null;
      drawCats();
      drawCards();
    })
    .catch((err) => (q(".error").textContent = err.message));

  return el;
}
