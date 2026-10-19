// Pantalla "Cambiar contraseña" (nueva, acordada; estilo de Crear cuenta).
// Si se entró con Face ID no pide la actual: así se recupera el acceso si se olvida.
import { api } from "../api.js";
import { session } from "../app.js";
import { back } from "../nav.js";
import { busy, html, ICON, passwordToggle } from "../dom.js";
import { score, STRENGTH_COLORS, STRENGTH_LABELS } from "./registro.js";

export function renderCambiarContrasena() {
  const faceId = session.authMethod === "passkey";
  const el = html(`
    <div class="screen">
      <div class="topbar">
        <a href="#/ajustes" data-back class="icon-btn" aria-label="Volver">${ICON.back}</a>
        <span class="title">Contraseña</span>
        <span style="width:44px"></span>
      </div>

      <div style="flex:none;margin-top:8px">
        <h1 style="margin:0;font-size:34px;font-weight:800;letter-spacing:-1.2px;line-height:1.04">Cambia tu contraseña</h1>
        <div data-intro style="margin-top:8px;font-size:16px;font-weight:500;line-height:1.35;color:#5A5470"></div>
      </div>

      <form novalidate style="flex:1;min-height:0;margin-top:18px;display:flex;flex-direction:column;gap:12px">
        ${faceId ? "" : `
        <label class="field">
          ${ICON.lock}
          <input name="current" type="password" autocomplete="current-password" aria-label="Contraseña actual" placeholder="Contraseña actual">
        </label>`}
        <div>
          <label class="field has-btn">
            ${ICON.lock}
            <input name="next" data-pw type="password" autocomplete="new-password" aria-label="Contraseña nueva" placeholder="Contraseña nueva">
            <button type="button" class="toggle" aria-label="Mostrar contraseña">Mostrar</button>
          </label>
          <div data-segs style="display:flex;gap:4px;margin-top:10px">
            <span></span><span></span><span></span><span></span>
          </div>
          <div data-strength style="margin-top:6px;font-size:13px;font-weight:600;color:#5A5470;min-height:16px"></div>
        </div>
        <div class="error" role="alert"></div>
        <div data-ok style="font-size:15px;font-weight:700;color:#1B1B1F"></div>
        <button type="submit" class="btn btn-lima" style="margin-top:auto" disabled>Guardar contraseña</button>
      </form>
    </div>
  `);

  el.querySelector("[data-intro]").textContent = faceId
    ? "Has entrado con Face ID, así que no hace falta la contraseña actual."
    : "Escribe la actual y la nueva. Las demás sesiones abiertas se cerrarán.";

  const form = el.querySelector("form");
  const submit = form.querySelector("button[type=submit]");
  const error = el.querySelector(".error");
  const segs = [...el.querySelectorAll("[data-segs] span")];
  const strength = el.querySelector("[data-strength]");
  passwordToggle(el);
  segs.forEach((s) => (s.style.cssText = "flex:1;height:8px;border-radius:4px;transition:background .25s;background:rgba(27,27,31,.14)"));

  form.addEventListener("input", () => {
    error.textContent = "";
    const pw = form.next.value;
    const sc = score(pw);
    segs.forEach((s, i) => (s.style.background = i < sc ? STRENGTH_COLORS[Math.max(0, sc - 1)] : "rgba(27,27,31,.14)"));
    strength.textContent = pw.length === 0 ? "" : STRENGTH_LABELS[sc];
    submit.disabled = pw.length < 8 || (!faceId && !form.current.value);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submit.disabled) return;
    busy(submit, true);
    try {
      await api("/auth/password", { current: faceId ? undefined : form.current.value, next: form.next.value });
      el.querySelector("[data-ok]").textContent = "Contraseña cambiada.";
      setTimeout(() => back("/ajustes"), 900);
    } catch (err) {
      error.textContent = err.message;
      busy(submit, false);
    }
  });

  return el;
}
