// Pantalla "Crear cuenta" (Registro.dc.html). Sin "Registrarme con Apple".
import { api } from "../api.js";
import { go, session } from "../app.js";
import { busy, html, ICON, passwordToggle } from "../dom.js";

export const STRENGTH_COLORS = ["#FF6B4A", "#FFC93C", "#98EBC6", "#CDF56B"];
export const STRENGTH_LABELS = [
  "Mínimo 8 caracteres",
  "Débil: añade un número y una mayúscula",
  "Va bien: añade un número o una mayúscula",
  "Buena contraseña",
  "Muy buena contraseña",
];

export function score(pw) {
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[A-Z]/.test(pw)) s += 1;
  if (pw.length >= 12) s += 1;
  return s;
}

export function renderRegistro() {
  const el = html(`
    <div class="screen">
      <div class="topbar">
        <a href="#/entrar" data-back class="icon-btn" aria-label="Volver">${ICON.back}</a>
        <span aria-hidden="true" style="display:flex;padding-right:8px">
          <span class="wig" style="width:22px;height:22px;border-radius:50%;background:#FFC93C;box-shadow:0 0 0 2px #F2F0F5;margin-left:-8px"></span>
          <span class="wig" style="width:22px;height:22px;border-radius:50%;background:#FFA8D2;box-shadow:0 0 0 2px #F2F0F5;margin-left:-8px;animation-delay:.25s"></span>
          <span class="wig" style="width:22px;height:22px;border-radius:50%;background:#98EBC6;box-shadow:0 0 0 2px #F2F0F5;margin-left:-8px;animation-delay:.5s"></span>
        </span>
      </div>

      <div style="flex:none;margin-top:8px">
        <h1 style="margin:0;font-size:40px;font-weight:800;letter-spacing:-1.5px;line-height:1.02">Crea tu cuenta</h1>
        <div style="margin-top:10px;font-size:17px;font-weight:500;line-height:1.35;color:#5A5470">Un minuto y listo.</div>
      </div>

      <form novalidate style="flex:1;min-height:0;margin-top:20px;display:flex;flex-direction:column;gap:12px">
        <label class="field">
          ${ICON.user}
          <input name="name" type="text" autocomplete="given-name" aria-label="Nombre" placeholder="Nombre">
        </label>
        <label class="field">
          ${ICON.mail}
          <input name="email" type="email" autocomplete="username" autocapitalize="off" aria-label="Correo electrónico" placeholder="Correo electrónico">
        </label>
        <div>
          <label class="field has-btn">
            ${ICON.lock}
            <input name="password" data-pw type="password" autocomplete="new-password" aria-label="Contraseña" placeholder="Contraseña">
            <button type="button" class="toggle" aria-label="Mostrar contraseña">Mostrar</button>
          </label>
          <div data-segs style="display:flex;gap:4px;margin-top:10px">
            <span></span><span></span><span></span><span></span>
          </div>
          <div data-strength style="margin-top:6px;font-size:13px;font-weight:600;color:#5A5470;min-height:16px"></div>
        </div>

        <label style="display:flex;align-items:flex-start;gap:12px;padding:2px 0;font-size:14px;font-weight:500;line-height:1.35;color:#5A5470;cursor:pointer">
          <input name="terms" type="checkbox" checked style="flex:none;width:22px;height:22px;margin:0;accent-color:#1B1B1F">
          <span>Acepto los términos y la privacidad</span>
        </label>

        <div class="error" role="alert"></div>

        <button type="submit" class="btn btn-lima" style="margin-top:auto;margin-bottom:16px" disabled>Crear cuenta</button>

        <div style="text-align:center;font-size:16px;font-weight:600;padding-bottom:6px">
          ¿Ya tienes cuenta? <a href="#/entrar" style="font-weight:800;text-decoration:underline">Entrar</a>
        </div>
      </form>
    </div>
  `);

  const form = el.querySelector("form");
  const submit = form.querySelector("button[type=submit]");
  const error = el.querySelector(".error");
  const segs = [...el.querySelectorAll("[data-segs] span")];
  const strength = el.querySelector("[data-strength]");
  passwordToggle(el);

  segs.forEach((s) => (s.style.cssText = "flex:1;height:8px;border-radius:4px;transition:background .25s;background:rgba(27,27,31,.14)"));

  function update() {
    error.textContent = "";
    const pw = form.password.value;
    const sc = score(pw);
    segs.forEach((s, i) => {
      s.style.background = i < sc ? STRENGTH_COLORS[Math.max(0, sc - 1)] : "rgba(27,27,31,.14)";
    });
    strength.textContent = pw.length === 0 ? "" : STRENGTH_LABELS[sc];
    const ok =
      form.name.value.trim().length > 0 &&
      /\S+@\S+\.\S+/.test(form.email.value) &&
      pw.length >= 8 &&
      form.terms.checked;
    submit.disabled = !ok;
  }
  form.addEventListener("input", update);
  form.addEventListener("change", update);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submit.disabled) return;
    busy(submit, true);
    try {
      session.user = (
        await api("/auth/register", {
          name: form.name.value.trim(),
          email: form.email.value.trim(),
          password: form.password.value,
        })
      ).user;
      session.justLoggedIn = true;
      session.authMethod = "password";
      go("/conectar-apple-pay");
    } catch (err) {
      error.textContent = err.message;
    } finally {
      busy(submit, false);
    }
  });

  return el;
}
