import { sql } from "drizzle-orm";

import { guildConfig } from "@/config/guild";
import type { Db } from "./index";
import * as t from "./schema";

/**
 * Demo fixtures. Dates are computed relative to "now" so the demo always
 * looks alive (upcoming raid, recent kills, fresh sync timestamps).
 * Only ever runs in demo mode — production uses real synced data.
 */

const REALM = guildConfig.realm;
const TIER = guildConfig.currentTier.name;

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3_600_000);
}
function daysAgo(d: number) {
  return hoursAgo(d * 24);
}
/** Next occurrence of a weekday (0=Sun..6=Sat) at HH:MM local time. */
function nextWeekday(weekday: number, hour: number, minute: number) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  while (d.getDay() !== weekday || d.getTime() <= Date.now()) {
    d.setDate(d.getDate() + 1);
    d.setHours(hour, minute, 0, 0);
  }
  return d;
}

type CharSeed = [
  name: string,
  className: string,
  specName: string,
  role: "TANK" | "HEALER" | "DPS",
  status: "RAIDER" | "TRIAL" | "MEMBER" | "ALT",
  rank: string,
  ilvl: number,
  mplus: number,
  attendance: number,
  perf: number,
];

const CHARACTERS: CharSeed[] = [
  ["Brickwall", "Warrior", "Protection", "TANK", "RAIDER", "Officer", 715, 2890, 98, 72],
  ["Thornhide", "Druid", "Guardian", "TANK", "RAIDER", "Raider", 713, 3010, 96, 68],
  ["Luminara", "Priest", "Holy", "HEALER", "RAIDER", "Officer", 711, 2540, 97, 81],
  ["Totemtide", "Shaman", "Restoration", "HEALER", "RAIDER", "Raider", 712, 2705, 92, 78],
  ["Verdance", "Druid", "Restoration", "HEALER", "RAIDER", "Raider", 710, 2611, 89, 74],
  ["Goldenlight", "Paladin", "Holy", "HEALER", "RAIDER", "Raider", 711, 2480, 94, 76],
  ["Mikkel", "Warlock", "Destruction", "DPS", "RAIDER", "Guild Master", 714, 3142, 94, 87],
  ["Frostmage", "Mage", "Frost", "DPS", "TRIAL", "Trial", 712, 3142, 100, 87],
  ["Shadowfen", "Priest", "Shadow", "DPS", "RAIDER", "Raider", 713, 2960, 95, 84],
  ["Grimquiver", "Hunter", "Marksmanship", "DPS", "RAIDER", "Raider", 714, 3055, 91, 82],
  ["Ashenvale", "Demon Hunter", "Havoc", "DPS", "RAIDER", "Raider", 712, 2988, 93, 79],
  ["Stormsunder", "Shaman", "Elemental", "DPS", "RAIDER", "Raider", 711, 2870, 88, 75],
  ["Bladewhisper", "Rogue", "Assassination", "DPS", "RAIDER", "Raider", 713, 2795, 90, 80],
  ["Runeblight", "Death Knight", "Unholy", "DPS", "RAIDER", "Raider", 712, 2740, 96, 77],
  ["Emberfall", "Mage", "Fire", "DPS", "RAIDER", "Raider", 711, 3221, 92, 85],
  ["Ironjaw", "Warrior", "Fury", "DPS", "RAIDER", "Raider", 710, 2650, 87, 71],
  ["Vexweaver", "Warlock", "Affliction", "DPS", "RAIDER", "Raider", 709, 2588, 85, 69],
  ["Skyreaver", "Evoker", "Devastation", "DPS", "RAIDER", "Raider", 712, 2901, 94, 83],
  ["Palecrest", "Paladin", "Retribution", "DPS", "TRIAL", "Trial", 708, 2712, 83, 66],
  ["Windstep", "Monk", "Windwalker", "DPS", "TRIAL", "Trial", 709, 2833, 100, 73],
  ["Mistveil", "Monk", "Mistweaver", "HEALER", "MEMBER", "Member", 705, 2210, 0, 0],
  ["Duskthorn", "Hunter", "Beast Mastery", "DPS", "MEMBER", "Member", 703, 2409, 0, 0],
  ["Cinderbolt", "Evoker", "Augmentation", "DPS", "ALT", "Alt", 701, 2105, 0, 0],
];

