// Pantalla "Bienvenida": el recorrido de las cuentas nuevas. Ocho pasos, todos saltables salvo el primero y el último;
// el servidor recuerda en cuál vas (se retoma aunque cierres la app o vayas a Tarjeta o Apple Pay y vuelvas).
import { api } from "../api.js";
import { go, session } from "../app.js";
import { askAmount, budgetRow, dots, ROUND } from "../components.js";
import { busy, html, ICON, iconSize } from "../dom.js";
import { eurosInt } from "../format.js";
import { cardBorder, cardFg } from "../icons.js";
import { enableFaceId, faceIdEnabledHere, faceIdError, passkeySupported } from "../passkey.js";
import { enablePush, pushSupported } from "../push.js";
import { applePayGuide } from "./applepay.js";

const STEPS = ["bienvenida", "presupuesto", "categorias", "tarjetas", "applepay", "avisos", "faceid", "listo"];
const DONE = STEPS.length; // 8

// Guarda en qué paso vas, en el servidor y en la sesión (así lo sabe el resto de la app).
function saveStep(step) {
  const u = session.user;
  if (u) session.user = { ...u, onboarding: { ...(u.onboarding || {}), step } };
  return api("/onboarding", { step }).catch(() => {});
}

const standalone = () => window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;

// Paso numerado con pastilla de color (el mismo de Conectar Apple Pay).
function numbered(n, color, title, body) {
  const c = html(`
    <div class="card-box" style="padding:11px 14px;display:flex;gap:12px;align-items:flex-start">
      <span data-badge style="flex:none;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800"></span>
      <span style="flex:1;min-width:0">
        <span data-title style="display:block;font-size:17px;font-weight:800;letter-spacing:-.2px"></span>
        <span data-body style="display:block;margin-top:2px;font-size:14px;font-weight:500;line-height:1.35;color:#5A5470"></span>
      </span>
    </div>
  `);
  const b = c.querySelector("[data-badge]");
  b.style.background = color;
  if (typeof n === "string" && n.startsWith("<")) b.innerHTML = n;
  else b.textContent = String(n);
  c.querySelector("[data-title]").textContent = title;
  c.querySelector("[data-body]").textContent = body;
  return c;
}

// Recuadro punteado con una nota (como el de Conectar Apple Pay).
function note(text) {
  const n = html(`<div style="margin-top:10px;display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1.5px dashed rgba(27,27,31,.4);border-radius:16px">${ICON.info}<span data-t style="font-size:14px;font-weight:600;line-height:1.35"></span></div>`);
  n.querySelector("[data-t]").textContent = text;
  return n;
}

