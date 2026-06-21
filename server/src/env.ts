import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3000),
  PUBLIC_BASE_URL: z.string().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(8).default("dev-insecure-change-me"),
  COOKIE_SECURE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  DATABASE_URL: z.string().optional(),
  POSTGRES_USER: z.string().default("funk"),
  POSTGRES_PASSWORD: z.string().default("funk"),
  POSTGRES_DB: z.string().default("funkparcours"),
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z.coerce.number().default(5432),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  DEFAULT_EXPIRY_DAYS: z.coerce.number().default(30),
});

const parsed = schema.parse(process.env);

export const env = {
  ...parsed,
  databaseUrl:
    parsed.DATABASE_URL ??
    `postgres://${parsed.POSTGRES_USER}:${parsed.POSTGRES_PASSWORD}@${parsed.POSTGRES_HOST}:${parsed.POSTGRES_PORT}/${parsed.POSTGRES_DB}`,
  isProd: parsed.NODE_ENV === "production",
};
