// Pantalla "Ajustes" (nueva, acordada; estilo del zip): cuenta, categorías, Apple Pay, Face ID y salir.
import { api } from "../api.js";
import { go, session } from "../app.js";
import { busy, html, ICON } from "../dom.js";
import { enableFaceId, faceIdEnabledHere, faceIdError, passkeySupported } from "../passkey.js";

const I = {
  cats: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1B1F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>',
  lock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1B1F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  face: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1B1F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 15.5c1.4 1 3.6 1 5 0"/></svg>',
};

function row(icon, color, title, sub) {
  const r = html(`
    <a data-press class="card-box" style="padding:10px 12px;display:flex;align-items:center;gap:12px">
      <span style="flex:none;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${color}">${icon}</span>
      <span style="flex:1;min-width:0">
        <span data-title style="display:block;font-size:16px;font-weight:700"></span>
        <span data-sub style="display:block;font-size:13px;font-weight:500;color:#5A5470"></span>
      </span>
      <span data-end style="flex:none;display:flex;align-items:center">${ICON.chevron}</span>
    </a>
  `);
  r.querySelector("[data-title]").textContent = title;
  r.querySelector("[data-sub]").textContent = sub;
  return r;
}

export function renderHome() {
  const el = html(`
    <div class="screen">
      <div class="topbar">
        <a href="#/" data-back class="icon-btn" aria-label="Volver">${ICON.back}</a>
        <span style="font-size:20px;font-weight:800;letter-spacing:-.3px">Ajustes</span>
        <span style="width:44px"></span>
      </div>

      <div style="flex:1;min-height:0;padding-top:8px;display:flex;flex-direction:column;gap:10px">
        <div class="card-box" style="border-radius:28px;padding:16px 18px;display:flex;align-items:center;gap:14px">
          <span aria-hidden="true" style="display:flex;padding-left:8px;flex:none">
            <span class="wig" style="width:26px;height:26px;border-radius:50%;background:#FFC93C;box-shadow:0 0 0 2px #fff;margin-left:-8px"></span>
            <span class="wig" style="width:26px;height:26px;border-radius:50%;background:#FFA8D2;box-shadow:0 0 0 2px #fff;margin-left:-8px;animation-delay:.25s"></span>
            <span class="wig" style="width:26px;height:26px;border-radius:50%;background:#98EBC6;box-shadow:0 0 0 2px #fff;margin-left:-8px;animation-delay:.5s"></span>
          </span>
          <span style="min-width:0">
            <span data-name style="display:block;font-size:22px;font-weight:800;letter-spacing:-.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span>
            <span data-email style="display:block;font-size:14px;font-weight:500;color:#5A5470;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span>
          </span>
        </div>
        <div data-rows style="display:flex;flex-direction:column;gap:8px"></div>
        <div class="error" role="alert"></div>
      </div>

      <button type="button" data-logout class="btn btn-white" style="flex:none;margin-top:10px;color:#B3261E">Salir</button>
    </div>
  `);

  el.querySelector("[data-name]").textContent = session.user.name;
  el.querySelector("[data-email]").textContent = session.user.email;
  const error = el.querySelector(".error");
  const rows = el.querySelector("[data-rows]");

  const cats = row(I.cats, "#CDF56B", "Categorías", "Crear, editar y borrar");
  cats.href = "#/categorias";
  const pay = row(ICON.applePay, "#FFC93C", "Conectar Apple Pay", "Tu enlace y los pasos del atajo");
  pay.href = "#/conectar-apple-pay";
  const pass = row(I.lock, "#CDB6FF", "Cambiar contraseña", "Con Face ID no hace falta la actual");
  pass.href = "#/cambiar-contrasena";
  const cardsRow = row(ICON.card, "#A9D8FF", "Tarjetas", "Añadir, editar y borrar");
  cardsRow.href = "#/tarjetas";
  rows.append(cardsRow, cats, pay, pass);

  if (passkeySupported()) {
    const face = row(I.face, "#98EBC6", "Face ID", "");
    face.setAttribute("role", "button");
    const draw = () => {
      const on = faceIdEnabledHere();
      face.querySelector("[data-sub]").textContent = on ? "Activado en este iPhone" : "Entrar sin escribir la contraseña";
      face.querySelector("[data-end]").innerHTML = on
        ? '<span style="font-size:13px;font-weight:800;padding:5px 11px;border-radius:99px;background:#CDF56B;border:1.5px solid rgba(27,27,31,.22)">Activado</span>'
        : '<span style="font-size:13px;font-weight:800;padding:5px 11px;border-radius:99px;background:#fff;border:1.5px solid rgba(27,27,31,.22)">Activar</span>';
    };
    draw();
    face.addEventListener("click", async (e) => {
      e.preventDefault();
      if (faceIdEnabledHere()) return;
      error.textContent = "";
      busy(face, true);
      try {
        await enableFaceId();
        draw();
      } catch (err) {
        error.textContent = faceIdError(err);
      } finally {
        busy(face, false);
      }
    });
    rows.append(face);
  }

  el.querySelector("[data-logout]").addEventListener("click", async () => {
    try {
      await api("/auth/logout", {});
    } catch {}
    session.user = null;
    go("/entrar");
  });

  return el;
}
