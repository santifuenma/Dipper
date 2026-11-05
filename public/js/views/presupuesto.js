// Pantalla "Presupuesto" (Presupuesto.dc.html).
import { api } from "../api.js";
import { back } from "../nav.js";
import { busy, html, ICON, iconSize } from "../dom.js";
import { eurosInt, monthLabel } from "../format.js";
import { view } from "./inicio.js";
import { askAmount, budgetRow, ROUND } from "../components.js";

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

  const rowFor = (c) =>
    budgetRow(c, {
      get: () => st.bud.get(c.id),
      set: (cents) => st.bud.set(c.id, cents),
      spent: st.spent.get(c.id) || 0,
      onChange: drawTotal,
    });

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
