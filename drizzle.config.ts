import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Only used by `drizzle-kit migrate` against a real Postgres.
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/papi",
  },
});
