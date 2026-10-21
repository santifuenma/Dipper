// Rellena una cuenta de demostración con tarjetas, presupuesto y pagos del mes en curso,
// para enseñar las pantallas con datos (capturas, pruebas de la app nativa…).
// Uso: npm run dev (en otra terminal) y después npm run demo  ·  otra dirección: npm run demo -- <url>
// Solo para la base local o la de pruebas: nunca contra la app real.
const BASE = (process.argv[2] || "http://localhost:8787").replace(/\/$/, "");
if (BASE.includes("dipper.dipper-app")) throw new Error("Esto no se usa con la app real.");

const DEMO = { name: "Santi", email: "demo@dipper.test", password: "demo-dipper-2026" };

const CARDS = [
  { name: "Visa Oro", last4: "4821", walletName: "BBVA Visa Oro", color: "#FFC93C" },
  { name: "Revolut", last4: "0937", walletName: "Revolut Mastercard", color: "#3F5BFF" },
  { name: "Amex", last4: "1006", walletName: "American Express Gold", color: "#1B1B1F" },
  { name: "Débito", last4: "5512", walletName: "CaixaBank Débito", color: "#6FE0AA" },
];

// [día del mes, hora, importe, comercio tal como llega de Apple Pay, tarjeta en Wallet, categoría (null = se queda en Por revisar)]
const APPLE_PAY = [
  [1, "09:12", 62.4, "MERCADONA VALENCIA", "BBVA Visa Oro", "sup"],
  [2, "13:45", 10.99, "SPOTIFY AB", "Revolut Mastercard", "sus"],
  [2, "21:30", 54.0, "LA PEPICA SL", "American Express Gold", "com"],
  [3, "08:05", 52.3, "REPSOL E.S. 1234", "BBVA Visa Oro", "tra"],
  [4, "18:20", 39.95, "ZARA 4521", "Revolut Mastercard", "rop"],
  [5, "11:10", 13.99, "NETFLIX.COM", "Revolut Mastercard", "sus"],
  [6, "20:15", 18.4, "CINES LYS", "CaixaBank Débito", "oci"],
  [7, "09:40", 48.15, "MERCADONA VALENCIA", "BBVA Visa Oro", "sup"],
  [8, "14:00", 32.8, "GOIKO GRILL 12", "American Express Gold", "com"],
  [9, "07:55", 20.0, "METROVALENCIA", "CaixaBank Débito", "tra"],
  [10, "12:30", 2.99, "APPLE.COM/BILL", "Revolut Mastercard", "sus"],
  [11, "17:45", 34.99, "FNAC VALENCIA", "BBVA Visa Oro", "oci"],
  [12, "10:20", 23.6, "CONSUM 0231", "CaixaBank Débito", "sup"],
  [13, "22:10", 28.5, "BAR MANOLO", "CaixaBank Débito", "com"],
  [14, "08:30", 6.45, "STARBUCKS 4402", "Revolut Mastercard", "com"],
  [15, "19:05", 14.75, "CABIFY", "American Express Gold", "tra"],
  [15, "09:00", 29.99, "VIVAGYM", "BBVA Visa Oro", "sus"],
  [16, "21:40", 64.2, "CASA MONTANA", "American Express Gold", "com"],
  [17, "10:15", 71.3, "MERCADONA VALENCIA", "BBVA Visa Oro", "sup"],
  [18, "20:30", 19.0, "TICKETMASTER", "Revolut Mastercard", "oci"],
  [18, "21:50", 18.9, "TELEPIZZA 33", "CaixaBank Débito", "com"],
  [19, "13:20", 41.1, "GOIKO GRILL 12", "American Express Gold", "com"],
  [19, "18:00", 8.0, "VALENBISI", "CaixaBank Débito", "tra"],
  [20, "08:40", 5.9, "STARBUCKS 4402", "Revolut Mastercard", "com"],
  [20, "11:30", 14.9, "LIDL 1203", "CaixaBank Débito", "sup"],
  [21, "09:25", 39.85, "MERCADONA VALENCIA", "BBVA Visa Oro", "sup"],
  // Por revisar: comercios nuevos y una tarjeta de Wallet que no está guardada.
  [21, "08:10", 3.8, "PANADERIA ROMERO", "CaixaBank Débito", null],
  [21, "12:05", 6.2, "PARKING SABA 07", "BBVA Visa Oro", null],
  [21, "13:40", 27.49, "AMAZON EU SARL", "ING Debit Mastercard 7730", null],
];

// Gastos a mano (sin tarjeta = Efectivo).
const MANUAL = [[12, 11.2, "Churrería", "com"]];

const BUDGET_TOTAL = 150000; // 1.500 €; las categorías suman 1.400 € (quedan 100 € sin asignar)

let token = null;
async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dipper-client": "app",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${data.error || ""}`);
  return data;
}

// Fecha de este mes en hora de Madrid, sin pasar de hoy.
const now = new Date();
const today = now.getDate();
const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const when = (day, time) => `${ym}-${String(Math.min(day, today)).padStart(2, "0")}T${time}:00+02:00`;

try {
  token = (await api("POST", "/api/auth/register", DEMO)).token;
} catch (err) {
  if (!/409|403/.test(err.message)) throw err;
  token = (await api("POST", "/api/auth/login", DEMO)).token;
  console.log("La cuenta de demostración ya existía: se añaden los datos otra vez.");
}

const cardIds = [];
for (const c of CARDS) cardIds.push((await api("POST", "/api/cards", c)).card.id);

const { categories } = await api("GET", "/api/categories");
const catId = Object.fromEntries(categories.map((c) => [c.icon, c.id]));
await api("POST", "/api/budget", {
  monthlyBudgetCents: BUDGET_TOTAL,
  categories: categories.map((c) => ({ id: c.id, budgetCents: c.budget_cents ?? c.budgetCents })),
});

await api(
  "POST",
  "/api/pagos",
  APPLE_PAY.map(([d, t, importe, comercio, tarjeta]) => ({ importe, comercio, tarjeta, fecha: when(d, t) }))
);

// Confirma cada comercio una vez (recordándolo): sus otros pagos pendientes se colocan solos.
const catOf = Object.fromEntries(APPLE_PAY.map((p) => [p[3], p[5]]));
for (;;) {
  const { items } = await api("GET", "/api/pending");
  const next = items.find((i) => catOf[i.merchantRaw]);
  if (!next) break;
  await api("POST", `/api/pending/${next.id}/confirm`, { categoryId: catId[catOf[next.merchantRaw]], remember: true, cardId: next.cardId });
}

for (const [d, euros, merchant, icon] of MANUAL) {
  await api("POST", "/api/charges", {
    amountCents: Math.round(euros * 100),
    merchant,
    categoryId: catId[icon],
    cardId: null,
    date: new Date(when(d, "12:00")).getTime(),
  });
}

const month = await api("GET", "/api/month");
console.log(`Listo: ${month.charges.length} pagos este mes, ${month.pendingCount} por revisar, total ${(month.totalCents / 100).toFixed(2)} €.`);
console.log(`Entra en ${BASE} con ${DEMO.email} (la contraseña está en este archivo).`);
