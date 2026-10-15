// Pantalla "Entrar" (Login.dc.html). Sin Apple; Face ID ocupa el hueco del botón oscuro.
import { api } from "../api.js";
import { go, session } from "../app.js";
import { busy, html, ICON, passwordToggle } from "../dom.js";
import { faceIdEnabledHere, faceIdError, loginWithFaceId, passkeySupported } from "../passkey.js";

export function renderLogin() {
  const showFaceId = passkeySupported() && faceIdEnabledHere();
  const el = html(`
    <div class="screen">
      <div class="deco" aria-hidden="true">
        <div class="lay" style="height:67%;--c:#CDB6FF;--sw:7s;--dl:0s;--sp:5s;--dir:normal"></div>
        <div class="lay" style="height:61.7%;--c:#FFA8D2;--sw:6s;--dl:-2s;--sp:4s;--dir:reverse"></div>
        <div class="lay" style="height:57.3%;--c:#98EBC6;--sw:5s;--dl:-1s;--sp:6s;--dir:normal"></div>
        <div class="lay" style="height:52.6%;--c:#CDF56B;--sw:6s;--dl:-3s;--sp:4s;--dir:reverse"></div>
      </div>

      <div style="position:relative;z-index:2;flex:none;margin-top:96px;padding:0 4px">
        <h1 style="margin:0;font-size:84px;font-weight:800;letter-spacing:-3.5px;line-height:1">Dipper</h1>
        <div style="margin-top:8px;font-size:18px;font-weight:600;line-height:1.3;max-width:220px">Tus gastos del mes, a la vista.</div>
      </div>

      <form novalidate style="position:relative;z-index:2;flex:1;min-height:0;margin-top:110px;display:flex;flex-direction:column;gap:12px">
        <label class="field">
          ${ICON.mail}
          <input name="email" type="email" autocomplete="username" autocapitalize="off" aria-label="Correo electrónico" placeholder="Correo electrónico">
        </label>
        <label class="field has-btn">
          ${ICON.lock}
          <input name="password" data-pw type="password" autocomplete="current-password" aria-label="Contraseña" placeholder="Contraseña">
          <button type="button" class="toggle" aria-label="Mostrar contraseña">Mostrar</button>
        </label>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
          <div class="error" role="alert"></div>
          <button type="button" data-forgot class="link-u" style="font-size:14px;font-weight:700;margin-left:auto">Olvidé mi contraseña</button>
        </div>

        <button type="submit" class="btn btn-lima" style="margin-top:auto">Entrar</button>

        ${showFaceId ? `
        <div class="divider"><span></span>o<span></span></div>
        <button type="button" data-faceid class="btn btn-dark" style="margin-bottom:16px">Entrar con Face ID</button>
        ` : `<div style="height:16px"></div>`}

        <div style="text-align:center;font-size:16px;font-weight:600;padding-bottom:6px">
          ¿Primera vez? <a href="#/crear-cuenta" style="font-weight:800;text-decoration:underline">Crear cuenta</a>
        </div>
      </form>
    </div>
  `);

  const form = el.querySelector("form");
  const error = el.querySelector(".error");
  const submit = form.querySelector("button[type=submit]");
  passwordToggle(el);

  form.addEventListener("input", () => (error.textContent = ""));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) {
      error.textContent = "Escribe tu correo y tu contraseña.";
      return;
    }
    busy(submit, true);
    try {
      session.user = (await api("/auth/login", { email, password })).user;
      session.justLoggedIn = true;
      session.authMethod = "password";
      go("/");
    } catch (err) {
      error.textContent = err.message;
    } finally {
      busy(submit, false);
    }
  });

  // "Olvidé mi contraseña": hoja que explica cómo recuperarla (Face ID o desde el ordenador).
  el.querySelector("[data-forgot]").addEventListener("click", () => {
    error.textContent = "";
    const hasFace = passkeySupported() && faceIdEnabledHere();
    const bg = html(`
      <div class="sheet-bg">
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
          <div id="forgot-title" style="font-size:28px;font-weight:800;letter-spacing:-.8px;line-height:1.05">¿Olvidaste la contraseña?</div>
          <div data-txt style="margin-top:10px;font-size:16px;font-weight:500;line-height:1.4;color:#5A5470"></div>
          ${hasFace ? `<button type="button" data-face class="btn btn-dark" style="margin-top:18px">Entrar con Face ID</button>` : ""}
          <button type="button" data-ok class="btn btn-white" style="margin-top:10px">Entendido</button>
        </div>
      </div>
    `);
    bg.querySelector("[data-txt]").textContent = hasFace
      ? "Entra con Face ID y ve a Ajustes › Cambiar contraseña. Con Face ID no te pedirá la actual."
      : "Si tienes Face ID activado en tu iPhone, entra con él y cámbiala en Ajustes. Si no, se puede poner una nueva desde el ordenador.";
    const close = () => {
      bg.style.transition = "opacity .25s";
      bg.style.opacity = "0";
      setTimeout(() => bg.remove(), 260);
    };
    bg.querySelector("[data-ok]").addEventListener("click", close);
    bg.addEventListener("click", (e) => {
      if (e.target === bg) close();
    });
    const face = bg.querySelector("[data-face]");
    if (face) {
      face.addEventListener("click", () => {
        close();
        el.querySelector("[data-faceid]")?.click();
      });
    }
    document.getElementById("app").append(bg);
  });

  const faceBtn = el.querySelector("[data-faceid]");
  if (faceBtn) {
    faceBtn.addEventListener("click", async () => {
      error.textContent = "";
      busy(faceBtn, true);
      try {
        session.user = await loginWithFaceId();
        session.authMethod = "passkey";
        go("/");
      } catch (err) {
        error.textContent = faceIdError(err);
      } finally {
        busy(faceBtn, false);
      }
    });
  }

  return el;
}
