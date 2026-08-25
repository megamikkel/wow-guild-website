import { syncBlizzardRoster } from "./blizzard/adapter";
import { syncRaidHelper } from "./raid-helper/adapter";
import { syncRaiderIo } from "./raider-io/adapter";
import { syncWarcraftLogs } from "./warcraft-logs/adapter";
import { recordSync, type IntegrationName, type SyncResult } from "./types";

/**
 * Sync orchestrator. Runs each configured adapter, records health and
 * history. One failing integration never blocks the others — PAPI keeps
 * serving the last good data (stale-while-revalidate at the database
 * level).
 */

const ADAPTERS: Array<{ name: IntegrationName; run: () => Promise<SyncResult> }> = [
  { name: "battle_net", run: syncBlizzardRoster },
  { name: "raider_io", run: syncRaiderIo },
  { name: "raid_helper", run: syncRaidHelper },
  { name: "warcraft_logs", run: syncWarcraftLogs },
];

export async function runSync(only?: string[]): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const adapter of ADAPTERS) {
    if (only && only.length > 0 && !only.includes(adapter.name)) continue;
    const startedAt = new Date();
    let result: SyncResult;
    try {
      result = await adapter.run();
    } catch (err) {
      result = {
        integration: adapter.name,
        ok: false,
        message: err instanceof Error ? err.message : "unknown error",
        itemsUpserted: 0,
      };
    }
    try {
      await recordSync({ ...result, startedAt });
    } catch (err) {
      console.error(`[sync] failed to record ${adapter.name} run`, err);
    }
    results.push(result);
  }
  return results;
}
