// La API completa contra una D1 local: acceso, llegada de pagos, Por revisar, tarjetas y categorías.
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const BASE = "https://dipper.test";

// Cliente con su propia cookie de sesión.
function cliente() {
  let cookie = "";
  async function call(path, body, method) {
    const res = await SELF.fetch(BASE + "/api" + path, {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    let data = null;
    try {
      data = await res.json();
    } catch {}
    return { status: res.status, data };
  }
  return { call };
}

// Cuenta nueva con sesión, su enlace de ingesta y sus categorías por nombre.
async function cuenta() {
  const c = cliente();
  const reg = await c.call("/auth/register", { name: "Prueba", email: "prueba@dipper.test", password: "contraseña1" });
  expect(reg.status).toBe(201);
  const { data: link } = await c.call("/applepay");
  const { data: cats } = await c.call("/categories");
  const cat = (nombre) => cats.categories.find((x) => x.name === nombre).id;
  const ingest = (body, raw) =>
    SELF.fetch(BASE + "/api/ingest/" + link.token, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ?? JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, data: await r.json() }));
  return { ...c, token: link.token, cat, ingest };
}

const pago = (comercio, importe, minutos = 0, tarjeta = "Mi Visa") => ({
  comercio,
  importe,
  tarjeta,
  fecha: new Date(Date.UTC(2026, 9, 10, 12, minutos)).toISOString(),
});

describe("acceso", () => {
  it("solo se puede crear la primera cuenta, con sus 6 categorías", async () => {
    const a = await cuenta();
    const { data } = await a.call("/categories");
    expect(data.categories.map((c) => c.name)).toEqual(["Súper", "Comida fuera", "Transporte", "Ocio", "Ropa", "Suscripciones"]);
    const otra = await cliente().call("/auth/register", { name: "Otra", email: "otra@dipper.test", password: "contraseña2" });
    expect(otra.status).toBe(403);
  });

  it("sin sesión la API responde 401", async () => {
    expect((await cliente().call("/month")).status).toBe(401);
  });

  it("el mismo error con correo inexistente o contraseña mala, y bloqueo tras 5 fallos", async () => {
    await cuenta();
    const c = cliente();
    const mal = await c.call("/auth/login", { email: "prueba@dipper.test", password: "otra-cosa" });
    const nadie = await c.call("/auth/login", { email: "nadie@dipper.test", password: "otra-cosa" });
    expect(mal).toEqual(nadie);
    expect(mal.status).toBe(401);
    for (let i = 0; i < 4; i++) await c.call("/auth/login", { email: "prueba@dipper.test", password: "otra-cosa" });
    expect((await c.call("/auth/login", { email: "prueba@dipper.test", password: "contraseña1" })).status).toBe(429);
  });

  it("entra con la contraseña correcta, en mayúsculas o no", async () => {
    await cuenta();
    const c = cliente();
    expect((await c.call("/auth/login", { email: "PRUEBA@dipper.test", password: "contraseña1" })).status).toBe(200);
    expect((await c.call("/auth/me")).data.user.email).toBe("prueba@dipper.test");
  });
});

describe("llegada de pagos", () => {
  it("lee la cola de Atajos y no duplica lo que ya llegó", async () => {
    const a = await cuenta();
    const cola = [pago("MERCADONA VALENCIA", "12,50 €", 1), pago("BAR PACO", "3,20", 2)].map((p) => JSON.stringify(p)).join("\n");
    expect((await a.ingest({ cola })).data).toEqual({ ok: true, recibidos: 2, nuevos: 2 });
    expect((await a.ingest({ cola })).data).toEqual({ ok: true, recibidos: 2, nuevos: 0 });
    const { data } = await a.call("/pending");
    expect(data.items.map((i) => [i.merchant, i.amountCents])).toEqual([
      ["Bar Paco", 320],
      ["Mercadona", 1250],
    ]);
  });

  it("una cola vacía es 200 y un pago sin importe es 400", async () => {
    const a = await cuenta();
    expect((await a.ingest({ cola: " " })).status).toBe(200);
    expect((await a.ingest({ comercio: "X" })).status).toBe(400);
  });

  it("un enlace falso no vale", async () => {
    await cuenta();
    const r = await SELF.fetch(BASE + "/api/ingest/dpr_falso", { method: "POST", body: "{}" });
    expect(r.status).toBe(401);
  });

  it("sugiere la categoría de las cadenas conocidas", async () => {
    const a = await cuenta();
    await a.ingest(pago("MERCADONA VALENCIA", "10"));
    const { data } = await a.call("/pending");
    expect(data.items[0].suggestedCategoryId).toBe(a.cat("Súper"));
  });
});

