// Pantalla "Conectar Apple Pay" (ApplePay.dc.html). Mismo diseño.
// La guía del atajo (applePayGuide) es una pieza aparte que también usa la Bienvenida. Explica el montaje real de Dipper:
// una automatización "Transacción" que añade cada pago a una cola (dipper-cola.txt en iCloud) y un atajo aparte,
// DIPPER SEND, que envía la cola a Dipper y la vacía (dentro de la automatización iOS corta las peticiones de red).
import { api } from "../api.js";
import { go } from "../app.js";
import { html, ICON } from "../dom.js";

const KEY = "dipper_ap_guide";
const JSON_TEMPLATE = '{"importe":"[Cantidad]","comercio":"[Comercio]","tarjeta":"[Tarjeta o pase]","fecha":"[Fecha]"}';

const PART_A = { n: "1", name: "Atajo DIPPER SEND", color: "#FFC93C" };
const PART_B = { n: "2", name: "Automatización", color: "#98EBC6" };

// kind: "link" = enlace personal con botón de copiar; "json" = texto para pegar; "open" = botón que abre Atajos.
const STEPS = [
  { part: PART_A, title: "Copia tu enlace personal", body: "Une tus pagos con tu cuenta. No lo compartas con nadie.", kind: "link" },
  { part: PART_A, title: "Crea el atajo DIPPER SEND", body: "En Atajos toca + (arriba a la derecha) y ponle de nombre DIPPER SEND.", kind: "open" },
  { part: PART_A, title: "Lee la cola de pagos", body: "Añade la acción Obtener archivo y elige dipper-cola.txt, en iCloud Drive › Atajos." },
  { part: PART_A, title: "Envíala a Dipper", body: "Añade la acción Obtener contenido de URL: pega tu enlace, método POST y cuerpo JSON con un campo cola cuyo valor sea el texto del archivo.", kind: "link" },
  { part: PART_A, title: "Vacía la cola", body: "Añade la acción Guardar archivo: el mismo dipper-cola.txt, vacío y sobrescribiendo. Así ningún pago se envía dos veces." },
  { part: PART_B, title: "Crea la automatización", body: "En Atajos ve a Automatización, toca +, elige Transacción, marca tus tarjetas y pon Ejecutar inmediatamente." },
  { part: PART_B, title: "Guarda cada pago", body: "Añade la acción Añadir al archivo en dipper-cola.txt con este texto y un salto de línea. En cada [corchete], toca y elige la variable del pago.", kind: "json" },
  { part: PART_B, title: "Lanza el envío", body: "Añade la acción Ejecutar atajo y elige DIPPER SEND. Listo: haz un pago con Apple Pay y aparecerá en Dipper." },
];

const loadIndex = () => {
  try {
    const i = Number(localStorage.getItem(KEY));
    return Number.isInteger(i) && i >= 0 && i < STEPS.length ? i : 0;
  } catch {
    return 0;
  }
};
const saveIndex = (i) => {
  try {
    localStorage.setItem(KEY, String(i));
  } catch {}
};

// Para empezar la guía desde el principio (Ajustes › Guía de bienvenida).
export function resetApplePayGuide() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

const mask = (token) => token.slice(0, 8) + "••••••" + token.slice(-3);

