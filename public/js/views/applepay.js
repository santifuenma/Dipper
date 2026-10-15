// Pantalla "Conectar Apple Pay" (ApplePay.dc.html). Mismo diseño; textos con los pasos reales (opción A).
import { api } from "../api.js";
import { go } from "../app.js";
import { html, ICON } from "../dom.js";

const KEY = "dipper_ap_steps";
const CHECK = '<svg class="pop" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

const STEPS = [
  { id: 1, title: "Copia tu enlace personal", body: "Une tus pagos con tu cuenta. No lo compartas.", btn: "Copiar enlace", btnDone: "Copiado", color: "#FFC93C", token: true },
  { id: 2, title: "Crea la automatización", body: "En Atajos: Automatización, Transacción, sin preguntar.", btn: "Abrir Atajos", btnDone: "Hecho", color: "#FFA8D2" },
  { id: 3, title: "Añade la acción", body: "Obtener contenido de URL: tu enlace, POST y JSON con importe, comercio y tarjeta.", btn: "Hecho", btnDone: "Hecho", color: "#98EBC6" },
];

function loadDone() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}
function saveDone(done) {
  try {
    localStorage.setItem(KEY, JSON.stringify(done));
  } catch {}
}

function mask(token) {
  return token.slice(0, 8) + "••••••" + token.slice(-3);
}

export function renderApplePay() {
  const done = loadDone();
  let link = null;

  const el = html(`
    <div class="screen">
      <div class="topbar">
        <div style="display:flex;gap:4px;width:96px" aria-label="Paso 2 de 2">
          <span style="flex:1;height:8px;border-radius:4px;background:#1B1B1F"></span>
          <span style="flex:1;height:8px;border-radius:4px;background:#1B1B1F"></span>
        </div>
        <a href="#/" style="font-size:15px;font-weight:700;padding:10px 0;text-decoration:underline">Saltar</a>
      </div>

      <div style="flex:none;margin-top:8px">
        <h1 style="margin:0;font-size:32px;font-weight:800;letter-spacing:-1.2px;line-height:1.04">Que tus pagos lleguen solos</h1>
        <div style="margin-top:6px;font-size:15px;font-weight:500;line-height:1.3;color:#5A5470">Se configura una sola vez.</div>
      </div>

      <div style="flex:1;min-height:0;margin:12px 0 0;padding:2px 0 0">
        <div data-steps style="display:flex;flex-direction:column;gap:8px"></div>
        <div style="margin-top:10px;display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1.5px dashed rgba(27,27,31,.4);border-radius:16px">
          ${ICON.info}
          <span style="font-size:14px;font-weight:600;line-height:1.35">Solo llegan los pagos con Apple Pay. El efectivo y Bizum, a mano.</span>
        </div>
        <div class="error" role="alert" style="margin-top:10px"></div>
      </div>

      <div style="flex:none;margin-top:12px">
        <button type="button" data-main class="btn btn-lima"></button>
      </div>
    </div>
  `);

  const list = el.querySelector("[data-steps]");
  const main = el.querySelector("[data-main]");
  const error = el.querySelector(".error");

  function draw() {
    list.replaceChildren(
      ...STEPS.map((s) => {
        const isDone = !!done[s.id];
        const card = html(`
          <div class="card-box" style="padding:11px 14px;display:flex;gap:12px;align-items:flex-start">
            <span data-badge style="flex:none;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;transition:background .25s"></span>
            <span style="flex:1;min-width:0">
              <span data-title style="display:block;font-size:17px;font-weight:800;letter-spacing:-.2px"></span>
              <span data-body style="display:block;margin-top:2px;font-size:14px;font-weight:500;line-height:1.35;color:#5A5470"></span>
              <span style="display:flex;align-items:center;gap:8px;margin-top:8px">
                ${s.token ? `<span style="flex:1;min-width:0;display:flex;align-items:center;height:38px;box-sizing:border-box;padding:0 12px;border:1.5px dashed rgba(27,27,31,.4);border-radius:16px;background:#F1EDF9">
                  <span data-token style="flex:1;min-width:0;font-size:14px;font-weight:700;letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">…</span>
                </span>` : ""}
                <button type="button" data-act data-press style="flex:none;height:38px;box-sizing:border-box;padding:0 16px;border:1.5px solid rgba(27,27,31,.22);border-radius:99px;font-size:14px;font-weight:800;color:#1B1B1F;cursor:pointer"></button>
              </span>
            </span>
          </div>
        `);
        const badge = card.querySelector("[data-badge]");
        badge.style.background = isDone ? "#1B1B1F" : s.color;
        badge.style.color = isDone ? "#fff" : "#1B1B1F";
        if (isDone) badge.innerHTML = CHECK;
        else badge.textContent = String(s.id);
        card.querySelector("[data-title]").textContent = s.title;
        card.querySelector("[data-body]").textContent = s.body;
        if (s.token && link) card.querySelector("[data-token]").textContent = mask(link.token);
        const act = card.querySelector("[data-act]");
        act.textContent = isDone ? s.btnDone : s.btn;
        act.style.background = isDone ? "#CDF56B" : "#fff";
        act.addEventListener("click", () => run(s));
        return card;
      })
    );
    const all = STEPS.every((s) => done[s.id]);
    main.textContent = all ? "Listo, ir al inicio" : "Probar con un pago";
  }

  async function run(step) {
    error.textContent = "";
    if (step.id === 1) {
      if (!link) return;
      try {
        await navigator.clipboard.writeText(link.link);
      } catch {
        error.textContent = "No se pudo copiar. Mantén pulsado el enlace para copiarlo.";
        return;
      }
      done[1] = true;
    } else if (step.id === 2) {
      done[2] = true;
      saveDone(done);
      draw();
      window.location.href = "shortcuts://";
      return;
    } else {
      done[step.id] = !done[step.id];
    }
    saveDone(done);
    draw();
  }

  main.addEventListener("click", () => go("/"));

  draw();
  api("/applepay")
    .then((data) => {
      link = data;
      draw();
    })
    .catch((err) => (error.textContent = err.message));

  return el;
}
