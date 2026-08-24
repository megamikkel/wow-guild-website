import { eq } from "drizzle-orm";
import { z } from "zod";

import { guildConfig } from "@/config/guild";
import { getDb, tables } from "@/lib/db";
import { env } from "@/lib/env";
import { fetchWithRetry, sleep, type SyncResult } from "../types";

/**
 * Raider.IO adapter — https://raider.io/api (v1, no auth required).
 * Attribution: the site footer credits Raider.IO. Unauthenticated rate
 * limit is 200 req/min; we sync server-side on a schedule and space out
 * requests, so browser page views never hit Raider.IO directly.
 */

const BASE = "https://raider.io/api/v1";

const characterProfileSchema = z.object({
  name: z.string(),
  class: z.string(),
  active_spec_name: z.string().nullish(),
  gear: z.object({ item_level_equipped: z.number() }).nullish(),
  mythic_plus_scores_by_season: z
    .array(z.object({ scores: z.object({ all: z.number() }) }))
    .nullish(),
  raid_progression: z
    .record(z.string(), z.object({ summary: z.string() }))
    .nullish(),
  mythic_plus_recent_runs: z
    .array(
      z.object({
        dungeon: z.string(),
        mythic_level: z.number(),
        num_keystone_upgrades: z.number(),
        score: z.number().nullish(),
        completed_at: z.string(),
        keystone_run_id: z.number().nullish(),
      }),
    )
    .nullish(),
  last_crawled_at: z.string().nullish(),
});

export interface NormalizedCharacterStats {
  itemLevel: number | null;
  mythicPlusScore: number | null;
  raidProgressSummary: string | null;
  recentRuns: Array<{
    dungeon: string;
    level: number;
    timed: boolean;
    score: number | null;
    completedAt: Date;
    externalId: string | null;
  }>;
  lastCrawledAt: Date | null;
}

export function normalizeCharacterProfile(
  raw: z.infer<typeof characterProfileSchema>,
): NormalizedCharacterStats {
  const raidKeys = raw.raid_progression ? Object.keys(raw.raid_progression) : [];
  const latestRaid = raidKeys.length > 0 ? raidKeys[raidKeys.length - 1] : null;
  return {
    itemLevel: raw.gear?.item_level_equipped ?? null,
    mythicPlusScore: raw.mythic_plus_scores_by_season?.[0]?.scores.all ?? null,
    raidProgressSummary: latestRaid ? raw.raid_progression![latestRaid].summary : null,
    recentRuns: (raw.mythic_plus_recent_runs ?? []).map((run) => ({
      dungeon: run.dungeon,
      level: run.mythic_level,
      timed: run.num_keystone_upgrades > 0,
      score: run.score ?? null,
      completedAt: new Date(run.completed_at),
      externalId: run.keystone_run_id != null ? String(run.keystone_run_id) : null,
    })),
    lastCrawledAt: raw.last_crawled_at ? new Date(raw.last_crawled_at) : null,
  };
}

export async function fetchCharacterProfile(realmSlug: string, name: string) {
  const params = new URLSearchParams({
    region: guildConfig.region,
    realm: realmSlug,
    name,
    fields:
      "gear,mythic_plus_scores_by_season:current,raid_progression,mythic_plus_recent_runs",
  });
  if (env.raiderIo.apiKey) params.set("access_key", env.raiderIo.apiKey);
  const res = await fetchWithRetry(`${BASE}/characters/profile?${params}`);
  if (!res.ok) throw new Error(`Raider.IO responded ${res.status} for ${name}`);
  return characterProfileSchema.parse(await res.json());
}

export async function syncRaiderIo(): Promise<SyncResult> {
  if (env.isDemoMode) {
    return {
      integration: "raider_io",
      ok: true,
      skipped: true,
      message: "demo mode — fixtures in use",
      itemsUpserted: 0,
    };
  }

  const db = await getDb();
  const roster = await db.select().from(tables.characters);
  let upserted = 0;
  const failures: string[] = [];

  for (const character of roster) {
    try {
      const profile = await fetchCharacterProfile(character.realmSlug, character.name);
      const stats = normalizeCharacterProfile(profile);
      await db
        .update(tables.characters)
        .set({
          itemLevel: stats.itemLevel ?? character.itemLevel,
          mythicPlusScore: stats.mythicPlusScore ?? character.mythicPlusScore,
          raidProgressSummary: stats.raidProgressSummary ?? character.raidProgressSummary,
          raiderIoLastCrawledAt: stats.lastCrawledAt,
          syncedAt: new Date(),
        })
        .where(eq(tables.characters.id, character.id));
      for (const run of stats.recentRuns) {
        if (!run.externalId) continue;
        const existing = await db
          .select({ id: tables.mythicPlusRuns.id })
          .from(tables.mythicPlusRuns)
          .where(eq(tables.mythicPlusRuns.raiderIoRunId, run.externalId))
          .limit(1);
        if (existing.length === 0) {
          await db.insert(tables.mythicPlusRuns).values({
            characterId: character.id,
            dungeon: run.dungeon,
            level: run.level,
            timed: run.timed,
            score: run.score,
            completedAt: run.completedAt,
            raiderIoRunId: run.externalId,
          });
        }
      }
      upserted++;
    } catch (err) {
      failures.push(`${character.name}: ${err instanceof Error ? err.message : "error"}`);
    }
    await sleep(400); // stay far below 200 req/min
  }

  return {
    integration: "raider_io",
    ok: failures.length < roster.length,
    message:
      failures.length === 0
        ? `synced ${upserted} characters`
        : `synced ${upserted}/${roster.length}; failures: ${failures.slice(0, 3).join("; ")}`,
    itemsUpserted: upserted,
  };
}