describe("Por revisar", () => {
  it("recordar coloca los pendientes del mismo comercio y los que lleguen", async () => {
    const a = await cuenta();
    await a.ingest([pago("BAR PACO", "3", 1), pago("BAR PACO", "4", 2)]);
    const { data } = await a.call("/pending");
    const ocio = a.cat("Ocio");
    const r = await a.call(`/pending/${data.items[0].id}/confirm`, { categoryId: ocio, remember: true });
    expect(r.data.appliedIds).toHaveLength(1);
    await a.ingest(pago("BAR PACO", "5", 3));
    expect((await a.call("/pending/count")).data.count).toBe(0);
    const mes = await a.call("/month?month=2026-10");
    expect(mes.data.charges.every((c) => c.categoryId === ocio && c.status === "done")).toBe(true);
  });

  it("deshacer devuelve los pagos a pendientes y olvida el comercio", async () => {
    const a = await cuenta();
    await a.ingest([pago("BAR PACO", "3", 1), pago("BAR PACO", "4", 2)]);
    const [first] = (await a.call("/pending")).data.items;
    const { data } = await a.call(`/pending/${first.id}/confirm`, { categoryId: a.cat("Ocio"), remember: true });
    await a.call(`/pending/${first.id}/undo`, { forgetRule: true, appliedIds: data.appliedIds });
    expect((await a.call("/pending/count")).data.count).toBe(2);
    await a.ingest(pago("BAR PACO", "5", 3));
    expect((await a.call("/pending/count")).data.count).toBe(3);
  });

  it("el nombre propio se aplica a todos los pagos del comercio y a los nuevos", async () => {
    const a = await cuenta();
    await a.ingest([pago("CSM*MISLATA 0042", "3", 1), pago("CSM*MISLATA 0042", "4", 2)]);
    const [first] = (await a.call("/pending")).data.items;
    await a.call(`/pending/${first.id}/confirm`, { categoryId: a.cat("Súper"), remember: true, name: "Consum Mislata" });
    await a.ingest(pago("CSM*MISLATA 0042", "5", 3));
    const mes = await a.call("/month?month=2026-10");
    expect(mes.data.charges.map((c) => c.merchant)).toEqual(["Consum Mislata", "Consum Mislata", "Consum Mislata"]);
    expect(mes.data.charges[0].merchantRaw).toBe("CSM*MISLATA 0042");
  });

  it("confirmar exige una categoría", async () => {
    const a = await cuenta();
    await a.ingest(pago("BAR PACO", "3"));
    const [p] = (await a.call("/pending")).data.items;
    expect((await a.call(`/pending/${p.id}/confirm`, { remember: true })).status).toBe(400);
  });
});

