import { eq } from "drizzle-orm";
import { z } from "zod";

import { guildConfig } from "@/config/guild";
import { getDb, tables } from "@/lib/db";
import { env } from "@/lib/env";
import { fetchWithRetry, type SyncResult } from "../types";

/**
 * Warcraft Logs API v2 (GraphQL) adapter.
 * Auth: OAuth2 client credentials (public data only) — token cached in
 * memory until shortly before expiry. Credentials never leave the server.
 * Free tier: 3,600 points/hour; we run few, cheap queries on a schedule
 * and serve everything from our own database between syncs.
 */

const TOKEN_URL = "https://www.warcraftlogs.com/oauth/token";
const GRAPHQL_URL = "https://www.warcraftlogs.com/api/v2/client";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const { clientId, clientSecret } = env.warcraftLogs;
  if (!clientId || !clientSecret) throw new Error("Warcraft Logs not configured");
  const res = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`WCL token endpoint responded ${res.status}`);
  const data = z
    .object({ access_token: z.string(), expires_in: z.number() })
    .parse(await res.json());
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const token = await getAccessToken();
  const res = await fetchWithRetry(GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`WCL GraphQL responded ${res.status}`);
  const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (body.errors?.length) throw new Error(`WCL GraphQL error: ${body.errors[0].message}`);
  if (!body.data) throw new Error("WCL GraphQL returned no data");
  return body.data;
}

const REPORTS_QUERY = `
  query GuildReports($guildName: String!, $serverSlug: String!, $serverRegion: String!) {
    reportData {
      reports(guildName: $guildName, guildServerSlug: $serverSlug, guildServerRegion: $serverRegion, limit: 10) {
        data {
          code
          title
          startTime
          endTime
          fights(killType: Encounters) {
            encounterID
            name
            difficulty
            kill
            bossPercentage
          }
        }
      }
    }
  }
`;

const reportsSchema = z.object({
  reportData: z.object({
    reports: z.object({
      data: z.array(
        z.object({
          code: z.string(),
          title: z.string(),
          startTime: z.number(),
          endTime: z.number().nullish(),
          fights: z
            .array(
              z.object({
                encounterID: z.number(),
                name: z.string(),
                difficulty: z.number().nullish(),
                kill: z.boolean().nullish(),
                bossPercentage: z.number().nullish(),
              }),
            )
            .nullish(),
        }),
      ),
    }),
  }),
});

export type WclReport = z.infer<typeof reportsSchema>["reportData"]["reports"]["data"][number];

const MYTHIC_DIFFICULTY = 5;

/** Fold report fights into per-boss progress (mythic only). */
export function normalizeBossProgress(reports: WclReport[]) {
  const byBoss = new Map<
    string,
    { pulls: number; bestPct: number | null; killed: boolean; killedAt: Date | null; encounterId: number }
  >();
  // Oldest first so killedAt reflects the first kill.
  const ordered = [...reports].sort((a, b) => a.startTime - b.startTime);
  for (const report of ordered) {
    for (const fight of report.fights ?? []) {
      if (fight.difficulty !== MYTHIC_DIFFICULTY) continue;
      const entry =
        byBoss.get(fight.name) ??
        ({ pulls: 0, bestPct: null, killed: false, killedAt: null, encounterId: fight.encounterID });
      entry.pulls += 1;
      if (fight.kill) {
        entry.killed = true;
        if (!entry.killedAt) entry.killedAt = new Date(report.startTime);
        entry.bestPct = 0;
      } else if (fight.bossPercentage != null && !entry.killed) {
        entry.bestPct =
          entry.bestPct == null ? fight.bossPercentage : Math.min(entry.bestPct, fight.bossPercentage);
      }
      byBoss.set(fight.name, entry);
    }
  }
  return byBoss;
}

export async function syncWarcraftLogs(): Promise<SyncResult> {
  if (env.isDemoMode) {
    return {
      integration: "warcraft_logs",
      ok: true,
      skipped: true,
      message: "demo mode — fixtures in use",
      itemsUpserted: 0,
    };
  }
  if (!env.warcraftLogs.clientId || !env.warcraftLogs.clientSecret) {
    return {
      integration: "warcraft_logs",
      ok: true,
      skipped: true,
      message: "not configured (WARCRAFTLOGS_CLIENT_ID / WARCRAFTLOGS_CLIENT_SECRET)",
      itemsUpserted: 0,
    };
  }

  const raw = await graphql<unknown>(REPORTS_QUERY, {
    guildName: guildConfig.name,
    serverSlug: guildConfig.realm.slug,
    serverRegion: guildConfig.region,
  });
  const parsed = reportsSchema.parse(raw);
  const reports = parsed.reportData.reports.data;
  const db = await getDb();
  let upserted = 0;

  for (const report of reports) {
    const values = {
      title: report.title,
      startTime: new Date(report.startTime),
      endTime: report.endTime ? new Date(report.endTime) : null,
      url: `https://www.warcraftlogs.com/reports/${report.code}`,
      syncedAt: new Date(),
    };
    const existing = await db
      .select({ id: tables.raidReports.id })
      .from(tables.raidReports)
      .where(eq(tables.raidReports.wclCode, report.code))
      .limit(1);
    if (existing[0]) {
      await db.update(tables.raidReports).set(values).where(eq(tables.raidReports.id, existing[0].id));
    } else {
      await db.insert(tables.raidReports).values({ wclCode: report.code, ...values });
    }
    upserted++;
  }

  // Update boss progress rows that match encounter names from WCL.
  const progress = normalizeBossProgress(reports);
  const bosses = await db
    .select()
    .from(tables.bossProgress)
    .where(eq(tables.bossProgress.tierName, guildConfig.currentTier.name));
  for (const boss of bosses) {
    const stats = progress.get(boss.bossName);
    if (!stats) continue;
    await db
      .update(tables.bossProgress)
      .set({
        status: stats.killed ? "KILLED" : "PROGRESS",
        bestPct: stats.bestPct,
        pulls: stats.pulls,
        killedAt: stats.killedAt ?? boss.killedAt,
        wclEncounterId: stats.encounterId,
        syncedAt: new Date(),
      })
      .where(eq(tables.bossProgress.id, boss.id));
    upserted++;
  }

  return {
    integration: "warcraft_logs",
    ok: true,
    message: `synced ${reports.length} reports`,
    itemsUpserted: upserted,
  };
}