const BOSSES: Array<{
  slot: number;
  name: string;
  status: "KILLED" | "PROGRESS" | "LOCKED";
  bestPct?: number;
  pulls: number;
  killedDaysAgo?: number;
  lastStart?: number;
  lastEnd?: number;
}> = [
  { slot: 1, name: "Vault Sentinel", status: "KILLED", pulls: 7, killedDaysAgo: 54 },
  { slot: 2, name: "Korrash the Unbound", status: "KILLED", pulls: 14, killedDaysAgo: 49 },
  { slot: 3, name: "Twin Curators", status: "KILLED", pulls: 22, killedDaysAgo: 41 },
  { slot: 4, name: "Sha'veth, Herald of Dusk", status: "KILLED", pulls: 31, killedDaysAgo: 30 },
  { slot: 5, name: "The Umbral Conclave", status: "KILLED", pulls: 45, killedDaysAgo: 16 },
  { slot: 6, name: "Nerezza, Void Weaver", status: "KILLED", pulls: 38, killedDaysAgo: 0.1 },
  {
    slot: 7,
    name: "The Void Emperor",
    status: "PROGRESS",
    bestPct: 11.7,
    pulls: 83,
    lastStart: 38,
    lastEnd: 11.7,
  },
  { slot: 8, name: "Aeternum, the Last Light", status: "LOCKED", pulls: 0 },
];

