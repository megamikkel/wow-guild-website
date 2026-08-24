/**
 * Environment handling with an explicit demo mode.
 *
 * Demo mode runs the whole platform on an embedded PGlite Postgres seeded
 * with realistic fixtures, and swaps external API adapters for fixture-backed
 * ones. It is ON when PAPI_DEMO_MODE=true, or automatically in development
 * when no DATABASE_URL is configured.
 *
 * Production can never silently fall back to demo data: in production with
 * demo mode off and no DATABASE_URL we fail fast at startup.
 */

function readDemoMode(): boolean {
  const explicit = process.env.PAPI_DEMO_MODE;
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  // Implicit demo only outside production.
  return process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL;
}

export const env = {
  get isDemoMode(): boolean {
    return readDemoMode();
  },
  get databaseUrl(): string | undefined {
    return process.env.DATABASE_URL;
  },
  get siteUrl(): string {
    return process.env.PAPI_SITE_URL ?? "http://localhost:3000";
  },
  /** Bearer secret protecting the /api/sync endpoint. */
  get syncSecret(): string | undefined {
    return process.env.PAPI_SYNC_SECRET;
  },
  discord: {
    get clientId() {
      return process.env.DISCORD_CLIENT_ID;
    },
    get clientSecret() {
      return process.env.DISCORD_CLIENT_SECRET;
    },
    get guildId() {
      return process.env.DISCORD_GUILD_ID;
    },
    get webhookUrl() {
      return process.env.DISCORD_WEBHOOK_URL;
    },
    /**
     * Discord role id → PAPI role, e.g.
     * DISCORD_ROLE_MAP="123:ADMIN,456:OFFICER,789:RAIDER,012:MEMBER,345:TRIAL"
     */
    get roleMap(): Record<string, string> {
      const raw = process.env.DISCORD_ROLE_MAP ?? "";
      const map: Record<string, string> = {};
      for (const pair of raw.split(",")) {
        const [id, role] = pair.split(":").map((s) => s.trim());
        if (id && role) map[id] = role.toUpperCase();
      }
      return map;
    },
  },
  raiderIo: {
    get apiKey() {
      return process.env.RAIDERIO_API_KEY;
    },
  },
  raidHelper: {
    get apiKey() {
      return process.env.RAID_HELPER_API_KEY;
    },
    get serverId() {
      return process.env.RAID_HELPER_SERVER_ID;
    },
  },
  warcraftLogs: {
    get clientId() {
      return process.env.WARCRAFTLOGS_CLIENT_ID;
    },
    get clientSecret() {
      return process.env.WARCRAFTLOGS_CLIENT_SECRET;
    },
  },
  blizzard: {
    get clientId() {
      return process.env.BLIZZARD_CLIENT_ID;
    },
    get clientSecret() {
      return process.env.BLIZZARD_CLIENT_SECRET;
    },
  },
};

/** Fail fast when production is misconfigured. Called from the db module. */
export function assertProductionConfig() {
  if (process.env.NODE_ENV === "production" && !env.isDemoMode && !env.databaseUrl) {
    throw new Error(
      "Production requires DATABASE_URL (or set PAPI_DEMO_MODE=true explicitly for a demo deployment).",
    );
  }
}
