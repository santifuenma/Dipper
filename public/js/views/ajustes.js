// Pantalla "Ajustes" (nueva, acordada; estilo del zip): cuenta, categorías, Apple Pay, Face ID, salir y borrar la cuenta.
import { dots } from "../components.js";
import { api } from "../api.js";
import { go, session } from "../app.js";
import { busy, html, ICON, passwordToggle } from "../dom.js";
import { appVersion, disablePush, enablePush, pushEnabledHere, pushSupported, testPush } from "../push.js";
import { enableFaceId, faceIdEnabledHere, faceIdError, passkeySupported } from "../passkey.js";

function row(icon, color, title, sub) {
  const r = html(`
    <a data-press class="card-box" style="flex:none;padding:10px 12px;display:flex;align-items:center;gap:12px">
      <span class="ic-circle" style="background:${color}">${icon}</span>
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

export function renderAjustes() {
  const el = html(`
    <div class="screen">
      <div class="topbar">
        <a href="#/" data-back class="icon-btn" aria-label="Volver">${ICON.back}</a>
        <span class="title">Ajustes</span>
        <span style="width:44px"></span>
      </div>

      <div style="flex:1;min-height:0;padding-top:8px;display:flex;flex-direction:column;gap:10px">
        <div class="card-box" style="border-radius:28px;padding:16px 18px;display:flex;align-items:center;gap:14px">
          <span aria-hidden="true" style="display:flex;padding-left:8px;flex:none">
            ${dots(26)}
          </span>
          <span style="min-width:0">
            <span data-name style="display:block;font-size:22px;font-weight:800;letter-spacing:-.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span>
            <span data-email style="display:block;font-size:14px;font-weight:500;color:#5A5470;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span>
          </span>
        </div>
        <div data-rows class="noscroll" style="flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;margin:0 -20px;padding:0 20px 4px;display:flex;flex-direction:column;gap:8px"></div>
        <div class="error" role="alert"></div>
      </div>

      <button type="button" data-logout class="btn btn-white" style="flex:none;margin-top:10px;color:#B3261E">Salir</button>
      <div data-version hidden style="flex:none;text-align:center;margin-top:4px;font-size:12px;font-weight:600;color:var(--faint)"></div>
      <button type="button" data-delete-account class="link-u" style="flex:none;align-self:center;margin-top:6px;font-size:14px;color:var(--danger)">Borrar cuenta</button>
    </div>
  `);

  appVersion().then((v) => {
    if (!v) return;
    const d = el.querySelector("[data-version]");
    d.textContent = "Versión " + v;
    d.hidden = false;
  });

  el.querySelector("[data-name]").textContent = session.user.name;
  el.querySelector("[data-email]").textContent = session.user.email;
  const error = el.querySelector(".error");
  const rows = el.querySelector("[data-rows]");

  const cats = row(ICON.categories, "#CDF56B", "Categorías", "Crear, editar y borrar");
  cats.href = "#/categorias";
  const pay = row(ICON.applePay, "#FFC93C", "Conectar Apple Pay", "Tu enlace y los pasos del atajo");
  pay.href = "#/conectar-apple-pay";
  const pass = row(ICON.lock, "#CDB6FF", "Cambiar contraseña", "Con Face ID no hace falta la actual");
  pass.href = "#/cambiar-contrasena";
  const cardsRow = row(ICON.card, "#A9D8FF", "Tarjetas", "Añadir, editar y borrar");
  cardsRow.href = "#/tarjetas";
  rows.append(cardsRow, cats, pay, pass);

  // Volver a ver la guía de bienvenida (vuelve al primer paso y a enseñar los globos del Inicio).
  const guide = row(ICON.info, "#FFA8D2", "Guía de bienvenida", "Volver a ver cómo se usa Dipper");
  guide.setAttribute("role", "button");
  guide.addEventListener("click", async (e) => {
    e.preventDefault();
    busy(guide, true);
    try {
      const ob = await api("/onboarding", { restart: true });
      session.user = { ...session.user, onboarding: { step: ob.step, tour: ob.tour, reminder: ob.reminder } };
      go("/bienvenida");
    } catch (err) {
      error.textContent = err.message;
    } finally {
      busy(guide, false);
    }
  });
  rows.append(guide);

  if (passkeySupported()) {
    const face = row(ICON.faceId, "#98EBC6", "Face ID", "");
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

  // Avisos: una notificación por cada pago nuevo por revisar. Solo con la app instalada en la pantalla de inicio.
  const avisos = row(ICON.bell, "#FFC2A1", "Avisos de pagos", "");
  avisos.setAttribute("role", "button");
  const pill = (on) =>
    `<span style="font-size:13px;font-weight:800;padding:5px 11px;border-radius:99px;background:${on ? "#CDF56B" : "#fff"};border:1.5px solid rgba(27,27,31,.22)">${on ? "Activado" : "Activar"}</span>`;
  if (!pushSupported()) {
    avisos.querySelector("[data-sub]").textContent = "Instala Dipper en la pantalla de inicio (iOS 16.4 o más)";
    avisos.querySelector("[data-end]").innerHTML = "";
    rows.append(avisos);
  } else {
    const test = row(ICON.bell, "#fff", "Enviar aviso de prueba", "Para comprobar que llegan");
    test.setAttribute("role", "button");
    test.querySelector("[data-end]").innerHTML = "";
    test.hidden = true;
    let on = false;
    let canTest = false; // solo el entorno de pruebas
    const draw = () => {
      avisos.querySelector("[data-sub]").textContent = on ? "Te avisamos de cada pago por revisar" : "Una notificación por cada pago nuevo";
      avisos.querySelector("[data-end]").innerHTML = pill(on);
      test.hidden = !(on && canTest);
    };
    api("/push/key")
      .then((r) => {
        canTest = !!r.test;
        draw();
      })
      .catch(() => {});
    pushEnabledHere().then((v) => {
      on = v;
      draw();
    });
    draw();
    avisos.addEventListener("click", async (e) => {
      e.preventDefault();
      error.textContent = "";
      busy(avisos, true);
      try {
        if (on) await disablePush();
        else await enablePush();
        on = await pushEnabledHere();
        draw();
      } catch (err) {
        error.textContent = err.message;
      } finally {
        busy(avisos, false);
      }
    });
    test.addEventListener("click", async (e) => {
      e.preventDefault();
      error.textContent = "";
      busy(test, true);
      try {
        const { sent } = await testPush();
        if (!sent) error.textContent = "No se ha podido enviar el aviso. Prueba a desactivarlos y activarlos otra vez.";
      } catch (err) {
        error.textContent = err.message;
      } finally {
        busy(test, false);
      }
    });
    rows.append(avisos, test);
  }

  // Borrar la cuenta: hoja con la explicación y, si se entró con contraseña, la contraseña.
  el.querySelector("[data-delete-account]").addEventListener("click", () => {
    const faceId = session.authMethod === "passkey";
    const bg = html(`
      <div class="sheet-bg">
        <form class="sheet" novalidate role="dialog" aria-modal="true" aria-labelledby="del-title">
          <div id="del-title" style="font-size:28px;font-weight:800;letter-spacing:-.8px;line-height:1.05">¿Borrar tu cuenta?</div>
          <div style="margin-top:10px;font-size:16px;font-weight:500;line-height:1.4;color:var(--muted)">Se borran para siempre tus pagos, tarjetas, categorías y presupuesto. No se puede deshacer.</div>
          ${faceId ? "" : `
          <label class="field has-btn" style="margin-top:16px">
            ${ICON.lock}
            <input name="password" data-pw type="password" autocomplete="current-password" aria-label="Contraseña" placeholder="Tu contraseña">
            <button type="button" class="toggle" aria-label="Mostrar contraseña">Mostrar</button>
          </label>`}
          <div class="error" role="alert" style="margin-top:10px"></div>
          <button type="submit" data-confirm class="btn btn-white" style="margin-top:18px;color:var(--danger)">Borrar mi cuenta</button>
          <button type="button" data-cancel class="btn btn-lima" style="margin-top:10px">Cancelar</button>
        </form>
      </div>
    `);
    const form = bg.querySelector("form");
    const err = bg.querySelector(".error");
    const confirm = bg.querySelector("[data-confirm]");
    if (!faceId) passwordToggle(bg);
    const close = () => {
      bg.style.transition = "opacity .25s";
      bg.style.opacity = "0";
      setTimeout(() => bg.remove(), 260);
    };
    bg.querySelector("[data-cancel]").addEventListener("click", close);
    bg.addEventListener("click", (e) => {
      if (e.target === bg) close();
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.textContent = "";
      if (!faceId && !form.password.value) {
        err.textContent = "Escribe tu contraseña.";
        return;
      }
      busy(confirm, true);
      try {
        await api("/auth/delete-account", { password: faceId ? undefined : form.password.value });
        try {
          localStorage.clear();
        } catch {}
        session.user = null;
        bg.remove();
        go("/entrar");
      } catch (error) {
        err.textContent = error.message;
        busy(confirm, false);
      }
    });
    document.getElementById("app").append(bg);
  });

  el.querySelector("[data-logout]").addEventListener("click", async () => {
    try {
      await api("/auth/logout", {});
    } catch {}
    session.user = null;
    go("/entrar");
  });

  return el;
}
