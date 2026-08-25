/**
 * Central guild configuration.
 *
 * Everything that identifies the guild lives here so it can be changed in one
 * place (realm, schedule, Discord role mapping, external service ids).
 * Values marked PLACEHOLDER should be replaced once the real guild details
 * are known — the rest of the codebase only reads from this file.
 */

export const guildConfig = {
  name: "PAPI",
  /**
   * Frank Hvams mest kendte replik fra Klovn. Sætter tonen: vi er casuals,
   * vi spiller for hyggens skyld, og vi tager os ikke selv højtideligt.
   */
  tagline: "Skal vi ikke hygge-hygge lidt?",
  taglineLong: "To aftener om ugen. Så er der også tid til resten.",
  region: "eu" as const,
  /** PLACEHOLDER — set the real realm slug + display name. */
  realm: { slug: "tarren-mill", name: "Tarren Mill" },
  faction: "Horde" as const,
  factionDa: "Horde" as const,
  locale: "en_GB",
  timezone: "Europe/Copenhagen",

  raidSchedule: [
    { day: "Onsdag", short: "ONS", start: "19:30", end: "22:30" },
    { day: "Søndag", short: "SØN", start: "19:30", end: "22:30" },
  ],

  focus: "Casual raiding",
  focusLong: "Afslappet raiding et par aftener om ugen",

  /** Target raid composition, used for signup breakdowns and roster health. */
  rosterTargets: { TANK: 2, HEALER: 4, DPS: 14 } as Record<"TANK" | "HEALER" | "DPS", number>,

  /** Current raid tier shown across the site. Seed data matches this. */
  currentTier: {
    name: "Eternal Citadel",
    shortName: "EC",
    bossCount: 8,
    /** Sværhedsgrad som WoW selv navngiver den. */
    difficulty: "Heroic" as const,
  },

  socials: {
    /** PLACEHOLDER — public Discord invite for recruitment. */
    discordInvite: "https://discord.gg/papi",
  },

  external: {
    raiderIoGuildUrl: () =>
      `https://raider.io/guilds/${guildConfig.region}/${guildConfig.realm.slug}/${guildConfig.name}`,
    warcraftLogsGuildUrl: () =>
      `https://www.warcraftlogs.com/guild/${guildConfig.region}/${guildConfig.realm.slug}/${guildConfig.name.toLowerCase()}`,
    armoryCharacterUrl: (realmSlug: string, name: string) =>
      `https://worldofwarcraft.blizzard.com/en-gb/character/${guildConfig.region}/${realmSlug}/${name.toLowerCase()}`,
    raiderIoCharacterUrl: (realmSlug: string, name: string) =>
      `https://raider.io/characters/${guildConfig.region}/${realmSlug}/${name}`,
    warcraftLogsCharacterUrl: (realmSlug: string, name: string) =>
      `https://www.warcraftlogs.com/character/${guildConfig.region}/${realmSlug}/${name}`,
  },
} as const;

export type GuildConfig = typeof guildConfig;
