import { eq } from "drizzle-orm";

import { getDb, tables } from "@/lib/db";

/**
 * Shared integration plumbing. Every adapter follows the same pattern:
 *   External API → fetch → validate (zod) → normalize (typed domain) → upsert.
 * UI components never see external response shapes.
 */

export type IntegrationName =
  | "discord"
  | "raid_helper"
  | "raider_io"
  | "warcraft_logs"
  | "battle_net";

export interface SyncResult {
  integration: IntegrationName;
  ok: boolean;
  skipped?: boolean;
  message: string;
  itemsUpserted: number;
}

/** Fetch with timeout, retry with backoff, and 429 handling. */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  { retries = 2, timeoutMs = 15_000 }: { retries?: number; timeoutMs?: number } = {},
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") ?? "2");
        await sleep(Math.min(retryAfter, 30) * 1000);
        continue;
      }
      if (res.status >= 500 && attempt < retries) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retries) await sleep(2 ** attempt * 1000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Persist a sync run + integration health. Error messages must never contain secrets. */
export async function recordSync(
  result: SyncResult & { startedAt: Date },
): Promise<void> {
  const db = await getDb();
  await db.insert(tables.syncRuns).values({
    integration: result.integration,
    startedAt: result.startedAt,
    finishedAt: new Date(),
    ok: result.ok,
    message: result.message.slice(0, 500),
    itemsUpserted: result.itemsUpserted,
  });

  const now = new Date();
  const state = result.skipped ? "NOT_CONFIGURED" : result.ok ? "CONNECTED" : "ERROR";
  const values = {
    name: result.integration,
    state: state as "CONNECTED" | "ERROR" | "NOT_CONFIGURED",
    lastSyncAt: now,
    lastSuccessAt: result.ok && !result.skipped ? now : undefined,
    lastError: result.ok ? null : result.message.slice(0, 500),
  };
  const existing = await db
    .select()
    .from(tables.integrationConnections)
    .where(eq(tables.integrationConnections.name, result.integration))
    .limit(1);
  if (existing[0]) {
    await db
      .update(tables.integrationConnections)
      .set(values)
      .where(eq(tables.integrationConnections.id, existing[0].id));
  } else {
    await db.insert(tables.integrationConnections).values(values);
  }
}
