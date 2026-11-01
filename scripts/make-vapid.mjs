// Genera un par de claves VAPID (identifican a tu servidor ante los servicios de push) y las guarda
// como secretos del Worker, sin enseñarlas:
//   node scripts/make-vapid.mjs            -> producción (wrangler secret put)
//   node scripts/make-vapid.mjs pruebas    -> entorno de pruebas
// Cada entorno necesita sus propias claves: una suscripción solo vale con la clave con la que se creó.
import { spawnSync } from "node:child_process";

const env = process.argv[2];
const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
const priv = JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d });
const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
const pub = Buffer.from(raw).toString("base64url");

for (const [name, value] of [["VAPID_PUBLIC", pub], ["VAPID_PRIVATE", priv]]) {
  const args = ["wrangler", "secret", "put", name, ...(env ? ["--env", env] : [])];
  const r = spawnSync("npx", args, { input: value, stdio: ["pipe", "inherit", "inherit"], shell: true });
  if (r.status !== 0) process.exit(r.status || 1);
}
console.log(`Claves VAPID guardadas${env ? " en " + env : " en producción"}.`);
