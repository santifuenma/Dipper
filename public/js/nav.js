// Navegación con transiciones estilo iPhone y gesto de volver desde el borde izquierdo.
//   forward: la pantalla nueva entra desde la derecha
//   back:    la actual sale hacia la derecha
//   up/down: pantallas "sheet" (con ✕) suben y bajan desde abajo
//   fade:    al entrar o salir de la cuenta

const EASE = "cubic-bezier(.32,.72,0,1)";
const DURATION = 420;
const PARALLAX = -30; // % que se desplaza la pantalla de debajo
const DIM = 0.92; // brillo de la pantalla de debajo
const EDGE = 24; // px desde el borde izquierdo donde empieza el gesto

let root, routes, isLoggedIn;
let stack = [];
let current = null; // { path, el }
let adopted = null; // pantalla ya colocada por el gesto de volver

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pathNow = () => location.hash.slice(1) || "/";

export function go(path) {
  if (pathNow() !== path) location.hash = path;
}

// Vuelve a la pantalla anterior (con animación de volver) o a `fallback` si no hay.
export function back(fallback = "/") {
  go(stack.length > 1 ? stack[stack.length - 2] : fallback);
}

// "/tarjeta?id=3" -> { route, params }
function resolve(full) {
  const [base, qs] = full.split("?");
  return { route: routes[base], params: new URLSearchParams(qs || "") };
}

export function startNav(rootEl, routeTable, loggedIn) {
  root = rootEl;
  routes = routeTable;
  isLoggedIn = loggedIn;
  window.addEventListener("hashchange", onRoute);
  // Cualquier enlace con data-back vuelve a la pantalla anterior; su href es el destino si no hay anterior.
  root.addEventListener("click", (e) => {
    const a = e.target.closest("[data-back]");
    if (!a) return;
    e.preventDefault();
    back((a.getAttribute("href") || "#/").slice(1));
  });
  setupSwipeBack();
  onRoute();
}

function redirect(path) {
  location.replace("#" + path);
  if (pathNow() === path) onRoute();
}

function onRoute() {
  const path = pathNow();
  const { route, params } = resolve(path);
  const logged = isLoggedIn();
  if (!route) return redirect(logged ? "/" : "/entrar");
  if (route.auth && !logged) return redirect("/entrar");
  if (!route.auth && logged) return redirect("/");
  if (current && current.path === path) return;

  if (adopted && adopted.path === path) {
    stack.pop();
    current.el.remove();
    current = adopted;
    adopted = null;
    return;
  }

  let mode;
  const prev = current && resolve(current.path).route;
  if (!current) {
    mode = "none";
    stack = [path];
  } else if (prev.auth !== route.auth) {
    mode = "fade";
    stack = [path];
  } else if (stack[stack.length - 2] === path) {
    mode = prev.sheet ? "down" : "back";
    stack.pop();
  } else {
    mode = route.sheet ? "up" : "forward";
    stack.push(path);
  }

  const el = route.view(params);
  const old = current && current.el;
  current = { path, el };
  transition(old, el, mode);
}

function settle(el) {
  for (const a of el.getAnimations()) a.cancel();
  el.style.zIndex = "";
  el.style.transform = "";
  el.style.filter = "";
}

