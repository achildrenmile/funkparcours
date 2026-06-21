import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.js";
import * as schema from "./schema.js";

// max=10 keeps things tidy for a small app; one client shared across requests.
export const sql = postgres(env.databaseUrl, { max: 10 });
export const db = drizzle(sql, { schema });
export { schema };
