// Dipper: arranque, rutas y bloqueo de zoom.
import { api } from "./api.js";
import { startNav } from "./nav.js";
import { renderLogin } from "./views/login.js";
import { renderRegistro } from "./views/registro.js";
import { renderAjustes } from "./views/ajustes.js";
import { renderApplePay } from "./views/applepay.js";
import { renderPorRevisar } from "./views/por-revisar.js";
import { renderTarjetaForm } from "./views/tarjeta-form.js";
import { renderCategoriaForm } from "./views/categoria-form.js";
import { renderTarjetas } from "./views/tarjetas.js";
import { renderCategorias } from "./views/categorias.js";
import { renderInicio } from "./views/inicio.js";
import { renderVerTarjeta } from "./views/ver-tarjeta.js";
import { renderVerCategoria } from "./views/ver-categoria.js";
import { renderMovimientos } from "./views/movimientos.js";
import { renderPago } from "./views/pago.js";
import { renderHistorial } from "./views/historial.js";
import { renderPresupuesto } from "./views/presupuesto.js";
import { renderNuevoGasto } from "./views/nuevo-gasto.js";
import { renderCambiarContrasena } from "./views/cambiar-contrasena.js";

export { go } from "./nav.js";

export const session = { user: null };

// auth: si la pantalla exige sesión. root: no se puede volver atrás desde ella.
// sheet: pantalla con ✕ que sube desde abajo (p. ej. Nuevo gasto).
const ROUTES = {
  "/entrar": { view: renderLogin, auth: false, root: true },
  "/crear-cuenta": { view: renderRegistro, auth: false },
  "/": { view: renderInicio, auth: true, root: true },
  "/ver-tarjeta": { view: renderVerTarjeta, auth: true },
  "/ver-categoria": { view: renderVerCategoria, auth: true },
  "/movimientos": { view: renderMovimientos, auth: true },
  "/pago": { view: renderPago, auth: true },
  "/historial": { view: renderHistorial, auth: true },
  "/conectar-apple-pay": { view: renderApplePay, auth: true },
  "/por-revisar": { view: renderPorRevisar, auth: true },
  "/tarjeta": { view: renderTarjetaForm, auth: true },
  "/categoria": { view: renderCategoriaForm, auth: true },
  "/presupuesto": { view: renderPresupuesto, auth: true },
  "/nuevo-gasto": { view: renderNuevoGasto, auth: true, sheet: true },
  "/ajustes": { view: renderAjustes, auth: true },
  "/cambiar-contrasena": { view: renderCambiarContrasena, auth: true },
  "/categorias": { view: renderCategorias, auth: true },
  "/tarjetas": { view: renderTarjetas, auth: true },
};

function blockZoom() {
  const stop = (e) => e.preventDefault();
  for (const ev of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(ev, stop, { passive: false });
  }
  document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  // Necesario para que :active funcione en iOS (efecto al pulsar).
  document.addEventListener("touchstart", () => {}, { passive: true });
}

async function boot() {
  blockZoom();
  try {
    const me = await api("/auth/me");
    session.user = me.user;
    session.authMethod = me.authMethod;
  } catch {
    session.user = null;
  }
  startNav(document.getElementById("app"), ROUTES, () => !!session.user);
}

boot();