// Guía de 8 pasos, uno por pantalla. El paso en el que vas se recuerda en el dispositivo (al abrir Atajos la app sale
// y puede recargarse al volver). La navegación la ponen quienes la usan: next(), prev(), isFirst(), isLast().
// onChange(): tras cada cambio de paso; onError(texto): avisa de un fallo (p. ej. no se pudo copiar).
export function applePayGuide({ onChange = () => {}, onError = () => {} } = {}) {
  let i = loadIndex();
  let link = null;

  const el = html(`
    <div class="card-box" style="border-radius:28px;padding:16px 18px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <span data-part style="font-size:13px;font-weight:800;padding:5px 12px;border-radius:99px;border:1.5px solid rgba(27,27,31,.22);white-space:nowrap"></span>
        <span data-dots role="img" style="display:flex;gap:5px"></span>
      </div>
      <div data-title style="font-size:24px;font-weight:800;letter-spacing:-.6px;line-height:1.1"></div>
      <div data-body style="font-size:15px;font-weight:500;line-height:1.4;color:#5A5470"></div>
      <div data-extra style="display:flex;align-items:center;gap:8px"></div>
    </div>
  `);
  const q = (s) => el.querySelector(s);

  const pillButton = (label, onClick) => {
    const b = html(`<button type="button" data-press style="flex:none;height:38px;box-sizing:border-box;padding:0 16px;border:1.5px solid rgba(27,27,31,.22);border-radius:99px;background:#fff;font-size:14px;font-weight:800;color:#1B1B1F;cursor:pointer"></button>`);
    b.textContent = label;
    b.addEventListener("click", () => onClick(b));
    return b;
  };

  // Copia un texto y avisa en el propio botón.
  async function copy(text, button, label) {
    onError("");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return onError("No se pudo copiar. Mantén pulsado el texto para copiarlo.");
    }
    button.textContent = "Copiado";
    button.style.background = "#CDF56B";
    setTimeout(() => {
      button.textContent = label;
      button.style.background = "#fff";
    }, 1600);
  }

  function box(text, mono) {
    const b = html(`<span style="flex:1;min-width:0;box-sizing:border-box;padding:9px 12px;border:1.5px dashed rgba(27,27,31,.4);border-radius:16px;background:#F1EDF9;font-size:${mono ? 12.5 : 14}px;font-weight:700;letter-spacing:${mono ? 0 : 0.4}px;line-height:1.35;overflow-wrap:anywhere"></span>`);
    b.textContent = text;
    return b;
  }

  function draw() {
    const s = STEPS[i];
    const part = q("[data-part]");
    part.textContent = `${s.part.n} · ${s.part.name}`;
    part.style.background = s.part.color;
    q("[data-dots]").setAttribute("aria-label", `Paso ${i + 1} de ${STEPS.length}`);
    q("[data-dots]").replaceChildren(
      ...STEPS.map((_, k) => {
        const d = document.createElement("span");
        d.style.cssText = `width:7px;height:7px;border-radius:50%;background:${k === i ? "#1B1B1F" : k < i ? "rgba(27,27,31,.45)" : "rgba(27,27,31,.16)"}`;
        return d;
      })
    );
    q("[data-title]").textContent = s.title;
    q("[data-body]").textContent = s.body;
    const extra = q("[data-extra]");
    extra.replaceChildren();
    if (s.kind === "link") {
      extra.append(box(link ? mask(link.token) : "…"), pillButton("Copiar enlace", (b) => link && copy(link.link, b, "Copiar enlace")));
    } else if (s.kind === "json") {
      extra.style.flexDirection = "column";
      extra.style.alignItems = "stretch";
      extra.append(box(JSON_TEMPLATE, true), pillButton("Copiar texto", (b) => copy(JSON_TEMPLATE, b, "Copiar texto")));
      extra.lastChild.style.alignSelf = "flex-start";
    } else if (s.kind === "open") {
      extra.append(pillButton("Abrir Atajos", () => (window.location.href = "shortcuts://")));
    }
    if (s.kind !== "json") {
      extra.style.flexDirection = "";
      extra.style.alignItems = "center";
    }
    extra.hidden = !s.kind;
    onChange();
  }

  function move(d) {
    const n = i + d;
    if (n < 0 || n >= STEPS.length) return false;
    i = n;
    saveIndex(i);
    draw();
    return true;
  }

  draw();
  api("/applepay")
    .then((data) => {
      link = data;
      draw();
    })
    .catch((err) => onError(err.message));

  return {
    el,
    next: () => move(1),
    prev: () => move(-1),
    isFirst: () => i === 0,
    isLast: () => i === STEPS.length - 1,
  };
}

export function renderApplePay() {
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
        <div style="margin-top:6px;font-size:15px;font-weight:500;line-height:1.3;color:#5A5470">Se configura una sola vez, en 8 pasos cortos.</div>
      </div>

      <div style="flex:1;min-height:0;margin:12px 0 0;padding:2px 0 0">
        <div data-guide></div>
        <div style="margin-top:10px;display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1.5px dashed rgba(27,27,31,.4);border-radius:16px">
          ${ICON.info}
          <span style="font-size:14px;font-weight:600;line-height:1.35">Solo llegan los pagos con Apple Pay. El efectivo y Bizum, a mano.</span>
        </div>
        <div class="error" role="alert" style="margin-top:10px"></div>
      </div>

      <div style="flex:none;margin-top:12px">
        <button type="button" data-main class="btn btn-lima"></button>
        <button type="button" data-prev class="link-u" style="display:block;margin:8px auto 0;font-size:15px">Paso anterior</button>
      </div>
    </div>
  `);

  const main = el.querySelector("[data-main]");
  const prev = el.querySelector("[data-prev]");
  const error = el.querySelector(".error");
  let guide = null; // onChange se llama ya en el primer dibujo, antes de que exista
  const sync = () => {
    if (!guide) return;
    main.textContent = guide.isLast() ? "Listo, ir al inicio" : "Siguiente";
    prev.style.visibility = guide.isFirst() ? "hidden" : "visible";
  };
  guide = applePayGuide({ onChange: sync, onError: (msg) => (error.textContent = msg) });
  el.querySelector("[data-guide]").replaceWith(guide.el);
  sync();

  main.addEventListener("click", () => (guide.isLast() ? go("/") : guide.next()));
  prev.addEventListener("click", () => guide.prev());

  return el;
}
