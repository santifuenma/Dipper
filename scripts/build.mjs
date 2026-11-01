// Genera public/sw.js a partir de scripts/sw.template.js: le pone la lista de archivos de la app y una versión
// (hash de todo su contenido). Cada despliegue con cambios produce un sw.js distinto, el navegador lo instala,
// descarga todos los archivos nuevos juntos y solo entonces los usa: nunca se mezclan versiones.
// Se ejecuta solo antes de `npm run dev`, `deploy` y `deploy:pruebas` (o a mano con `npm run build`).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");
const template = readFileSync(join(root, "scripts", "sw.template.js"), "utf8");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(pub)
  .map((f) => relative(pub, f).split(sep).join("/"))
  .filter((f) => f !== "sw.js")
  .sort();

const hash = createHash("sha256").update(template);
for (const f of files) hash.update(f).update(readFileSync(join(pub, f)));
const version = hash.digest("hex").slice(0, 10);

// La página se sirve en "/" (no en /index.html).
const assets = ["/", ...files.filter((f) => f !== "index.html").map((f) => "/" + f)];

writeFileSync(
  join(pub, "sw.js"),
  template.replace("__VERSION__", version).replace("__ASSETS__", JSON.stringify(assets, null, 2))
);
console.log(`sw.js generado: versión ${version}, ${assets.length} archivos`);