export function renderOnboarding() {
  const first = (session.user.name || "").trim().split(/\s+/)[0];
  let step = Math.min(Math.max(session.user.onboarding ? session.user.onboarding.step : 0, 0), DONE - 1);
  // Datos que se van necesitando (se piden una vez, al empezar).
  const data = { monthly: 150000, cats: [], bud: new Map(), loaded: null };

  const el = html(`
    <div class="screen">
      <div class="topbar">
        <button type="button" data-prev class="icon-btn" aria-label="Paso anterior">${ICON.back}</button>
        <div data-progress style="display:flex;gap:4px;width:136px" role="img"></div>
        <button type="button" data-skip style="font-size:15px;font-weight:700;padding:10px 0;text-decoration:underline;min-width:44px;text-align:right;cursor:pointer;background:none;border:0;color:inherit">Saltar</button>
      </div>
      <div style="flex:none;margin-top:8px">
        <h1 data-title style="margin:0;font-size:32px;font-weight:800;letter-spacing:-1.2px;line-height:1.04"></h1>
        <div data-sub style="margin-top:6px;font-size:15px;font-weight:500;line-height:1.3;color:#5A5470"></div>
      </div>
      <div data-body style="flex:1;min-height:0;margin-top:12px;display:flex;flex-direction:column"></div>
      <div class="error" role="alert"></div>
      <div style="flex:none;margin-top:10px">
        <button type="button" data-main class="btn btn-lima"></button>
        <button type="button" data-alt class="link-u" style="display:block;margin:8px auto 0;font-size:15px" hidden></button>
      </div>
    </div>
  `);
  const q = (s) => el.querySelector(s);
  const error = q(".error");
  const main = q("[data-main]");
  const alt = q("[data-alt]");
  const body = q("[data-body]");
  let prevHook = null; // un paso con subpasos (Apple Pay) usa "atrás" primero para sus propios subpasos
  let token = 0; // si cambias de paso mientras algo carga, lo que llegue tarde se ignora

  // Datos del presupuesto: el total y las categorías con sus importes actuales.
  const loadBudget = () =>
    (data.loaded ||= api("/month").then((m) => {
      data.monthly = m.monthlyBudgetCents;
      data.cats = m.categories;
      for (const c of m.categories) data.bud.set(c.id, c.budgetCents);
    }));

  function frame(title, sub, { mainLabel, onMain, altLabel, onAlt, skip = true, prev = true }) {
    q("[data-title]").textContent = title;
    q("[data-sub]").textContent = sub;
    error.textContent = "";
    prevHook = null;
    main.textContent = mainLabel;
    // El botón es el mismo en todos los pasos: se libera aquí (un "ocupado" del paso anterior le quita los toques).
    busy(main, false);
    main.disabled = false;
    main.onclick = onMain;
    alt.hidden = !altLabel;
    if (altLabel) {
      alt.textContent = altLabel;
      alt.onclick = onAlt;
    }
    q("[data-skip]").style.visibility = skip ? "visible" : "hidden";
    q("[data-prev]").style.visibility = prev && step > 0 ? "visible" : "hidden";
    q("[data-progress]").setAttribute("aria-label", `Paso ${step + 1} de ${DONE}`);
    q("[data-progress]").replaceChildren(
      ...STEPS.map((_, i) => {
        const s = document.createElement("span");
        s.style.cssText = `flex:1;height:8px;border-radius:4px;background:${i <= step ? "#1B1B1F" : "rgba(27,27,31,.14)"};transition:background .25s`;
        return s;
      })
    );
  }

  const next = () => goTo(step + 1);
  async function goTo(n) {
    if (n >= DONE) {
      busy(main, true);
      await saveStep(DONE);
      return go("/");
    }
    step = n;
    await saveStep(step);
    draw();
  }

  // ── Pasos ──────────────────────────────────────────────────────────────────

  function bienvenida() {
    frame(first ? `Hola, ${first}` : "Hola", "Dipper te dice cuánto aire te queda este mes. Así funciona:", {
      mainLabel: "Empezar",
      onMain: next,
      skip: false,
    });
    const list = html(`<div style="display:flex;flex-direction:column;gap:8px"></div>`);
    list.append(
      numbered(1, "#FFC93C", "Tus pagos llegan solos", "Cada pago con Apple Pay aparece en Dipper al momento."),
      numbered(2, "#FFA8D2", "Tú los colocas", "Eliges la categoría una vez y Dipper la recuerda para ese comercio."),
      numbered(3, "#98EBC6", "Ves cuánto te queda", "Por categoría y en el mes entero, con lo que te queda de aire.")
    );
    body.replaceChildren(list, note("Son unos 2 minutos. Puedes saltar lo que quieras y hacerlo luego desde Ajustes."));
    loadBudget().catch(() => {});
  }

  function presupuesto() {
    frame("¿Cuánto quieres gastar al mes?", "Es el techo de tu mes. Lo puedes cambiar cuando quieras.", {
      mainLabel: "Continuar",
      onMain: async () => {
        busy(main, true);
        try {
          await saveBudget();
          next();
        } catch (err) {
          error.textContent = err.message;
          busy(main, false);
        }
      },
    });
    const card = html(`
      <div class="card-box" style="padding:18px 16px">
        <div style="font-size:14px;font-weight:600;color:#5A5470;text-align:center">Total del mes</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
          <button type="button" data-down class="round-btn" aria-label="Bajar 50 euros" style="${ROUND};width:52px;height:52px">${iconSize(ICON.minus, 22)}</button>
          <div style="display:flex;align-items:baseline;gap:6px">
            <span data-amount data-press role="button" tabindex="0" aria-label="Escribir el total del mes" style="font-size:64px;font-weight:800;line-height:1;letter-spacing:-2.6px;cursor:pointer"></span>
            <span style="font-size:28px;font-weight:700">€</span>
          </div>
          <button type="button" data-up class="round-btn" aria-label="Subir 50 euros" style="${ROUND};width:52px;height:52px">${iconSize(ICON.plus, 22)}</button>
        </div>
        <div style="margin-top:12px;font-size:13px;font-weight:500;line-height:1.35;color:#5A5470;text-align:center">Toca el importe para escribirlo. Con − y + sube de 50 en 50 €.</div>
      </div>
    `);
    const draw = () => (card.querySelector("[data-amount]").textContent = eurosInt(data.monthly));
    card.querySelector("[data-down]").addEventListener("click", () => {
      data.monthly = Math.max(0, data.monthly - 5000);
      draw();
    });
    card.querySelector("[data-up]").addEventListener("click", () => {
      data.monthly += 5000;
      draw();
    });
    card.querySelector("[data-amount]").addEventListener("click", () =>
      askAmount("Total del mes", null, (cents) => {
        data.monthly = cents;
        draw();
      })
    );
    draw();
    body.replaceChildren(card, note("Piensa en lo que gastas en un mes normal, sin el alquiler ni los recibos fijos si no los vas a apuntar."));
    const my = ++token;
    main.disabled = true;
    loadBudget()
      .then(() => {
        if (my !== token) return;
        main.disabled = false;
        draw();
      })
      .catch((err) => {
        if (my === token) error.textContent = err.message;
      });
  }

  async function saveBudget() {
    await loadBudget();
    await api("/budget", { monthlyBudgetCents: data.monthly, categories: data.cats.map((c) => ({ id: c.id, budgetCents: data.bud.get(c.id) })) });
  }

  function categorias() {
    frame("Reparte tu presupuesto", "Cuánto quieres gastar en cada categoría.", {
      mainLabel: "Continuar",
      onMain: async () => {
        busy(main, true);
        try {
          await saveBudget();
          next();
        } catch (err) {
          error.textContent = err.message;
          busy(main, false);
        }
      },
    });
    const pill = html(`<div style="flex:none;display:flex;justify-content:center"><span data-free style="font-size:15px;font-weight:800;padding:5px 14px;border-radius:99px;border:1.5px solid rgba(27,27,31,.22);transition:background .2s"></span></div>`);
    const rows = html(`<div class="noscroll" style="flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;margin:10px -20px 0;padding:0 20px 4px;display:flex;flex-direction:column;gap:7px"></div>`);
    const hint = html(`<div style="flex:none;margin-top:8px;font-size:13px;font-weight:500;line-height:1.35;color:#5A5470">Añadir, quitar o cambiar categorías: Ajustes → Categorías.</div>`);
    const drawFree = () => {
      const free = data.monthly - [...data.bud.values()].reduce((a, b) => a + b, 0);
      const f = pill.querySelector("[data-free]");
      f.textContent = free < 0 ? `Te pasas ${eurosInt(-free)} € de ${eurosInt(data.monthly)} €` : free === 0 ? "Todo asignado" : `${eurosInt(free)} € sin asignar de ${eurosInt(data.monthly)} €`;
      f.style.background = free < 0 ? "#FFC2A1" : free === 0 ? "#CDF56B" : "#fff";
    };
    body.replaceChildren(pill, rows, hint);
    const my = ++token;
    main.disabled = true;
    loadBudget()
      .then(() => {
        if (my !== token) return;
        main.disabled = false;
        rows.replaceChildren(...data.cats.map((c) => budgetRow(c, { get: () => data.bud.get(c.id), set: (v) => data.bud.set(c.id, v), onChange: drawFree })));
        drawFree();
      })
      .catch((err) => {
        if (my === token) error.textContent = err.message;
      });
  }

  function tarjetas() {
    frame("Tus tarjetas", "Dipper reconoce con cuál pagaste por el nombre que aparece en Apple Wallet.", { mainLabel: "Continuar", onMain: next });
    const list = html(`<div style="display:flex;flex-direction:column;gap:8px"></div>`);
    const add = html(`
      <a href="#/tarjeta" data-press style="margin-top:2px;height:56px;box-sizing:border-box;border:1.5px dashed rgba(27,27,31,.4);border-radius:20px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:700">
        ${ICON.plus}
        <span data-t>Añadir tarjeta</span>
      </a>
    `);
    body.replaceChildren(list, add, note("Solo guardamos el nombre y los 4 últimos dígitos, nunca el número completo. Si tienes varias, Dipper te pregunta cuál usaste cuando se llaman igual."));
    const my = ++token;
    api("/cards")
      .then(({ cards }) => {
        if (my !== token) return;
        add.querySelector("[data-t]").textContent = cards.length ? "Añadir otra tarjeta" : "Añadir tarjeta";
        list.replaceChildren(
          ...cards.map((c) => {
            const row = html(`
              <div class="card-box" style="padding:10px 14px;display:flex;align-items:center;gap:12px">
                <span data-dot style="flex:none;width:34px;height:24px;box-sizing:border-box;border-radius:7px;border:1.5px solid"></span>
                <span data-n style="flex:1;min-width:0;font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span>
                <span data-l style="flex:none;font-size:14px;font-weight:600;letter-spacing:1.5px;color:#5A5470"></span>
              </div>
            `);
            const dot = row.querySelector("[data-dot]");
            dot.style.background = c.color;
            dot.style.borderColor = cardBorder(c.color);
            dot.style.color = cardFg(c.color);
            row.querySelector("[data-n]").textContent = c.name;
            row.querySelector("[data-l]").textContent = "···· " + c.last4;
            return row;
          })
        );
      })
      .catch((err) => {
        if (my === token) error.textContent = err.message;
      });
  }

  function applepay() {
    let guide = null;
    frame("Que los pagos lleguen solos", "Se configura una sola vez, en 8 pasos cortos.", {
      mainLabel: "Siguiente",
      onMain: () => (guide.isLast() ? next() : guide.next()),
      altLabel: "Lo haré luego",
      onAlt: next,
    });
    // La guía del atajo (la misma de Conectar Apple Pay): un paso por pantalla. Atrás (‹) retrocede dentro de ella.
    const sync = () => {
      if (guide) main.textContent = guide.isLast() ? "Continuar" : "Siguiente";
    };
    guide = applePayGuide({ onChange: sync, onError: (msg) => (error.textContent = msg) });
    prevHook = () => guide.prev();
    const scroll = html(`<div class="noscroll" style="flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;margin:0 -20px;padding:0 20px 4px"></div>`);
    scroll.append(guide.el);
    body.replaceChildren(scroll);
    sync();
  }

  // Avisos: necesita que Dipper esté instalada en la pantalla de inicio. Si el servidor no los tiene configurados, se salta.
  async function avisos() {
    const my = ++token;
    let configured = true;
    try {
      await api("/push/key");
    } catch {
      configured = false;
    }
    if (my !== token) return;
    if (!configured) return next();

    if (!standalone() || !pushSupported()) {
      frame("Avisos de pagos", "Te avisamos al momento de cada pago nuevo por revisar. Para eso, Dipper tiene que estar en tu pantalla de inicio.", {
        mainLabel: "Continuar",
        onMain: next,
      });
      const list = html(`<div style="display:flex;flex-direction:column;gap:8px"></div>`);
      list.append(
        numbered(1, "#FFC93C", "Toca Compartir", "El botón de abajo en Safari, el cuadrado con la flecha."),
        numbered(2, "#FFA8D2", "Añadir a pantalla de inicio", "Desliza la lista hasta encontrarlo."),
        numbered(3, "#98EBC6", "Abre Dipper desde ahí", "Y activa los avisos en Ajustes → Avisos de pagos.")
      );
      body.replaceChildren(list);
      return;
    }
    frame("Avisos de pagos", "Te avisamos al momento de cada pago nuevo por revisar, y un toque te lleva a ponerle categoría.", {
      mainLabel: "Activar avisos",
      onMain: async () => {
        busy(main, true);
        try {
          await enablePush();
          next();
        } catch (err) {
          error.textContent = err.message;
          busy(main, false);
        }
      },
      altLabel: "Ahora no",
      onAlt: next,
    });
    body.replaceChildren(note("iOS te pedirá permiso. Puedes quitarlos cuando quieras en Ajustes → Avisos de pagos."));
  }

  function faceid() {
    if (!passkeySupported() || faceIdEnabledHere()) return next();
    frame("Entra con Face ID", "Así no tendrás que escribir la contraseña cada vez.", {
      mainLabel: "Activar Face ID",
      onMain: async () => {
        busy(main, true);
        try {
          await enableFaceId();
          next();
        } catch (err) {
          error.textContent = faceIdError(err);
          busy(main, false);
        }
      },
      altLabel: "Ahora no",
      onAlt: next,
    });
    body.replaceChildren(note("Solo se activa en este iPhone. La contraseña sigue valiendo si lo pierdes."));
  }

  function listo() {
    frame("Todo listo", "Así se usa Dipper cada día:", { mainLabel: "Ir al inicio", onMain: next, skip: false, prev: false });
    const list = html(`<div style="display:flex;flex-direction:column;gap:8px"></div>`);
    list.append(
      numbered(`<span aria-hidden="true" style="display:flex">${dots(14, { outline: true, colors: ["#FFC93C", "#CDB6FF", "#98EBC6"] })}</span>`, "#fff", "Revisa tus pagos", "Cuando llegue un pago, elige su categoría. Dipper la recordará para ese comercio."),
      numbered(ICON.plus, "#CDF56B", "Añade lo que no llega solo", "Efectivo, Bizum o recibos: toca el + del Inicio. Puedes ponerle concepto y fecha."),
      numbered(ICON.clock, "#A9D8FF", "Mira el historial", "El reloj del Inicio te lleva a todo lo que se ha registrado, con un toque a cada pago.")
    );
    body.replaceChildren(list);
  }

  const VIEWS = [bienvenida, presupuesto, categorias, tarjetas, applepay, avisos, faceid, listo];
  function draw() {
    token++;
    VIEWS[step]();
  }

  q("[data-skip]").addEventListener("click", next);
  q("[data-prev]").addEventListener("click", () => {
    if (prevHook && prevHook()) return;
    if (step > 0) goTo(step - 1);
  });

  draw();
  return el;
}