function transition(oldEl, newEl, mode) {
  // Si había otra transición a medias, se termina de golpe.
  for (const child of [...root.children]) {
    if (child !== oldEl) child.remove();
  }
  if (oldEl) for (const a of oldEl.getAnimations()) a.finish();

  root.appendChild(newEl);
  if (!oldEl) return;
  if (mode === "none" || reduced()) {
    oldEl.remove();
    return;
  }

  const opts = { duration: DURATION, easing: EASE, fill: "both" };
  const under = { transform: `translateX(${PARALLAX}%)`, filter: `brightness(${DIM})` };
  const flat = { transform: "translateX(0)", filter: "brightness(1)" };
  let top, bottom, topFrames, bottomFrames;

  switch (mode) {
    case "forward":
      top = newEl; bottom = oldEl;
      topFrames = [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }];
      bottomFrames = [flat, under];
      break;
    case "back":
      top = oldEl; bottom = newEl;
      topFrames = [{ transform: "translateX(0)" }, { transform: "translateX(100%)" }];
      bottomFrames = [under, flat];
      break;
    case "up":
      top = newEl; bottom = oldEl;
      topFrames = [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }];
      bottomFrames = [{ transform: "scale(1)", filter: "brightness(1)" }, { transform: "scale(.94)", filter: `brightness(${DIM})` }];
      break;
    case "down":
      top = oldEl; bottom = newEl;
      topFrames = [{ transform: "translateY(0)" }, { transform: "translateY(100%)" }];
      bottomFrames = [{ transform: "scale(.94)", filter: `brightness(${DIM})` }, { transform: "scale(1)", filter: "brightness(1)" }];
      break;
    default: // fade
      top = newEl; bottom = oldEl;
      topFrames = [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "translateY(0)" }];
      bottomFrames = [{ opacity: 1 }, { opacity: 0 }];
  }

  top.style.zIndex = 2;
  bottom.style.zIndex = 1;
  top.style.boxShadow = mode === "fade" ? "" : "0 0 40px rgba(27,27,31,.12)";
  const a = top.animate(topFrames, opts);
  const b = bottom.animate(bottomFrames, opts);
  Promise.all([a.finished, b.finished])
    .then(() => {
      oldEl.remove();
      newEl.style.boxShadow = "";
      settle(newEl);
    })
    .catch(() => {});
}

function setupSwipeBack() {
  let g = null;

  root.addEventListener("touchstart", (e) => {
    if (!current || e.touches.length !== 1) return;
    const { route } = resolve(current.path);
    if (route.root || route.sheet || stack.length < 2) return;
    const t = e.touches[0];
    if (t.clientX > EDGE) return;
    g = { x0: t.clientX, y0: t.clientY, started: false, under: null, lastX: t.clientX, lastT: e.timeStamp, v: 0 };
  }, { passive: true });

  root.addEventListener("touchmove", (e) => {
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x0;
    const dy = t.clientY - g.y0;
    if (!g.started) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { g = null; return; }
      if (dx < 8) return;
      g.started = true;
      const prevPath = stack[stack.length - 2];
      g.prevPath = prevPath;
      const prev = resolve(prevPath);
      g.under = prev.route.view(prev.params);
      g.under.style.zIndex = 1;
      current.el.style.zIndex = 2;
      current.el.style.boxShadow = "0 0 40px rgba(27,27,31,.12)";
      root.insertBefore(g.under, current.el);
    }
    e.preventDefault();
    const dt = Math.max(1, e.timeStamp - g.lastT);
    g.v = (t.clientX - g.lastX) / dt;
    g.lastX = t.clientX;
    g.lastT = e.timeStamp;
    const p = Math.max(0, Math.min(1, dx / root.clientWidth));
    current.el.style.transform = `translateX(${p * 100}%)`;
    g.under.style.transform = `translateX(${PARALLAX * (1 - p)}%)`;
    g.under.style.filter = `brightness(${DIM + (1 - DIM) * p})`;
  }, { passive: false });

  const end = () => {
    if (!g) return;
    const gesture = g;
    g = null;
    if (!gesture.started) return;
    const el = current.el;
    const under = gesture.under;
    const p = (gesture.lastX - gesture.x0) / root.clientWidth;
    const complete = p > 0.35 || gesture.v > 0.5;
    const opts = { duration: 300, easing: EASE, fill: "forwards" };

    const a = el.animate(
      [{ transform: el.style.transform }, { transform: complete ? "translateX(100%)" : "translateX(0)" }],
      opts
    );
    under.animate(
      [
        { transform: under.style.transform, filter: under.style.filter },
        complete ? { transform: "translateX(0)", filter: "brightness(1)" } : { transform: `translateX(${PARALLAX}%)`, filter: `brightness(${DIM})` },
      ],
      opts
    );
    a.finished.then(() => {
      if (complete) {
        settle(under);
        adopted = { path: gesture.prevPath, el: under };
        location.hash = gesture.prevPath;
      } else {
        under.remove();
        settle(el);
        el.style.boxShadow = "";
      }
    });
  };
  root.addEventListener("touchend", end);
  root.addEventListener("touchcancel", end);
}
