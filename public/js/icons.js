// Iconos de categoría del diseño (dipper-diseno.zip).
const PATHS = {
  sup: '<path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L19.5 8H6.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  com: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M8 7c0-1.5 1-1.5 1-3M12 7c0-1.5 1-1.5 1-3M16 7c0-1.5 1-1.5 1-3"/>',
  tra: '<rect x="4" y="5" width="16" height="12" rx="3"/><path d="M4 12h16"/><circle cx="8" cy="19" r="1.3"/><circle cx="16" cy="19" r="1.3"/>',
  oci: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  rop: '<path d="M8 4 3.5 7l2 3.5L8 9.5V20h8V9.5l2.5 1L20.5 7 16 4a4 4 0 0 1-8 0z"/>',
  sus: '<path d="M4 12a8 8 0 0 1 13.5-5.8L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 0 1-13.5 5.8L4 15.5"/><path d="M4 20v-4.5h4.5"/>',
};

export const CATEGORY_ICONS = Object.keys(PATHS);
export const CATEGORY_COLORS = ["#CDF56B", "#FFC2A1", "#A9D8FF", "#FFA8D2", "#CDB6FF", "#98EBC6"];

export function categoryIcon(icon, size = 20, stroke = 2.2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#1B1B1F" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[icon] || PATHS.sup}</svg>`;
}

// Colores de tarjeta del diseño: fondo y color del texto encima.
export const CARD_COLORS = [
  { bg: "#FF6B4A", fg: "#1B1B1F", name: "Tomate" },
  { bg: "#FFC93C", fg: "#1B1B1F", name: "Mostaza" },
  { bg: "#3F5BFF", fg: "#FFFFFF", name: "Cobalto" },
  { bg: "#1B1B1F", fg: "#FFFFFF", name: "Tinta" },
  { bg: "#7A4DF5", fg: "#FFFFFF", name: "Violeta" },
  { bg: "#6FE0AA", fg: "#1B1B1F", name: "Menta" },
];
export const cardFg = (bg) => (CARD_COLORS.find((c) => c.bg === bg) || CARD_COLORS[0]).fg;
// Borde de la tarjeta: en las negras, gris claro para que dos seguidas se distingan.
export const cardBorder = (bg) => (bg === "#1B1B1F" ? "#6A6A74" : "rgba(27,27,31,.22)");
