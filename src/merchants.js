// Comercios: normalización del nombre que manda Apple Pay y sugerencias de categoría.
// slug = icono de la categoría por defecto (sup, com, tra, oci, rop, sus).

const KNOWN = [
  // Súper
  [/\bMERCADONA\b/, "Mercadona", "sup"],
  [/\bCARREFOUR\b/, "Carrefour", "sup"],
  [/\bLIDL\b/, "Lidl", "sup"],
  [/\bDIA\b/, "Dia", "sup"],
  [/\bALDI\b/, "Aldi", "sup"],
  [/\bCONSUM\b/, "Consum", "sup"],
  [/\bEROSKI\b/, "Eroski", "sup"],
  [/\bALCAMPO\b/, "Alcampo", "sup"],
  [/\bHIPERCOR\b/, "Hipercor", "sup"],
  // Suscripciones
  [/\bSPOTIFY\b/, "Spotify", "sus"],
  [/\bNETFLIX\b/, "Netflix", "sus"],
  [/\bDISNEY\b/, "Disney+", "sus"],
  [/\bHBO\b|\bMAX COM\b/, "Max", "sus"],
  [/\bAMAZON PRIME\b|\bPRIME VIDEO\b/, "Amazon Prime", "sus"],
  [/\bAPPLE COM BILL\b|\bAPPLE COM\b/, "Apple", "sus"],
  [/\bYOUTUBE\b/, "YouTube", "sus"],
  // Transporte
  [/\bREPSOL\b/, "Repsol", "tra"],
  [/\bCEPSA\b|\bMOEVE\b/, "Cepsa", "tra"],
  [/\bBP\b/, "BP", "tra"],
  [/\bGALP\b/, "Galp", "tra"],
  [/\bSHELL\b/, "Shell", "tra"],
  [/\bCABIFY\b/, "Cabify", "tra"],
  [/\bUBER\b/, "Uber", "tra"],
  [/\bBOLT\b/, "Bolt", "tra"],
  [/\bRENFE\b/, "Renfe", "tra"],
  // Comida fuera
  [/\bMCDONALD/, "McDonald's", "com"],
  [/\bBURGER KING\b/, "Burger King", "com"],
  [/\bTELEPIZZA\b/, "Telepizza", "com"],
  [/\bGLOVO\b/, "Glovo", "com"],
  [/\bJUST EAT\b/, "Just Eat", "com"],
  [/\bSTARBUCKS\b/, "Starbucks", "com"],
  // Ropa
  [/\bZARA\b/, "Zara", "rop"],
  [/\bPRIMARK\b/, "Primark", "rop"],
  [/\bMANGO\b/, "Mango", "rop"],
  [/\bBERSHKA\b/, "Bershka", "rop"],
  [/\bPULL (AND )?BEAR\b/, "Pull&Bear", "rop"],
  [/\bH M\b|\bH AND M\b/, "H&M", "rop"],
  // Ocio
  [/\bCINESA\b/, "Cinesa", "oci"],
  [/\bYELMO\b/, "Yelmo", "oci"],
];

export function normalize(raw) {
  return String(raw)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !/\d/.test(w))
    .join(" ")
    .trim();
}

function titleCase(text) {
  return text
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length <= 2 && w !== "la" && w !== "el" && w !== "de" ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

// { key, name, slug } — key agrupa el mismo comercio aunque cambie la tienda o la ciudad.
export function merchantInfo(raw) {
  const norm = normalize(raw);
  for (const [re, name, slug] of KNOWN) {
    if (re.test(norm)) return { key: name.toUpperCase(), name, slug };
  }
  const key = norm || "DESCONOCIDO";
  return { key, name: norm ? titleCase(norm) : "Desconocido", slug: null };
}
