const TZ = "Europe/Madrid";
const time = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const shortDay = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });

// Punto de miles siempre (Intl en español no agrupa números de 4 cifras).
const thousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// 123450 -> "1.234,50 €"
export function euros(cents) {
  const abs = Math.abs(Math.round(cents));
  return (cents < 0 ? "-" : "") + thousands(Math.floor(abs / 100)) + "," + String(abs % 100).padStart(2, "0") + " €";
}

// 128450 -> "1.285" (euros redondeados, como en el diseño)
export const eurosInt = (cents) => (cents < 0 ? "-" : "") + thousands(Math.round(Math.abs(cents) / 100));

export const dayKey = (ts) => dayKeyFmt.format(ts);
export const monthKey = (ts) => dayKey(ts).slice(0, 7);
export const timeOf = (ts) => time.format(ts);

// "hoy", "ayer" o "lun 12 oct"
export function dayLabel(ts) {
  const d = dayKey(ts);
  if (d === dayKey(Date.now())) return "hoy";
  if (d === dayKey(Date.now() - 86400000)) return "ayer";
  return shortDay.format(ts).replace(/\./g, "").replace(",", "");
}

// "Hoy" / "Ayer" / "Lun 12 oct" para cabeceras de grupo
export const dayTitle = (ts) => {
  const l = dayLabel(ts);
  return l[0].toUpperCase() + l.slice(1);
};

// "hoy · 18:42"
export const when = (ts) => dayLabel(ts) + " · " + timeOf(ts);

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// "2026-10" -> "octubre" (o "octubre 2025" si no es este año)
export function monthLabel(m) {
  const [y, mo] = m.split("-").map(Number);
  const thisYear = Number(monthKey(Date.now()).slice(0, 4));
  return MONTHS[mo - 1] + (y === thisYear ? "" : " " + y);
}

export function shiftMonth(m, delta) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
}