describe("tarjetas", () => {
  const tarjeta = (a, name, last4, walletName) => a.call("/cards", { name, last4, walletName, color: "#1B1B1F" });

  it("reconoce la tarjeta por su nombre en Wallet o por sus 4 dígitos", async () => {
    const a = await cuenta();
    const visa = (await tarjeta(a, "Visa", "1111", "Mi Visa")).data.card;
    const amex = (await tarjeta(a, "Amex", "2222", null)).data.card;
    await a.ingest([pago("BAR PACO", "3", 1, "MI VISA"), pago("BAR PACO", "4", 2, "Amex ···· 2222")]);
    const items = (await a.call("/pending")).data.items;
    expect(items.map((i) => i.card && i.card.last4).sort()).toEqual([amex.last4, visa.last4].sort());
  });

  it("con dos tarjetas que se llaman igual pide elegir, aunque el comercio esté recordado", async () => {
    const a = await cuenta();
    const uno = (await tarjeta(a, "Santi", "1111", "Visa Travel Rewards")).data.card;
    const dos = (await tarjeta(a, "Claudia", "2222", "Visa Travel Rewards")).data.card;
    await a.ingest(pago("BAR PACO", "3", 1, "Visa Travel Rewards"));
    let [p] = (await a.call("/pending")).data.items;
    expect(p.cardCheck).toBe(true);
    expect(p.cardId).toBeNull();
    expect(p.cardOptions.map((o) => o.id)).toEqual([uno.id, dos.id]);
    expect((await a.call(`/pending/${p.id}/confirm`, { categoryId: a.cat("Ocio"), remember: true })).status).toBe(400);
    await a.call(`/pending/${p.id}/confirm`, { categoryId: a.cat("Ocio"), remember: true, cardId: dos.id });

    await a.ingest(pago("BAR PACO", "4", 2, "Visa Travel Rewards"));
    [p] = (await a.call("/pending")).data.items;
    expect(p.cardCheck).toBe(true);
    expect(p.cardId).toBe(dos.id); // la última usada en ese comercio
    expect(p.suggestedCategoryId).toBe(a.cat("Ocio"));
  });

  it("al guardar la tarjeta después, se le asignan los pagos que esperaban", async () => {
    const a = await cuenta();
    await a.ingest(pago("BAR PACO", "3", 1, "Mi Visa"));
    const { card } = (await tarjeta(a, "Visa", "1111", "Mi Visa")).data;
    const [p] = (await a.call("/pending")).data.items;
    expect(p.card.last4).toBe(card.last4);
  });

  it("borrar una tarjeta conserva sus pagos", async () => {
    const a = await cuenta();
    const { card } = (await tarjeta(a, "Visa", "1111", "Mi Visa")).data;
    await a.ingest(pago("BAR PACO", "3", 1, "Mi Visa"));
    await a.call(`/cards/${card.id}/delete`, {});
    const [p] = (await a.call("/pending")).data.items;
    expect(p.card).toBeNull();
  });
});

