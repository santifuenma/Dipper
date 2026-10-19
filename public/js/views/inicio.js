// Pantalla "Inicio" (Inicio.dc.html).
import { dots, makeReorderable } from "../components.js";
import { api } from "../api.js";
import { session } from "../app.js";
import { busy, html, ICON, iconSize } from "../dom.js";
import { eurosInt, monthLabel, shiftMonth } from "../format.js";
import { cardBorder, cardFg, categoryIcon } from "../icons.js";
import { enableFaceId, faceIdEnabledHere, faceIdError, passkeySupported } from "../passkey.js";

// Mes que se está viendo; se conserva al ir y volver de otras pantallas.
export const view = { month: null };

const ASK_KEY = "dipper_faceid_ask";

export function renderInicio() {
  const el = html(`
    <div class="screen">
      <div class="topbar">
        <div style="display:flex;align-items:center;gap:2px">
          <button type="button" data-prev class="icon-btn" aria-label="Mes anterior">${ICON.back}</button>
          <span data-month class="title"></span>
          <button type="button" data-next class="icon-btn" style="margin-left:0" aria-label="Mes siguiente">${ICON.forward}</button>
        </div>
        <div style="display:flex;gap:8px">
          <a href="#/presupuesto" data-press aria-label="Presupuesto" class="round-btn">${ICON.sliders}</a>
          <a href="#/ajustes" data-press aria-label="Ajustes" class="round-btn dash">${ICON.gear}</a>
        </div>
      </div>

      <div style="flex:none;margin-top:10px;display:flex;flex-direction:column">
        <div data-spent-label style="font-size:15px;font-weight:600;color:#5A5470"></div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-top:2px">
          <span data-total style="font-size:min(92px,10.8dvh);font-weight:800;line-height:.9;letter-spacing:-3.5px">0</span>
          <span style="font-size:38px;font-weight:700">€</span>
        </div>
        <div data-sub style="font-size:17px;font-weight:700;margin-top:4px;min-height:22px"></div>
        <div data-segs style="flex:none;display:flex;gap:3px;height:14px;margin-top:10px"></div>
      </div>

      <div data-cards class="noscroll" style="flex:none;margin:8px -20px 0;padding:10px 20px 6px;overflow-x:hidden;overscroll-behavior-x:contain;scroll-padding-left:20px">
        <div data-track style="position:relative;height:min(120px,14dvh)"></div>
      </div>

      <div data-tiles style="margin-top:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;flex:1 1 0;min-height:0"></div>

      <div style="display:flex;gap:12px;margin-top:12px;flex:none">
        <a href="#/por-revisar" data-press style="flex:1;min-width:0;height:min(64px,7.6dvh);box-sizing:border-box;border:1.5px dashed rgba(27,27,31,.4);border-radius:24px;display:flex;align-items:center;gap:14px;padding:0 16px">
          <span aria-hidden="true" style="display:flex;padding-left:8px">
            ${dots(24, { outline: true, colors: ["#FFC93C", "#CDB6FF", "#98EBC6"] })}
          </span>
          <span style="display:block;min-width:0">
            <span data-pending style="display:block;font-size:17px;font-weight:800"></span>
            <span style="display:block;font-size:13px;font-weight:500;color:#5A5470">Pagos nuevos sin categoría</span>
          </span>
        </a>
        <a href="#/nuevo-gasto" data-press aria-label="Añadir gasto" style="flex:none;width:min(64px,7.6dvh);height:min(64px,7.6dvh);box-sizing:border-box;border-radius:50%;border:1.5px solid rgba(27,27,31,.22);background:#CDF56B;display:flex;align-items:center;justify-content:center">
          ${iconSize(ICON.plus, 28)}
        </a>
      </div>
      <div class="error" role="alert" style="text-align:center"></div>
    </div>
  `);

  const q = (s) => el.querySelector(s);
  const prev = q("[data-prev]");
  const next = q("[data-next]");
  let data = null;
  let loadId = 0;

  function segs(spent, budget) {
    const lit = budget > 0 ? Math.min(20, Math.round((spent / budget) * 20)) : 0;
    return Array.from({ length: 20 }, (_, i) => {
      const s = document.createElement("span");
      s.style.cssText = "flex:1;border-radius:4px;background:" + (i < lit ? "#1B1B1F" : "rgba(27,27,31,.14)");
      return s;
    });
  }

  // Tarjetas en abanico: plegadas, la de más gasto del mes va a la izquierda y encima y las
  // demás asoman por su derecha, repartidas hasta el borde. Al tocarlas se despliegan en fila; tocar fuera las pliega.
  const CARD_W = 204;
  const CARD_GAP = 12;
  // Plegadas, lo que asoma cada tarjeta de detrás: el hueco a la derecha repartido entre ellas.
  const peek = (n) => (n > 1 ? Math.max(26, (Math.min(window.innerWidth, 480) - 40 - CARD_W) / (n - 1)) : 0);
  let expanded = false;
  let cardEls = [];

  function layoutCards(animate) {
    const n = cardEls.length;
    const open = expanded || n <= 1;
    const wrap = q("[data-cards]");
    const track = q("[data-track]");
    const PEEK = peek(n);
    track.style.width = (open ? n * CARD_W + (n - 1) * CARD_GAP : CARD_W + (n - 1) * PEEK) + "px";
    wrap.style.overflowX = open ? "auto" : "hidden";
    wrap.style.scrollSnapType = open ? "x mandatory" : "none";
    cardEls.forEach((a, i) => {
      a.style.transition = animate
        ? `left .6s cubic-bezier(.3,1.25,.5,1) ${(open ? i : n - 1 - i) * 35}ms, box-shadow .3s`
        : "none";
      a.style.left = (open ? i * (CARD_W + CARD_GAP) : i * PEEK) + "px";
      a.style.boxShadow = open || i === n - 1 ? "none" : "6px 0 12px rgba(27,27,31,.14)";
      // Plegadas, solo la de encima enseña lo gastado (de las demás asomaría un trozo de la pastilla).
      const pill = a.querySelector("[data-spent]");
      pill.style.transition = "opacity .3s";
      pill.style.opacity = open || i === 0 ? "1" : "0";
    });
  }

  function setExpanded(v) {
    if (expanded === v) return;
    expanded = v;
    if (!v) q("[data-cards]").scrollTo({ left: 0, behavior: "smooth" });
    layoutCards(true);
  }

  function drawCards() {
    const sorted = [...data.cards].sort((a, b) => b.spentCents - a.spentCents || a.id - b.id);
    cardEls = sorted.map((c, i) => {
      const a = html(`
        <a data-card style="position:absolute;top:0;width:${CARD_W}px;height:100%;scroll-snap-align:start;box-sizing:border-box;padding:14px;border:1.5px solid rgba(27,27,31,.22);border-radius:20px;display:flex;flex-direction:column;justify-content:space-between">
          <span style="display:flex;justify-content:space-between;align-items:center">
            <span data-name style="font-size:17px;font-weight:800;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span>
            <span aria-hidden="true" style="display:flex;flex:none">
              <span style="width:18px;height:18px;box-sizing:border-box;border-radius:50%;border:2px solid currentColor"></span>
              <span style="width:18px;height:18px;margin-left:-8px;border-radius:50%;background:currentColor"></span>
            </span>
          </span>
          <span style="display:flex;justify-content:space-between;align-items:flex-end">
            <span>
              <span aria-hidden="true" style="display:block;width:26px;height:19px;box-sizing:border-box;border-radius:5px;border:2px solid currentColor;margin-bottom:7px"></span>
              <span data-last style="font-size:14px;font-weight:600;letter-spacing:1.5px"></span>
            </span>
            <span data-spent style="font-size:15px;font-weight:800;padding:4px 10px;border-radius:99px;background:#fff;color:#1B1B1F"></span>
          </span>
        </a>
      `);
      a.href = `#/ver-tarjeta?id=${c.id}`;
      a.style.zIndex = String(sorted.length - i);
      a.style.background = c.color;
      a.style.color = cardFg(c.color);
      a.style.borderColor = cardBorder(c.color);
      a.querySelector("[data-name]").textContent = c.name;
      a.querySelector("[data-last]").textContent = "···· " + c.last4;
      a.querySelector("[data-spent]").textContent = eurosInt(c.spentCents) + " €";
      a.addEventListener("click", (e) => {
        // Plegadas, el primer toque solo las despliega.
        if (!expanded && sorted.length > 1) {
          e.preventDefault();
          setExpanded(true);
        }
      });
      return a;
    });
    if (!cardEls.length) {
      // Sin tarjetas: un hueco para añadir la primera (el resto se añade desde Ajustes).
      const add = html(`
        <a href="#/tarjeta" data-press style="position:absolute;top:0;left:0;width:${CARD_W}px;height:100%;box-sizing:border-box;border:1.5px dashed rgba(27,27,31,.4);border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:700">
          ${iconSize(ICON.plus, 24)}
          Añadir tu primera tarjeta
        </a>
      `);
      q("[data-track]").replaceChildren(add);
      q("[data-track]").style.width = CARD_W + "px";
      return;
    }
    q("[data-track]").replaceChildren(...cardEls);
    layoutCards(false);
  }

  // Tocar fuera de las tarjetas (o en el hueco entre ellas) las vuelve a plegar.
  el.addEventListener("click", (e) => {
    if (expanded && !e.target.closest("[data-card]")) setExpanded(false);
  });

  function drawTiles() {
    const tiles = q("[data-tiles]");
    tiles.style.gridTemplateRows = `repeat(${Math.max(3, Math.ceil(data.categories.length / 2))},minmax(84px,1fr))`;
    tiles.replaceChildren(
      ...data.categories.map((t) => {
        const spent = t.spentCents;
        const over = t.budgetCents > 0 && spent > t.budgetCents;
        const a = html(`
          <a data-press style="display:block;position:relative;overflow:hidden;min-height:0;box-sizing:border-box;border:1.5px solid rgba(27,27,31,.1);border-radius:20px;background:#fff">
            <div data-fill class="fill"></div>
            <div style="position:relative;z-index:2;height:100%;box-sizing:border-box;padding:10px 12px;display:flex;flex-direction:column;justify-content:space-between">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <span data-ic></span>
                <span data-over hidden style="font-size:12px;font-weight:800;padding:3px 8px;border-radius:99px;background:#1B1B1F;color:#FFC2A1"></span>
              </div>
              <div>
                <div data-name style="font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>
                <div style="display:flex;align-items:baseline;gap:5px">
                  <span data-amount style="font-size:25px;font-weight:800;letter-spacing:-.6px;line-height:1.1"></span>
                  <span data-of style="font-size:13px;font-weight:600;opacity:.75"></span>
                </div>
                <div data-left hidden style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>
              </div>
            </div>
          </a>
        `);
        a.href = `#/ver-categoria?id=${t.id}`;
        a.dataset.id = t.id;
        if (over) a.classList.add("wob");
        const fill = a.querySelector("[data-fill]");
        fill.style.color = t.color;
        fill.style.height = (t.budgetCents > 0 ? Math.min(100, (spent / t.budgetCents) * 100) : 0) + "%";
        a.querySelector("[data-ic]").innerHTML = categoryIcon(t.icon, 24, 2);
        a.querySelector("[data-name]").textContent = t.name;
        a.querySelector("[data-amount]").textContent = eurosInt(spent) + " €";
        a.querySelector("[data-of]").textContent = t.budgetCents > 0 ? "de " + eurosInt(t.budgetCents) : "";
        // Lo que queda (calculado en el servidor): "Quedan 22 €" o, si se ha llegado o pasado, "Sin margen".
        // Con menos de 0,50 € el redondeo daría "Quedan 0 €": también es "Sin margen".
        if (t.budgetCents > 0) {
          const left = a.querySelector("[data-left]");
          left.hidden = false;
          left.textContent = t.leftCents >= 50 ? `Quedan ${eurosInt(t.leftCents)} €` : "Sin margen";
        }
        if (over) {
          const pill = a.querySelector("[data-over]");
          pill.hidden = false;
          pill.textContent = "+" + eurosInt(spent - t.budgetCents) + " €";
        }
        return a;
      })
    );
    tiles.resetOrder();
  }

  // Mantener pulsada una categoría y arrastrarla cambia el orden en toda la app.
  makeReorderable(q("[data-tiles]"), {
    onOrder: (els) => {
      const ids = els.map((a) => Number(a.dataset.id));
      data.categories.sort((x, y) => ids.indexOf(x.id) - ids.indexOf(y.id));
      api("/categories/order", { ids }).catch((err) => (q(".error").textContent = err.message));
    },
  });

  function draw() {
    const m = view.month || (data && data.current);
    if (!m) return;
    q("[data-month]").textContent = monthLabel(m);
    q("[data-spent-label]").textContent = "gastado en " + monthLabel(m);
    next.disabled = !data || m >= data.current;
    next.style.opacity = next.disabled ? ".25" : "1";
    if (!data) return;

    // Las cifras vienen calculadas del servidor; aquí solo se ponen en pantalla.
    q("[data-total]").textContent = eurosInt(data.totalCents);
    q("[data-sub]").textContent = data.leftCents >= 0 ? `quedan ${eurosInt(data.leftCents)} € de aire` : `te pasaste ${eurosInt(-data.leftCents)} €`;
    q("[data-segs]").replaceChildren(...segs(data.totalCents, data.monthlyBudgetCents));
    q("[data-pending]").textContent = data.pendingCount ? `${data.pendingCount} por revisar` : "Nada por revisar";
    drawCards();
    drawTiles();
  }

  async function load() {
    const id = ++loadId;
    try {
      const res = await api("/month" + (view.month ? "?month=" + view.month : ""));
      if (id !== loadId) return;
      data = res;
      if (!view.month) view.month = res.month;
      draw();
    } catch (err) {
      q(".error").textContent = err.message;
    }
  }

  prev.addEventListener("click", () => {
    view.month = shiftMonth(view.month || data.current, -1);
    load();
  });
  next.addEventListener("click", () => {
    if (next.disabled) return;
    view.month = shiftMonth(view.month, 1);
    load();
  });

  draw();
  load();
  maybeAskFaceId(el);
  return el;
}

