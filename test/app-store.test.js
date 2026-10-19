// Lo que necesita la app nativa y exige el App Store: sesión por token, registro abierto,
// borrar la cuenta y recibir pagos con la sesión (acción de Atajos).
import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/worker.js";

const BASE = "https://dipper.test";
const json = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const asApp = (init = {}) => ({ ...init, headers: { ...(init.headers || {}), "x-dipper-client": "app" } });
const bearer = (token, init = {}) => ({ ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${token}` } });
const call = (path, init) => SELF.fetch(BASE + "/api" + path, init);
const nueva = { name: "Prueba", email: "prueba@dipper.test", password: "contraseña1" };

async function cuentaApp() {
  const r = await call("/auth/register", asApp(json(nueva)));
  expect(r.status).toBe(201);
  return (await r.json()).token;
}

describe("sesión por token", () => {
  it("la app recibe un token y con él usa la API sin cookie", async () => {
    const token = await cuentaApp();
    expect(token).toMatch(/^[\w-]{40,}$/);
    const me = await call("/auth/me", bearer(token));
    expect((await me.json()).user.email).toBe("prueba@dipper.test");
    expect((await call("/month", bearer(token))).status).toBe(200);
  });

  it("la web nunca recibe el token en la respuesta, solo la cookie", async () => {
    const r = await call("/auth/register", json(nueva));
    expect((await r.json()).token).toBeUndefined();
    expect(r.headers.get("set-cookie")).toMatch(/HttpOnly/);
  });

  it("al entrar con contraseña también da token a la app", async () => {
    await cuentaApp();
    const r = await call("/auth/login", asApp(json({ email: nueva.email, password: nueva.password })));
    expect((await r.json()).token).toBeTruthy();
  });

  it("salir invalida el token", async () => {
    const token = await cuentaApp();
    await call("/auth/logout", bearer(token, json({})));
    expect((await call("/auth/me", bearer(token))).status).toBe(401);
  });

  it("un token inventado no vale", async () => {
    await cuentaApp();
    expect((await call("/month", bearer("inventado"))).status).toBe(401);
  });
});

describe("registro abierto", () => {
  // Se llama al Worker con REGISTRO_ABIERTO = "si", como en el entorno de pruebas.
  const abierto = (path, init) => worker.fetch(new Request(BASE + "/api" + path, init), { ...env, REGISTRO_ABIERTO: "si" });

  it("deja crear varias cuentas, cada una con sus propias categorías", async () => {
    expect((await abierto("/auth/register", json(nueva))).status).toBe(201);
    const r = await abierto("/auth/register", asApp(json({ name: "Otra", email: "otra@dipper.test", password: "contraseña2" })));
    expect(r.status).toBe(201);
    const { token } = await r.json();
    const cats = await (await abierto("/categories", bearer(token))).json();
    expect(cats.categories).toHaveLength(6);
    const { results } = await env.DB.prepare("SELECT COUNT(*) AS n FROM categories").all();
    expect(results[0].n).toBe(12);
  });

  it("no deja repetir correo", async () => {
    await abierto("/auth/register", json(nueva));
    expect((await abierto("/auth/register", json({ ...nueva, name: "Otra vez" }))).status).toBe(409);
  });

  it("cerrado (la app real hoy), solo admite la primera cuenta", async () => {
    await cuentaApp();
    expect((await call("/auth/register", json({ name: "Otra", email: "otra@dipper.test", password: "contraseña2" }))).status).toBe(403);
  });
});

describe("borrar la cuenta", () => {
  it("pide la contraseña y borra todos los datos del usuario", async () => {
    const token = await cuentaApp();
    const { categories } = await (await call("/categories", bearer(token))).json();
    await call("/cards", bearer(token, json({ name: "Visa", last4: "1111", walletName: "Mi Visa", color: "#1B1B1F" })));
    await call("/charges", bearer(token, json({ amountCents: 500, categoryId: categories[0].id, date: Date.now() })));

    expect((await call("/auth/delete-account", bearer(token, json({ password: "mala" })))).status).toBe(401);
    expect((await call("/auth/delete-account", bearer(token, json({ password: nueva.password })))).status).toBe(200);

    for (const t of ["users", "sessions", "cards", "categories", "charges"]) {
      const { results } = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).all();
      expect(results[0].n, t).toBe(0);
    }
    expect((await call("/auth/me", bearer(token))).status).toBe(401);
    // Y el correo queda libre para volver a registrarse.
    expect((await call("/auth/register", json(nueva))).status).toBe(201);
  });

  it("sin sesión no se puede", async () => {
    expect((await call("/auth/delete-account", json({ password: "x" }))).status).toBe(401);
  });
});

describe("pagos con la sesión (acción de Atajos)", () => {
  it("acepta los mismos formatos que el enlace y no duplica", async () => {
    const token = await cuentaApp();
    const pago = { importe: "12,50 €", comercio: "MERCADONA VALENCIA", tarjeta: "Mi Visa", fecha: "2026-10-10T12:00:00Z" };
    const r1 = await call("/pagos", bearer(token, json(pago)));
    expect(r1.status).toBe(201);
    expect(await r1.json()).toEqual({ ok: true, recibidos: 1, nuevos: 1 });
    expect(await (await call("/pagos", bearer(token, json({ cola: JSON.stringify(pago) })))).json()).toEqual({ ok: true, recibidos: 1, nuevos: 0 });
    const { count } = await (await call("/pending/count", bearer(token))).json();
    expect(count).toBe(1);
  });

  it("sin sesión no entra nada", async () => {
    await cuentaApp();
    expect((await call("/pagos", json({ importe: "1", comercio: "X" }))).status).toBe(401);
  });
});
