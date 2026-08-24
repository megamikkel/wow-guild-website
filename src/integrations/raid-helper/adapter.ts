import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, tables } from "@/lib/db";
import { env } from "@/lib/env";
import { fetchWithRetry, type SyncResult } from "../types";

/**
 * Raid-Helper adapter — https://raid-helper.dev/documentation/api
 * Read-only: Raid-Helper owns event creation, signups and attendance.
 * Auth: server API key from the /apikey slash command, sent as an
 * Authorization header. We poll on a schedule; no premium webhooks needed.
 */

const BASE = "https://raid-helper.dev/api";

const signupSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String).nullish(),
  name: z.string(),
  className: z.string().nullish(),
  specName: z.string().nullish(),
  entryTime: z.number().nullish(),
});

const eventSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string().nullish(),
  description: z.string().nullish(),
  startTime: z.number(),
  endTime: z.number().nullish(),
  closingTime: z.number().nullish(),
  signUps: z.array(signupSchema).nullish(),
});

const eventsResponseSchema = z.object({
  postedEvents: z.array(eventSchema).nullish(),
});

export type RaidHelperEvent = z.infer<typeof eventSchema>;

/** Raid-Helper models absence/bench/tentative as pseudo-classes. */
export function normalizeSignupStatus(
  className: string | null | undefined,
): "CONFIRMED" | "TENTATIVE" | "ABSENT" | "BENCH" {
  switch ((className ?? "").toLowerCase()) {
    case "absence":
      return "ABSENT";
    case "bench":
      return "BENCH";
    case "tentative":
    case "late":
      return "TENTATIVE";
    default:
      return "CONFIRMED";
  }
}

export function normalizeEvent(raw: RaidHelperEvent) {
  return {
    raidHelperId: raw.id,
    title: raw.title ?? "Raid",
    description: raw.description ?? null,
    startTime: new Date(raw.startTime * 1000),
    endTime: raw.endTime ? new Date(raw.endTime * 1000) : null,
    closed: raw.closingTime ? raw.closingTime * 1000 < Date.now() : false,
    signups: (raw.signUps ?? []).map((s) => ({
      raidHelperSignupId: s.id ?? null,
      name: s.name,
      className: s.className && !["absence", "bench", "tentative", "late"].includes(s.className.toLowerCase())
        ? s.className
        : null,
      specName: s.specName ?? null,
      status: normalizeSignupStatus(s.className),
      signedUpAt: s.entryTime ? new Date(s.entryTime * 1000) : null,
    })),
  };
}

export async function fetchServerEvents(): Promise<RaidHelperEvent[]> {
  const { apiKey, serverId } = env.raidHelper;
  if (!apiKey || !serverId) throw new Error("Raid-Helper not configured");
  const res = await fetchWithRetry(`${BASE}/v3/servers/${serverId}/events`, {
    headers: { Authorization: apiKey, IncludeSignUps: "true" },
  });
  if (!res.ok) throw new Error(`Raid-Helper responded ${res.status}`);
  const parsed = eventsResponseSchema.parse(await res.json());
  return parsed.postedEvents ?? [];
}

export async function syncRaidHelper(): Promise<SyncResult> {
  if (env.isDemoMode) {
    return {
      integration: "raid_helper",
      ok: true,
      skipped: true,
      message: "demo mode — fixtures in use",
      itemsUpserted: 0,
    };
  }
  if (!env.raidHelper.apiKey || !env.raidHelper.serverId) {
    return {
      integration: "raid_helper",
      ok: true,
      skipped: true,
      message: "not configured (RAID_HELPER_API_KEY / RAID_HELPER_SERVER_ID)",
      itemsUpserted: 0,
    };
  }

  const db = await getDb();
  const events = await fetchServerEvents();
  const roster = await db.select().from(tables.characters);
  const characterIdByName = new Map(roster.map((c) => [c.name.toLowerCase(), c.id]));
  let upserted = 0;

  for (const raw of events) {
    const normalized = normalizeEvent(raw);
    const existing = await db
      .select()
      .from(tables.raidEvents)
      .where(eq(tables.raidEvents.raidHelperId, normalized.raidHelperId))
      .limit(1);

    let eventId: number;
    const eventValues = {
      title: normalized.title,
      description: normalized.description,
      startTime: normalized.startTime,
      endTime: normalized.endTime,
      closed: normalized.closed,
      syncedAt: new Date(),
    };
    if (existing[0]) {
      eventId = existing[0].id;
      await db.update(tables.raidEvents).set(eventValues).where(eq(tables.raidEvents.id, eventId));
    } else {
      const inserted = await db
        .insert(tables.raidEvents)
        .values({ raidHelperId: normalized.raidHelperId, ...eventValues })
        .returning();
      eventId = inserted[0].id;
    }

    // Replace signups wholesale — Raid-Helper is the source of truth.
    await db.delete(tables.raidSignups).where(eq(tables.raidSignups.raidEventId, eventId));
    for (const signup of normalized.signups) {
      const characterId = characterIdByName.get(signup.name.toLowerCase()) ?? null;
      const character = characterId ? roster.find((c) => c.id === characterId) : null;
      await db.insert(tables.raidSignups).values({
        raidEventId: eventId,
        raidHelperSignupId: signup.raidHelperSignupId,
        characterId,
        name: signup.name,
        className: signup.className ?? character?.className ?? null,
        specName: signup.specName ?? character?.specName ?? null,
        role: character?.role ?? null,
        status: signup.status,
        signedUpAt: signup.signedUpAt,
      });
    }
    upserted++;
  }

  return {
    integration: "raid_helper",
    ok: true,
    message: `synced ${upserted} events`,
    itemsUpserted: upserted,
  };
}
