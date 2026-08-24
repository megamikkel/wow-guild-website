import { eq } from "drizzle-orm";
import { z } from "zod";

import { guildConfig } from "@/config/guild";
import { getDb, tables } from "@/lib/db";
import { env } from "@/lib/env";
import { fetchWithRetry, type SyncResult } from "../types";

/**
 * Battle.net adapter — guild roster is the source of truth for who is in
 * the guild. OAuth2 client credentials against oauth.battle.net; Game Data
 * host {region}.api.blizzard.com; guild endpoints use the profile-{region}
 * namespace. Free: 36,000 req/h — one roster call per sync barely registers.
 */

const TOKEN_URL = "https://oauth.battle.net/token";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const { clientId, clientSecret } = env.blizzard;
  if (!clientId || !clientSecret) throw new Error("Battle.net not configured");
  const res = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Battle.net token endpoint responded ${res.status}`);
  const data = z
    .object({ access_token: z.string(), expires_in: z.number() })
    .parse(await res.json());
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

const rosterSchema = z.object({
  members: z.array(
    z.object({
      character: z.object({
        id: z.number(),
        name: z.string(),
        realm: z.object({ slug: z.string() }),
        playable_class: z.object({ id: z.number() }),
        level: z.number().nullish(),
      }),
      rank: z.number(),
    }),
  ),
});

/** Blizzard playable_class ids → class names. Static since Dragonflight. */
export const CLASS_BY_ID: Record<number, string> = {
  1: "Warrior",
  2: "Paladin",
  3: "Hunter",
  4: "Rogue",
  5: "Priest",
  6: "Death Knight",
  7: "Shaman",
  8: "Mage",
  9: "Warlock",
  10: "Monk",
  11: "Druid",
  12: "Demon Hunter",
  13: "Evoker",
};

export async function fetchGuildRoster() {
  const token = await getAccessToken();
  const { region, realm, name } = guildConfig;
  const nameSlug = name.toLowerCase().replaceAll(" ", "-");
  const url = `https://${region}.api.blizzard.com/data/wow/guild/${realm.slug}/${nameSlug}/roster?namespace=profile-${region}&locale=${guildConfig.locale}`;
  const res = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Battle.net roster endpoint responded ${res.status}`);
  return rosterSchema.parse(await res.json());
}

export async function syncBlizzardRoster(): Promise<SyncResult> {
  if (env.isDemoMode) {
    return {
      integration: "battle_net",
      ok: true,
      skipped: true,
      message: "demo mode — fixtures in use",
      itemsUpserted: 0,
    };
  }
  if (!env.blizzard.clientId || !env.blizzard.clientSecret) {
    return {
      integration: "battle_net",
      ok: true,
      skipped: true,
      message: "not configured (BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET)",
      itemsUpserted: 0,
    };
  }

  const roster = await fetchGuildRoster();
  const db = await getDb();
  let upserted = 0;

  // Only track max-level characters; the rest is alt noise.
  const members = roster.members.filter((m) => (m.character.level ?? 0) >= 80);
  for (const member of members) {
    const c = member.character;
    const className = CLASS_BY_ID[c.playable_class.id] ?? "Warrior";
    const existing = await db
      .select()
      .from(tables.characters)
      .where(eq(tables.characters.blizzardId, String(c.id)))
      .limit(1);
    if (existing[0]) {
      await db
        .update(tables.characters)
        .set({ guildRank: `Rank ${member.rank}`, syncedAt: new Date() })
        .where(eq(tables.characters.id, existing[0].id));
    } else {
      await db.insert(tables.characters).values({
        name: c.name,
        realmSlug: c.realm.slug,
        realmName: c.realm.slug,
        region: guildConfig.region,
        className,
        specName: "Unknown",
        role: "DPS", // corrected by the Raider.IO sync (active spec)
        rosterStatus: member.rank <= 1 ? "RAIDER" : "MEMBER",
        guildRank: `Rank ${member.rank}`,
        blizzardId: String(c.id),
        syncedAt: new Date(),
      });
    }
    upserted++;
  }

  return {
    integration: "battle_net",
    ok: true,
    message: `synced ${upserted} guild members`,
    itemsUpserted: upserted,
  };
}
