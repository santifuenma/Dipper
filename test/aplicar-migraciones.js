// Crea las tablas en la D1 de pruebas y la vacía antes de cada prueba, para que cada una
// empiece sin cuenta (el registro solo admite la primera).
import { applyD1Migrations, env } from "cloudflare:test";
import { beforeEach } from "vitest";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

beforeEach(async () => {
  const { results } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations'"
  ).all();
  await env.DB.batch(results.map((t) => env.DB.prepare(`DELETE FROM "${t.name}"`)));
});
