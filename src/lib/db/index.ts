import path from "node:path";

import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";

import { assertProductionConfig, env } from "@/lib/env";
import * as schema from "./schema";
import { seedDemoData } from "./seed";

export type Db = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

/**
 * Database access with two modes:
 *  - Production/staging: real Postgres via DATABASE_URL (node-postgres pool).
 *  - Demo mode: embedded PGlite (in-process Postgres) migrated + seeded on
 *    first use, so the whole platform runs with zero external services.
 *
 * The instance is cached on globalThis so Next.js dev hot-reload does not
 * spawn multiple databases.
 */
const globalForDb = globalThis as unknown as { __papiDb?: Promise<Db> };

async function createDb(): Promise<Db> {
  assertProductionConfig();

  if (!env.isDemoMode && env.databaseUrl) {
    const pool = new Pool({ connectionString: env.databaseUrl });
    return drizzlePg(pool, { schema });
  }

  // Demo mode — embedded Postgres, seeded with realistic fixtures.
  const pglite = new PGlite(); // in-memory; survives for the process lifetime
  const db = drizzlePglite(pglite, { schema });
  await migratePglite(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  await seedDemoData(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!globalForDb.__papiDb) {
    globalForDb.__papiDb = createDb();
  }
  return globalForDb.__papiDb;
}

export * as tables from "./schema";