// "¿Entrar con Face ID la próxima vez?": una sola vez, tras entrar con contraseña.
function maybeAskFaceId(screen) {
  if (!session.justLoggedIn) return;
  session.justLoggedIn = false;
  let asked = false;
  try {
    asked = localStorage.getItem(ASK_KEY) === "no";
  } catch {}
  if (asked || !passkeySupported() || faceIdEnabledHere()) return;

  const bg = html(`
    <div class="sheet-bg">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="faceid-title">
        <span aria-hidden="true" style="display:flex;padding-left:8px;margin-bottom:14px">
          ${dots(26)}
        </span>
        <div id="faceid-title" style="font-size:28px;font-weight:800;letter-spacing:-.8px;line-height:1.05">¿Entrar con Face ID la próxima vez?</div>
        <div style="margin-top:8px;font-size:16px;font-weight:500;line-height:1.35;color:#5A5470">Así no tendrás que escribir la contraseña.</div>
        <div class="error" role="alert" style="margin-top:10px"></div>
        <button type="button" data-yes class="btn btn-lima" style="margin-top:18px">Activar</button>
        <button type="button" data-no class="btn btn-white" style="margin-top:10px">Ahora no</button>
      </div>
    </div>
  `);
  const close = () => {
    bg.style.transition = "opacity .25s";
    bg.style.opacity = "0";
    setTimeout(() => bg.remove(), 260);
  };
  bg.querySelector("[data-no]").addEventListener("click", () => {
    try {
      localStorage.setItem(ASK_KEY, "no");
    } catch {}
    close();
  });
  const yes = bg.querySelector("[data-yes]");
  yes.addEventListener("click", async () => {
    busy(yes, true);
    try {
      await enableFaceId();
      close();
    } catch (err) {
      bg.querySelector(".error").textContent = faceIdError(err);
      busy(yes, false);
    }
  });
  // Se coloca sobre el contenedor fijo (no dentro de la pantalla, que puede tener scroll).
  setTimeout(() => {
    if (screen.isConnected) document.getElementById("app").append(bg);
  }, 700);
}
