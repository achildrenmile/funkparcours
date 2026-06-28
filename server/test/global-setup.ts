import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Apply drizzle migrations once before the whole suite. Mirrors src/db/migrate.ts
// but takes DATABASE_URL straight from the test env (CI service or local :5433).
export default async function setup() {
  const url =
    process.env.DATABASE_URL ?? "postgres://funk:funk@localhost:5432/funkparcours";
  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = resolve(here, "../drizzle");
  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}
