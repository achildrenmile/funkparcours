import { defineConfig } from "drizzle-kit";

const url =
  process.env.DATABASE_URL ??
  `postgres://${process.env.POSTGRES_USER ?? "funk"}:${process.env.POSTGRES_PASSWORD ?? "funk"}@${process.env.POSTGRES_HOST ?? "localhost"}:${process.env.POSTGRES_PORT ?? "5432"}/${process.env.POSTGRES_DB ?? "funkparcours"}`;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
