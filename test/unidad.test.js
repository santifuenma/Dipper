// Funciones puras del servidor: importes, colas de Atajos y comercios.
import { describe, expect, it } from "vitest";
import { cleanMerchantName, parseAmount, parseObjects } from "../src/payments.js";
import { merchantInfo, normalize } from "../src/merchants.js";

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
