import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { env } from "../env.js";

const here = dirname(fileURLToPath(import.meta.url));
// drizzle output folder lives at server/drizzle (one level above dist/src/db at runtime,
// or src/db in dev); resolve relative to repo's server root.
const migrationsFolder = resolve(here, "../../drizzle");

async function main() {
  const client = postgres(env.databaseUrl, { max: 1 });
  const dbm = drizzle(client);
  console.log(`[migrate] applying migrations from ${migrationsFolder}`);
  await migrate(dbm, { migrationsFolder });
  await client.end();
  console.log("[migrate] done");
}

main().catch((err) => {
  console.error("[migrate] failed", err);
  process.exit(1);
});