export async function seedDemoData(db: Db) {
  const existing = await db.select({ n: sql<number>`count(*)` }).from(t.characters);
  if (Number(existing[0]?.n ?? 0) > 0) return; // idempotent

  // ————— Users (matching the demo login accounts) —————
  const [adminUser, officerUser, memberUser] = await db
    .insert(t.users)
    .values([
      {
        discordId: "demo-admin",
        discordUsername: "mikkel",
        displayName: "Mikkel",
        role: "ADMIN",
        lastLoginAt: hoursAgo(2),
      },
      {
        discordId: "demo-officer",
        discordUsername: "luminara",
        displayName: "Luna",
        role: "OFFICER",
        lastLoginAt: hoursAgo(5),
      },
      {
        discordId: "demo-member",
        discordUsername: "frostmage",
        displayName: "Frost",
        role: "RAIDER",
        lastLoginAt: hoursAgo(1),
      },
    ])
    .returning();

  // ————— Roster —————
  const charRows = await db
    .insert(t.characters)
    .values(
      CHARACTERS.map(([name, className, specName, role, status, rank, ilvl, mplus, att, perf]) => ({
        name,
        realmSlug: REALM.slug,
        realmName: REALM.name,
        region: guildConfig.region,
        className,
        specName,
        role,
        rosterStatus: status,
        guildRank: rank,
        itemLevel: ilvl,
        mythicPlusScore: mplus,
        attendancePct: att || null,
        avgPerformance: perf || null,
        raidProgressSummary: "6/8 H",
        userId:
          name === "Mikkel" ? adminUser.id : name === "Frostmage" ? memberUser.id : name === "Luminara" ? officerUser.id : null,
        syncedAt: hoursAgo(1),
      })),
    )
    .returning();
  const charByName = new Map(charRows.map((c) => [c.name, c]));

  // ————— Progression —————
  await db.insert(t.bossProgress).values(
    BOSSES.map((b) => ({
      tierName: TIER,
      bossSlot: b.slot,
      bossName: b.name,
      difficulty: "Heroic",
      status: b.status,
      bestPct: b.bestPct ?? (b.status === "KILLED" ? 0 : null),
      pulls: b.pulls,
      killedAt: b.killedDaysAgo !== undefined ? daysAgo(b.killedDaysAgo) : null,
      lastRaidStartPct: b.lastStart ?? null,
      lastRaidEndPct: b.lastEnd ?? null,
      syncedAt: hoursAgo(0.2),
    })),
  );

  // ————— Raid events: next Wednesday + next Sunday, plus history —————
  const nextWed = nextWeekday(3, 19, 30);
  const nextSun = nextWeekday(0, 19, 30);
  const upcoming = [nextWed, nextSun].sort((a, b) => a.getTime() - b.getTime());

  const [nextRaid, secondRaid] = await db
    .insert(t.raidEvents)
    .values(
      upcoming.map((start, i) => ({
        raidHelperId: `demo-upcoming-${i}`,
        title: `${TIER} — Heroic`,
        difficulty: "Heroic",
        startTime: start,
        endTime: new Date(start.getTime() + 3 * 3_600_000),
        targetBoss: "The Void Emperor",
        closed: false,
        syncedAt: hoursAgo(0.05),
      })),
    )
    .returning();

  const pastRaids = await db
    .insert(t.raidEvents)
    .values(
      [3, 7, 10, 14, 17, 21].map((d, i) => ({
        raidHelperId: `demo-past-${i}`,
        title: `${TIER} — Heroic`,
        difficulty: "Heroic",
        startTime: (() => {
          const s = daysAgo(d);
          s.setHours(19, 30, 0, 0);
          return s;
        })(),
        endTime: (() => {
          const s = daysAgo(d);
          s.setHours(22, 30, 0, 0);
          return s;
        })(),
        targetBoss: i < 2 ? "The Void Emperor" : "Nerezza, Void Weaver",
        closed: true,
        syncedAt: hoursAgo(0.05),
      })),
    )
    .returning();

  // ————— Signups for the next raid: 19/20 confirmed, 1 missing ranged —————
  const raiders = charRows.filter((c) => c.rosterStatus === "RAIDER" || c.rosterStatus === "TRIAL");
  const absentee = charByName.get("Vexweaver");
  const noResponse = charByName.get("Emberfall");
  const signupRows = raiders.map((c) => ({
    raidEventId: nextRaid.id,
    characterId: c.id,
    name: c.name,
    className: c.className,
    specName: c.specName,
    role: c.role,
    status:
      c.id === absentee?.id
        ? ("ABSENT" as const)
        : c.id === noResponse?.id
          ? ("NO_RESPONSE" as const)
          : ("CONFIRMED" as const),
    signedUpAt: hoursAgo(20),
  }));
  await db.insert(t.raidSignups).values(signupRows);
  // Second upcoming raid: partial signups so the page shows variety.
  await db.insert(t.raidSignups).values(
    raiders.slice(0, 14).map((c) => ({
      raidEventId: secondRaid.id,
      characterId: c.id,
      name: c.name,
      className: c.className,
      specName: c.specName,
      role: c.role,
      status: "CONFIRMED" as const,
      signedUpAt: hoursAgo(6),
    })),
  );
  // Past raids: everyone confirmed except occasional absences (drives attendance).
  for (const [i, raid] of pastRaids.entries()) {
    await db.insert(t.raidSignups).values(
      raiders.map((c, j) => ({
        raidEventId: raid.id,
        characterId: c.id,
        name: c.name,
        className: c.className,
        specName: c.specName,
        role: c.role,
        status: (j + i) % 9 === 8 ? ("ABSENT" as const) : ("CONFIRMED" as const),
        signedUpAt: new Date(raid.startTime.getTime() - 48 * 3_600_000),
      })),
    );
  }

  // ————— Warcraft Logs reports —————
  const reports = await db
    .insert(t.raidReports)
    .values(
      [2, 5, 9, 12].map((d, i) => ({
        wclCode: `demoReport${i + 1}`,
        title: `${TIER} — Heroic (${i < 2 ? "Void Emperor" : "Farm + Nerezza"})`,
        startTime: daysAgo(d),
        endTime: new Date(daysAgo(d).getTime() + 3 * 3_600_000),
        url: `https://www.warcraftlogs.com/reports/demoReport${i + 1}`,
        syncedAt: hoursAgo(0.2),
      })),
    )
    .returning();

  // ————— Character performance (latest report percentiles) —————
  await db.insert(t.characterPerformance).values(
    raiders
      .filter((c) => c.avgPerformance)
      .map((c) => ({
        characterId: c.id,
        reportId: reports[0].id,
        bossName: "The Void Emperor",
        metric: c.role === "HEALER" ? "hps" : "dps",
        percentile: c.avgPerformance,
        recordedAt: daysAgo(2),
      })),
  );

  // ————— Mythic+ runs —————
  const dungeons = [
    "Ara-Kara, City of Echoes",
    "The Dawnbreaker",
    "Halls of Atonement",
    "Operation: Floodgate",
    "Priory of the Sacred Flame",
    "Eco-Dome Al'dani",
  ];
  const mplusChars = ["Mikkel", "Frostmage", "Emberfall", "Grimquiver", "Skyreaver", "Thornhide"];
  await db.insert(t.mythicPlusRuns).values(
    mplusChars.flatMap((name, ci) => {
      const c = charByName.get(name)!;
      return [0, 1, 2].map((i) => ({
        characterId: c.id,
        dungeon: dungeons[(ci + i * 2) % dungeons.length],
        level: 15 + ((ci + i) % 4),
        timed: (ci + i) % 4 !== 3,
        score: 165 + i * 3,
        completedAt: daysAgo(1 + i * 2 + ci * 0.2),
        raiderIoRunId: `demo-run-${ci}-${i}`,
      }));
    }),
  );

  // ————— Recruitment —————
  await db.insert(t.recruitmentNeeds).values([
    { className: "Mage", specName: null, role: "DPS", priority: "HIGH", note: "Alle specs, plads i raidet med det samme" },
    { className: "Shaman", specName: "Restoration", role: "HEALER", priority: "HIGH", note: "Fast plads til den rigtige" },
    { className: "Rogue", specName: null, role: "DPS", priority: "MEDIUM", note: null },
    { className: "Warlock", specName: null, role: "DPS", priority: "MEDIUM", note: null },
    { className: "Warrior", specName: "Protection", role: "TANK", priority: "CLOSED", note: "Vi har tankene" },
  ]);

  const apps = await db
    .insert(t.applications)
    .values([
      {
        discordName: "arcblast",
        characterName: "Arcblast",
        realm: REALM.name,
        className: "Mage",
        specName: "Arcane",
        altSpecs: "Fire",
        role: "DPS",
        warcraftLogsUrl: "https://www.warcraftlogs.com/character/eu/tarren-mill/arcblast",
        raiderIoUrl: "https://raider.io/characters/eu/tarren-mill/Arcblast",
        previousGuild: "Cutting Edge or Bust",
        raidExperience: "Har spillet siden Legion. 7/8 sidste tier.",
        availability: "Onsdag og søndag. Kan tage en ekstra aften i ny og næ.",
        expectations: "Et stabilt hold og ingen drama.",
        whyPapi: "I lægger bosser uden at raide fire aftener om ugen. Det er lige mig.",
        status: "NEW",
        createdAt: hoursAgo(9),
        updatedAt: hoursAgo(9),
      },
      {
        discordName: "healbot_irl",
        characterName: "Springtide",
        realm: "Kazzak",
        className: "Shaman",
        specName: "Restoration",
        altSpecs: "Elemental",
        role: "HEALER",
        warcraftLogsUrl: "https://www.warcraftlogs.com/character/eu/kazzak/springtide",
        raiderIoUrl: "https://raider.io/characters/eu/kazzak/Springtide",
        previousGuild: "Midnight Society",
        raidExperience: "6/8 i denne tier. Min gamle guild gik i opløsning.",
        availability: "Begge raid-aftener, altid.",
        expectations: "En guild der ikke falder fra hinanden i uge otte.",
        whyPapi: "I spiller i samme tempo som mig, og holdet ser stabilt ud.",
        status: "NEW",
        createdAt: hoursAgo(26),
        updatedAt: hoursAgo(26),
      },
      {
        discordName: "stabbyjoe",
        characterName: "Quietknife",
        realm: REALM.name,
        className: "Rogue",
        specName: "Assassination",
        altSpecs: "Subtlety",
        role: "DPS",
        raiderIoUrl: "https://raider.io/characters/eu/tarren-mill/Quietknife",
        previousGuild: "Parse Purple",
        raidExperience: "5/8, og pæne logs på dem vi har lagt.",
        availability: "Onsdag altid, søndag som regel.",
        expectations: "At folk skiftes til at sidde over.",
        whyPapi: "Jeg kender et par stykker i guilden, og de siger kun godt.",
        status: "REVIEW",
        reviewerId: officerUser.id,
        createdAt: daysAgo(3),
        updatedAt: daysAgo(1),
      },
      {
        discordName: "wickfang",
        characterName: "Wickfang",
        realm: "Draenor",
        className: "Demon Hunter",
        specName: "Havoc",
        altSpecs: null,
        role: "DPS",
        warcraftLogsUrl: "https://www.warcraftlogs.com/character/eu/draenor/wickfang",
        previousGuild: "Volatile",
        raidExperience: "Clearede for to tiers siden, holdt pause, er tilbage nu.",
        availability: "Begge aftener.",
        expectations: "At der bliver spillet ordentligt, men også grinet.",
        whyPapi: "Jeres opslag lød ikke som en skabelon. Det er sjældent.",
        status: "INTERVIEW",
        reviewerId: officerUser.id,
        createdAt: daysAgo(6),
        updatedAt: daysAgo(2),
      },
    ])
    .returning();

  await db.insert(t.applicationNotes).values([
    {
      applicationId: apps[2].id,
      authorId: officerUser.id,
      authorName: "Luna",
      body: "Logs ser fine ud på farm, tyndere på progressen. Værd at tage en snak.",
      createdAt: daysAgo(1),
    },
    {
      applicationId: apps[3].id,
      authorId: officerUser.id,
      authorName: "Luna",
      body: "Snak aftalt til torsdag 20:00. Officeren fra hans gamle guild siger god for ham.",
      createdAt: daysAgo(2),
    },
  ]);

  // ————— Trials —————
  await db.insert(t.trials).values([
    {
      characterId: charByName.get("Frostmage")!.id,
      characterName: "Frostmage",
      startDate: daysAgo(18),
      expectedEndDate: new Date(Date.now() + 10 * 86_400_000),
      raidsAttended: 6,
      attendancePct: 100,
      performanceNote: "Bliver bedre for hver uge. Ligger allerede over gennemsnittet.",
      status: "ACTIVE",
    },
    {
      characterId: charByName.get("Palecrest")!.id,
      characterName: "Palecrest",
      startDate: daysAgo(25),
      expectedEndDate: new Date(Date.now() + 3 * 86_400_000),
      raidsAttended: 7,
      attendancePct: 83,
      performanceNote: "Fin nok. Skal vurderes inden reset.",
      status: "ACTIVE",
    },
    {
      characterId: charByName.get("Windstep")!.id,
      characterName: "Windstep",
      startDate: daysAgo(10),
      expectedEndDate: new Date(Date.now() + 18 * 86_400_000),
      raidsAttended: 3,
      attendancePct: 100,
      performanceNote: "Tidligt endnu, men spiller rent.",
      status: "ACTIVE",
    },
  ]);

  // ————— Activity feed —————
  await db.insert(t.activityEvents).values([
    {
      kind: "boss_kill",
      title: "PAPI lagde Nerezza, Void Weaver",
      detail: "Boss nummer 6 nede efter 38 forsøg.",
      source: "warcraft_logs",
      occurredAt: hoursAgo(2),
    },
    {
      kind: "roster",
      title: "Frostmage er kommet med på holdet",
      detail: "På prøve — Frost Mage",
      source: "papi",
      occurredAt: hoursAgo(5),
    },
    {
      kind: "mythic_plus",
      title: "PAPI klarede en +17 i tide",
      detail: "Emberfall, Mikkel og Skyreaver — Ara-Kara +17.",
      source: "raider_io",
      occurredAt: daysAgo(1),
    },
    {
      kind: "progress",
      title: "Nyt bedste forsøg på The Void Emperor: 11,7 %",
      detail: "Fra 38 % til 11,7 % på én aften. 83 forsøg i alt.",
      source: "warcraft_logs",
      occurredAt: daysAgo(2),
    },
    {
      kind: "report",
      title: "Ny raid-rapport lagt op",
      detail: "Eternal Citadel — to timer på Void Emperor.",
      source: "warcraft_logs",
      occurredAt: daysAgo(2.1),
    },
    {
      kind: "recruitment",
      title: "Ny ansøgning: Arcane Mage",
      detail: "Arcblast — har 7/8 med.",
      source: "papi",
      occurredAt: hoursAgo(9),
    },
  ]);

  // ————— Integration health —————
  await db.insert(t.integrationConnections).values(
    (
      [
        ["discord", 3],
        ["raid_helper", 3],
        ["raider_io", 8],
        ["warcraft_logs", 12],
        ["battle_net", 15],
      ] as const
    ).map(([name, mins]) => ({
      name,
      state: "CONNECTED" as const,
      lastSyncAt: new Date(Date.now() - mins * 60_000),
      lastSuccessAt: new Date(Date.now() - mins * 60_000),
      detail: { mode: "demo" },
    })),
  );

  await db.insert(t.syncRuns).values(
    ["raid_helper", "raider_io", "warcraft_logs"].map((integration, i) => ({
      integration,
      startedAt: new Date(Date.now() - (i + 1) * 4 * 60_000),
      finishedAt: new Date(Date.now() - (i + 1) * 4 * 60_000 + 8_000),
      ok: true,
      message: "demo fixtures",
      itemsUpserted: 20 + i * 5,
    })),
  );
}
