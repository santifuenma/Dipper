// Pantalla "Presupuesto" (Presupuesto.dc.html).
import { api } from "../api.js";
import { back } from "../nav.js";
import { busy, html, ICON, iconSize } from "../dom.js";
import { eurosInt, monthLabel } from "../format.js";
import { categoryIcon } from "../icons.js";
import { view } from "./inicio.js";
import { bigAmount, keypad } from "../components.js";

const ROUND = "flex:none;border-radius:50%;border:1.5px solid rgba(27,27,31,.22);background:#F1EDF9;color:#1B1B1F;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0";

export function renderPresupuesto() {
  const st = { monthly: 0, bud: new Map(), cats: [], spent: new Map(), loaded: false };

  const el = html(`
    <div class="screen">
      <div class="topbar">
        <a href="#/" data-back class="icon-btn" aria-label="Volver">${ICON.back}</a>
        <span class="title">Presupuesto</span>
        <span data-month class="pill"></span>
      </div>

      <div style="flex:none;margin-top:8px" class="card-box" data-total-card>
        <div style="padding:12px 16px">
          <div style="font-size:14px;font-weight:600;color:#5A5470;text-align:center">Total del mes</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
            <button type="button" data-mdown class="round-btn" aria-label="Bajar 50 euros" style="${ROUND};width:48px;height:48px">${iconSize(ICON.minus, 22)}</button>
            <div style="display:flex;align-items:baseline;gap:6px">
              <span data-monthly data-press role="button" tabindex="0" aria-label="Escribir el total del mes" style="font-size:56px;font-weight:800;line-height:1;letter-spacing:-2.2px;cursor:pointer"></span>
              <span style="font-size:26px;font-weight:700">€</span>
            </div>
            <button type="button" data-mup class="round-btn" aria-label="Subir 50 euros" style="${ROUND};width:48px;height:48px">${iconSize(ICON.plus, 22)}</button>
          </div>
          <div data-segs style="display:flex;gap:3px;height:14px;margin-top:12px"></div>
          <div style="display:flex;justify-content:center;margin-top:10px">
            <span data-free style="font-size:15px;font-weight:800;padding:5px 14px;border-radius:99px;border:1.5px solid rgba(27,27,31,.22);transition:background .2s"></span>
          </div>
        </div>
      </div>

      <div style="flex:none;margin-top:14px;display:flex;justify-content:space-between;align-items:baseline">
        <span style="font-size:17px;font-weight:800">Por categoría</span>
        <span style="font-size:13px;font-weight:600;color:#5A5470">de 10 en 10 €</span>
      </div>

      <div data-rows class="noscroll" style="flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;margin:8px -20px 0;padding:0 20px 4px;display:flex;flex-direction:column;gap:7px"></div>

      <div style="flex:none;margin-top:8px;font-size:13px;font-weight:500;line-height:1.35;color:#5A5470">Los meses siguientes copian este reparto. Puedes cambiarlo cuando quieras.</div>
      <div class="error" role="alert"></div>
      <button type="button" data-save class="btn btn-lima" style="flex:none;margin-top:10px">Guardar presupuesto</button>
    </div>
  `);

  const q = (s) => el.querySelector(s);

  function drawTotal() {
    const assigned = st.cats.reduce((a, c) => a + st.bud.get(c.id), 0);
    const free = st.monthly - assigned;
    const over = free < 0;
    const lit = st.monthly > 0 ? Math.min(20, Math.round((assigned / st.monthly) * 20)) : 0;
    q("[data-monthly]").textContent = eurosInt(st.monthly);
    q("[data-segs]").replaceChildren(
      ...Array.from({ length: 20 }, (_, i) => {
        const s = document.createElement("span");
        s.style.cssText = "flex:1;border-radius:4px;transition:background .25s;background:" + (i < lit ? (over ? "#FF6B4A" : "#1B1B1F") : "rgba(27,27,31,.14)");
        return s;
      })
    );
    const freeEl = q("[data-free]");
    freeEl.textContent = over ? `Te pasas ${eurosInt(-free)} € del total` : free === 0 ? "Todo asignado" : `${eurosInt(free)} € sin asignar`;
    freeEl.style.background = over ? "#FFC2A1" : free === 0 ? "#CDF56B" : "#fff";
  }

  function rowFor(c) {
    const r = html(`
      <div class="card-box" style="padding:8px 10px 8px 12px;display:flex;align-items:center;gap:10px">
        <span data-ic class="ic-circle" style="width:38px;height:38px"></span>
        <span style="flex:1;min-width:0">
          <span data-name style="display:block;font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span>
          <span data-spent style="display:block;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span>
        </span>
        <button type="button" data-down class="round-btn" style="${ROUND};width:38px;height:38px">${iconSize(ICON.minus, 18)}</button>
        <span data-amount data-press role="button" tabindex="0" style="flex:none;width:58px;text-align:center;font-size:18px;font-weight:800;cursor:pointer"></span>
        <button type="button" data-up class="round-btn" style="${ROUND};width:38px;height:38px">${iconSize(ICON.plus, 18)}</button>
      </div>
    `);
    const ic = r.querySelector("[data-ic]");
    ic.style.background = c.color;
    ic.innerHTML = categoryIcon(c.icon, 20);
    r.querySelector("[data-name]").textContent = c.name;
    r.querySelector("[data-down]").setAttribute("aria-label", "Bajar 10 euros en " + c.name);
    r.querySelector("[data-up]").setAttribute("aria-label", "Subir 10 euros en " + c.name);
    const draw = () => {
      const b = st.bud.get(c.id);
      const spent = st.spent.get(c.id) || 0;
      const over = spent > b;
      const s = r.querySelector("[data-spent]");
      s.textContent = `gastado ${eurosInt(spent)} €` + (over ? " · te pasas" : "");
      s.style.color = over ? "#B3261E" : "#5A5470";
      s.style.fontWeight = over ? "700" : "500";
      r.querySelector("[data-amount]").textContent = eurosInt(b) + " €";
    };
    const adj = (d) => {
      st.bud.set(c.id, Math.max(0, st.bud.get(c.id) + d));
      draw();
      drawTotal();
    };
    r.querySelector("[data-down]").addEventListener("click", () => adj(-1000));
    r.querySelector("[data-up]").addEventListener("click", () => adj(1000));
    const amount = r.querySelector("[data-amount]");
    amount.setAttribute("aria-label", "Escribir el presupuesto de " + c.name);
    amount.addEventListener("click", () =>
      askAmount(c.name, c, (cents) => {
        st.bud.set(c.id, cents);
        draw();
        drawTotal();
      })
    );
    draw();
    return r;
  }

  // Hoja con el teclado de Nuevo gasto (sin decimales) para escribir un importe en euros.
  // Empieza vacía: lo que se escriba sustituye al importe; si no se escribe nada, no cambia.
  function askAmount(title, cat, done) {
    const bg = html(`
      <div class="sheet-bg">
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="amount-title">
          <div style="display:flex;align-items:center;gap:12px">
            ${cat ? `<span data-ic class="ic-circle"></span>` : ""}
            <span id="amount-title" style="font-size:22px;font-weight:800;letter-spacing:-.4px"></span>
          </div>
          <div data-amount-box style="margin-top:14px"></div>
          <div data-keys-box></div>
          <button type="button" data-ok class="btn btn-lima" style="margin-top:16px">Listo</button>
        </div>
      </div>
    `);
    bg.querySelector("#amount-title").textContent = title;
    if (cat) {
      const ic = bg.querySelector("[data-ic]");
      ic.style.background = cat.color;
      ic.innerHTML = categoryIcon(cat.icon, 20);
    }
    const amountEl = bigAmount("al mes");
    let typed = "";
    bg.querySelector("[data-amount-box]").append(amountEl);
    bg.querySelector("[data-keys-box]").replaceWith(
      keypad({
        decimals: false,
        maxLength: 6,
        style: "margin-top:14px;height:248px;",
        onChange: (v) => {
          typed = v;
          amountEl.show(v);
        },
      })
    );
    const close = () => {
      bg.style.transition = "opacity .25s";
      bg.style.opacity = "0";
      setTimeout(() => bg.remove(), 260);
    };
    bg.querySelector("[data-ok]").addEventListener("click", () => {
      if (typed !== "") done(Number(typed) * 100);
      close();
    });
    bg.addEventListener("click", (e) => {
      if (e.target === bg) close();
    });
    document.getElementById("app").append(bg);
  }

  q("[data-mdown]").addEventListener("click", () => {
    st.monthly = Math.max(0, st.monthly - 5000);
    drawTotal();
  });
  q("[data-mup]").addEventListener("click", () => {
    st.monthly += 5000;
    drawTotal();
  });
  q("[data-monthly]").addEventListener("click", () =>
    askAmount("Total del mes", null, (cents) => {
      st.monthly = cents;
      drawTotal();
    })
  );

  const save = q("[data-save]");
  save.addEventListener("click", async () => {
    if (!st.loaded) return;
    busy(save, true);
    try {
      await api("/budget", {
        monthlyBudgetCents: st.monthly,
        categories: st.cats.map((c) => ({ id: c.id, budgetCents: st.bud.get(c.id) })),
      });
      back("/");
    } catch (err) {
      q(".error").textContent = err.message;
      busy(save, false);
    }
  });

  api("/month?month=" + (view.month || ""))
    .then((data) => {
      q("[data-month]").textContent = monthLabel(data.month);
      st.monthly = data.monthlyBudgetCents;
      st.cats = data.categories;
      for (const c of data.categories) st.bud.set(c.id, c.budgetCents);
      for (const c of data.categories) st.spent.set(c.id, c.spentCents);
      st.loaded = true;
      q("[data-rows]").replaceChildren(...st.cats.map(rowFor));
      drawTotal();
    })
    .catch((err) => (q(".error").textContent = err.message));

  return el;
}
