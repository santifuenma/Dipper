// Funciones puras del servidor: importes, colas de Atajos y comercios.
import { describe, expect, it } from "vitest";
import { cleanMerchantName, parseAmount, parseObjects } from "../src/payments.js";
import { merchantInfo, normalize } from "../src/merchants.js";
import { daysLeftInMonth, monthSummary } from "../src/charges.js";

describe("parseAmount", () => {
  it.each([
    ["12,50 €", 12.5],
    ["€12.50", 12.5],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["-3", -3],
    [7.2, 7.2],
  ])("%s → %s", (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it("sin cifras no es un número", () => {
    expect(parseAmount("")).toBeNaN();
    expect(parseAmount(undefined)).toBeNaN();
  });
});

describe("parseObjects", () => {
  it("lee un objeto, una lista y varios objetos seguidos", () => {
    expect(parseObjects('{"importe":"1"}')).toEqual([{ importe: "1" }]);
    expect(parseObjects('[{"a":1},{"a":2}]')).toHaveLength(2);
    expect(parseObjects('{"a":1}\n{"a":2}{"a":3}')).toHaveLength(3);
  });

  it("no se confunde con llaves dentro de un texto", () => {
    expect(parseObjects('{"comercio":"BAR {EL} SITIO"}{"a":2}')).toEqual([{ comercio: "BAR {EL} SITIO" }, { a: 2 }]);
  });

  it("una cola vacía o rota no da pagos", () => {
    expect(parseObjects("")).toEqual([]);
    expect(parseObjects(" ")).toEqual([]);
    expect(parseObjects("{roto")).toEqual([]);
  });
});

describe("comercios", () => {
  it("normaliza: sin acentos, mayúsculas, & y sin palabras con cifras", () => {
    expect(normalize("Panadería L'Horno 0042")).toBe("PANADERIA L HORNO");
    expect(normalize("H&M Valencia")).toBe("H AND M VALENCIA");
  });

  it("agrupa las cadenas conocidas en una clave y les da su categoría", () => {
    expect(merchantInfo("MERCADONA VALENCIA 1234")).toEqual({ key: "MERCADONA", name: "Mercadona", slug: "sup" });
    expect(merchantInfo("CONSUM SDAD COOP")).toMatchObject({ key: "CONSUM", slug: "sup" });
  });

  it("un comercio desconocido usa su nombre normalizado", () => {
    expect(merchantInfo("BAR PACO SL")).toEqual({ key: "BAR PACO SL", name: "Bar Paco SL", slug: null });
    expect(merchantInfo("1234")).toEqual({ key: "DESCONOCIDO", name: "Desconocido", slug: null });
  });

  it("el nombre propio se limpia y tiene un máximo de 60 caracteres", () => {
    expect(cleanMerchantName("  Consum   Mislata ")).toBe("Consum Mislata");
    expect(cleanMerchantName("")).toBeNull();
    expect(cleanMerchantName("x".repeat(61))).toBeNull();
    expect(cleanMerchantName(42)).toBeNull();
  });
});

describe("resumen del mes", () => {
  const now = Date.UTC(2026, 9, 19, 12); // 19 de octubre: quedan 12 días
  const base = {
    month: "2026-10",
    current: "2026-10",
    now,
    monthlyBudgetCents: 100000,
    cards: [{ id: 1, name: "Visa" }, { id: 2, name: "Amex" }],
    categories: [
      { id: 10, name: "Súper", budgetCents: 30000 },
      { id: 11, name: "Ocio", budgetCents: 5000 },
      { id: 12, name: "Ropa", budgetCents: 0 },
    ],
    charges: [
      { amountCents: 12000, cardId: 1, categoryId: 10 },
      { amountCents: 3000, cardId: 2, categoryId: 10 },
      { amountCents: 6000, cardId: 1, categoryId: 11 },
      { amountCents: 1000, cardId: null, categoryId: null },
    ],
  };

  it("total, lo que queda y los días que faltan", () => {
    const s = monthSummary(base);
    expect(s).toMatchObject({ totalCents: 22000, leftCents: 78000, daysLeft: 12 });
    expect(daysLeftInMonth(now)).toBe(12);
    expect(daysLeftInMonth(Date.UTC(2026, 9, 31, 12))).toBe(0);
  });

  it("gasto y porcentaje por tarjeta, con su reparto por categoría", () => {
    const [visa, amex] = monthSummary(base).cards;
    expect(visa).toMatchObject({ spentCents: 18000, percentOfTotal: 82 });
    expect(visa.byCategory).toEqual([{ categoryId: 10, spentCents: 12000 }, { categoryId: 11, spentCents: 6000 }]);
    expect(amex).toMatchObject({ spentCents: 3000, percentOfTotal: 14 });
  });

  it("por categoría: lo que queda, lo que toca al día y su reparto por tarjeta", () => {
    const [sup, ocio, ropa] = monthSummary(base).categories;
    expect(sup).toMatchObject({ spentCents: 15000, leftCents: 15000, perDayCents: 1250 });
    expect(sup.byCard).toEqual([{ cardId: 1, spentCents: 12000 }, { cardId: 2, spentCents: 3000 }]);
    expect(ocio).toMatchObject({ spentCents: 6000, leftCents: -1000, perDayCents: null }); // pasada
    expect(ropa.perDayCents).toBeNull(); // sin presupuesto
  });

  it("en un mes pasado no hay días ni importe por día", () => {
    const s = monthSummary({ ...base, current: "2026-11" });
    expect(s.daysLeft).toBe(0);
    expect(s.categories[0].perDayCents).toBeNull();
  });
});