describe("categorías, pagos a mano y presupuesto", () => {
  it("borrar una categoría devuelve sus pagos a Por revisar", async () => {
    const a = await cuenta();
    await a.ingest(pago("BAR PACO", "3"));
    const [p] = (await a.call("/pending")).data.items;
    await a.call(`/pending/${p.id}/confirm`, { categoryId: a.cat("Ocio"), remember: true });
    await a.call(`/categories/${a.cat("Ocio")}/delete`, {});
    expect((await a.call("/pending/count")).data.count).toBe(1);
  });

  it("un gasto a mano entra resuelto y cuenta en el mes", async () => {
    const a = await cuenta();
    const r = await a.call("/charges", { amountCents: 1250, merchant: "", categoryId: a.cat("Ocio"), cardId: null, date: Date.now() });
    expect(r.status).toBe(201);
    const mes = await a.call("/month");
    expect(mes.data.charges[0]).toMatchObject({ amountCents: 1250, merchant: "Ocio", status: "done", source: "manual" });
  });

  it("un pago se puede pasar a un mes futuro y el historial lo lleva por orden de registro", async () => {
    const a = await cuenta();
    const ocio = a.cat("Ocio");
    const { data: p1 } = await a.call("/charges", { amountCents: 1000, merchant: "Uno", categoryId: ocio, cardId: null, date: Date.now() });
    const { data: p2 } = await a.call("/charges", { amountCents: 2000, merchant: "Dos", categoryId: ocio, cardId: null, date: Date.now() });
    const proximo = Date.now() + 40 * 86400000;
    expect((await a.call(`/charges/${p1.id}`, { date: proximo })).status).toBe(200);
    expect((await a.call(`/charges/${p1.id}`, { date: Date.now() + 5 * 366 * 86400000 })).status).toBe(400);
    expect((await a.call(`/charges/${p1.id}`, { date: "x" })).status).toBe(400);
    const pago = (await a.call(`/charges/${p1.id}`)).data.charge;
    expect(pago.occurredAt).toBe(proximo);
    const mes = (await a.call("/month")).data;
    expect(mes.charges.map((c) => c.id)).toEqual([p2.id]);
    expect(mes.latest > mes.current).toBe(true);
    const h = (await a.call("/history")).data;
    expect(h.charges.map((c) => c.id)).toEqual([p2.id, p1.id]);
    expect(h.charges[1].createdAt).toBeLessThanOrEqual(h.charges[0].createdAt);
  });

  it("se puede corregir el importe de un pago", async () => {
    const a = await cuenta();
    const { data: p } = await a.call("/charges", { amountCents: 1000, merchant: "Uno", categoryId: a.cat("Ocio"), cardId: null, date: Date.now() });
    expect((await a.call(`/charges/${p.id}`, { amountCents: 2575 })).status).toBe(200);
    expect((await a.call(`/charges/${p.id}`)).data.charge.amountCents).toBe(2575);
    expect((await a.call(`/charges/${p.id}`, { amountCents: 0 })).status).toBe(400);
    expect((await a.call(`/charges/${p.id}`, { amountCents: "x" })).status).toBe(400);
    expect((await a.call("/month")).data.totalCents).toBe(2575);
  });

  it("el mes trae los totales calculados y se puede filtrar por tarjeta o categoría", async () => {
    const a = await cuenta();
    const { card } = (await a.call("/cards", { name: "Visa", last4: "1111", walletName: "Mi Visa", color: "#1B1B1F" })).data;
    const ocio = a.cat("Ocio");
    await a.call("/charges", { amountCents: 1000, categoryId: ocio, cardId: card.id, date: Date.now() });
    await a.call("/charges", { amountCents: 500, categoryId: a.cat("Ropa"), cardId: null, date: Date.now() });
    const mes = (await a.call("/month")).data;
    expect(mes.totalCents).toBe(1500);
    expect(mes.leftCents).toBe(mes.monthlyBudgetCents - 1500);
    expect(mes.cards[0]).toMatchObject({ spentCents: 1000, percentOfTotal: 67 });
    expect(mes.categories.find((c) => c.id === ocio)).toMatchObject({ spentCents: 1000, byCard: [{ cardId: card.id, spentCents: 1000 }] });

    const deTarjeta = (await a.call(`/month?tarjeta=${card.id}`)).data;
    expect(deTarjeta.charges).toHaveLength(1);
    expect(deTarjeta.chargesTotalCents).toBe(1000);
    expect(deTarjeta.totalCents).toBe(1500); // los totales siguen siendo del mes
    expect((await a.call(`/month?categoria=${a.cat("Ropa")}`)).data.chargesTotalCents).toBe(500);
  });

  it("el orden de las categorías se guarda y se usa en toda la app", async () => {
    const a = await cuenta();
    const ids = (await a.call("/categories")).data.categories.map((c) => c.id);
    const nuevo = [ids[3], ids[0], ids[5], ids[1], ids[4], ids[2]];
    expect((await a.call("/categories/order", { ids: nuevo })).status).toBe(200);
    expect((await a.call("/categories")).data.categories.map((c) => c.id)).toEqual(nuevo);
    expect((await a.call("/month")).data.categories.map((c) => c.id)).toEqual(nuevo);
    // Incompleto, repetido o con ids ajenos: no se acepta.
    expect((await a.call("/categories/order", { ids: nuevo.slice(1) })).status).toBe(400);
    expect((await a.call("/categories/order", { ids: [nuevo[0], ...nuevo.slice(0, 5)] })).status).toBe(400);
    expect((await a.call("/categories/order", { ids: [9999, ...nuevo.slice(1)] })).status).toBe(400);
  });

  it("el presupuesto no admite importes negativos", async () => {
    const a = await cuenta();
    expect((await a.call("/budget", { monthlyBudgetCents: -1, categories: [] })).status).toBe(400);
    expect((await a.call("/budget", { monthlyBudgetCents: 200000, categories: [{ id: a.cat("Ocio"), budgetCents: 5000 }] })).status).toBe(200);
    expect((await a.call("/month")).data.monthlyBudgetCents).toBe(200000);
  });
});
