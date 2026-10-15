// Pone una contraseña nueva a tu cuenta de Dipper desde el ordenador (si la olvidaste y no tienes Face ID).
// Uso: npm run reset-password
// Cierra todas las sesiones abiertas; luego entra en el iPhone con la contraseña nueva.
import { execSync } from "node:child_process";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const rl = createInterface({ input: process.stdin, output: process.stdout });
const pw = await rl.question("Contraseña nueva (mínimo 8 caracteres): ");
const again = await rl.question("Repítela: ");
rl.close();

if (pw.length < 8) {
  console.error("La contraseña necesita mínimo 8 caracteres.");
  process.exit(1);
}
if (pw !== again) {
  console.error("No coinciden.");
  process.exit(1);
}

// Mismos parámetros que el servidor (src/auth.js): PBKDF2-SHA256, 100.000 iteraciones, 32 bytes.
const salt = randomBytes(16);
const hash = pbkdf2Sync(pw, salt, 100000, 32, "sha256");

const sqlFile = join(tmpdir(), `dipper-reset-${Date.now()}.sql`);
writeFileSync(
  sqlFile,
  `UPDATE users SET password_hash = '${b64url(hash)}', password_salt = '${b64url(salt)}';\n` +
    "DELETE FROM sessions;\nDELETE FROM login_failures;\n"
);
try {
  execSync(`npx wrangler d1 execute dipper --remote --file "${sqlFile}"`, { stdio: "inherit" });
  console.log("\nListo. Entra en Dipper con la contraseña nueva.");
} finally {
  unlinkSync(sqlFile);
}
