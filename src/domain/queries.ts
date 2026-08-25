import { and, asc, desc, eq, gt, lte } from "drizzle-orm";

import { guildConfig } from "@/config/guild";
import { getDb, tables as t } from "@/lib/db";

/**
 * Typed domain reads. Pages talk to this module — never to external API
 * response shapes. Everything here reads the local database, which the sync
 * layer keeps fresh (or the demo seed fills in demo mode).
 */

export type RoleKey = "TANK" | "HEALER" | "DPS";

export interface SignupBreakdown {
  confirmed: number;
  tentative: number;
  absent: number;
  noResponse: number;
  byRole: Record<RoleKey, { confirmed: number; target: number }>;
  totalConfirmed: number;
  totalTarget: number;
}

export function summarizeSignups(
  signups: Array<{ role: RoleKey | null; status: string }>,
): SignupBreakdown {
  const targets = guildConfig.rosterTargets;
  const byRole = {
    TANK: { confirmed: 0, target: targets.TANK },
    HEALER: { confirmed: 0, target: targets.HEALER },
    DPS: { confirmed: 0, target: targets.DPS },
  };
  let confirmed = 0,
    tentative = 0,
    absent = 0,
    noResponse = 0;
  for (const s of signups) {
    if (s.status === "CONFIRMED") {
      confirmed++;
      if (s.role) byRole[s.role].confirmed++;
    } else if (s.status === "TENTATIVE") tentative++;
    else if (s.status === "ABSENT") absent++;
    else noResponse++;
  }
  return {
    confirmed,
    tentative,
    absent,
    noResponse,
    byRole,
    totalConfirmed: confirmed,
    totalTarget: targets.TANK + targets.HEALER + targets.DPS,
  };
}

export async function getNextRaid() {
  const db = await getDb();
  const [event] = await db
    .select()
    .from(t.raidEvents)
    .where(and(eq(t.raidEvents.closed, false), gt(t.raidEvents.startTime, new Date())))
    .orderBy(asc(t.raidEvents.startTime))
    .limit(1);
  if (!event) return null;
  const signups = await db
    .select()
    .from(t.raidSignups)
    .where(eq(t.raidSignups.raidEventId, event.id));
  return { event, signups, breakdown: summarizeSignups(signups) };
}

export async function getRaids() {
  const db = await getDb();
  const now = new Date();
  const upcoming = await db
    .select()
    .from(t.raidEvents)
    .where(gt(t.raidEvents.startTime, now))
    .orderBy(asc(t.raidEvents.startTime));
  const past = await db
    .select()
    .from(t.raidEvents)
    .where(lte(t.raidEvents.startTime, now))
    .orderBy(desc(t.raidEvents.startTime))
    .limit(12);
  const withBreakdown = async (events: typeof upcoming) =>
    Promise.all(
      events.map(async (event) => {
        const signups = await db
          .select()
          .from(t.raidSignups)
          .where(eq(t.raidSignups.raidEventId, event.id));
        return { event, breakdown: summarizeSignups(signups) };
      }),
    );
  return { upcoming: await withBreakdown(upcoming), past: await withBreakdown(past) };
}

export async function getRaidDetail(id: number) {
  const db = await getDb();
  const [event] = await db.select().from(t.raidEvents).where(eq(t.raidEvents.id, id)).limit(1);
  if (!event) return null;
  const signups = await db
    .select()
    .from(t.raidSignups)
    .where(eq(t.raidSignups.raidEventId, id))
    .orderBy(asc(t.raidSignups.name));
  return { event, signups, breakdown: summarizeSignups(signups) };
}

export async function getProgression() {
  const db = await getDb();
  const bosses = await db
    .select()
    .from(t.bossProgress)
    .where(eq(t.bossProgress.tierName, guildConfig.currentTier.name))
    .orderBy(asc(t.bossProgress.bossSlot));
  const killed = bosses.filter((b) => b.status === "KILLED").length;
  const progressBoss = bosses.find((b) => b.status === "PROGRESS") ?? null;
  const lastSyncedAt = bosses.reduce<Date | null>(
    (acc, b) => (b.syncedAt && (!acc || b.syncedAt > acc) ? b.syncedAt : acc),
    null,
  );
  return { bosses, killed, total: bosses.length, progressBoss, lastSyncedAt };
}

export async function getRoster() {
  const db = await getDb();
  return db
    .select()
    .from(t.characters)
    .orderBy(asc(t.characters.rosterStatus), desc(t.characters.itemLevel));
}

export async function getCharacter(realmSlug: string, name: string) {
  const db = await getDb();
  const [character] = await db
    .select()
    .from(t.characters)
    .where(and(eq(t.characters.realmSlug, realmSlug), eq(t.characters.name, name)))
    .limit(1);
  if (!character) return null;
  const runs = await db
    .select()
    .from(t.mythicPlusRuns)
    .where(eq(t.mythicPlusRuns.characterId, character.id))
    .orderBy(desc(t.mythicPlusRuns.completedAt))
    .limit(8);
  const performance = await db
    .select()
    .from(t.characterPerformance)
    .where(eq(t.characterPerformance.characterId, character.id))
    .orderBy(desc(t.characterPerformance.recordedAt))
    .limit(8);
  return { character, runs, performance };
}

export async function getRecruitmentNeeds() {
  const db = await getDb();
  return db.select().from(t.recruitmentNeeds).orderBy(asc(t.recruitmentNeeds.priority));
}

export async function getActivity(limit = 12) {
  const db = await getDb();
  return db
    .select()
    .from(t.activityEvents)
    .orderBy(desc(t.activityEvents.occurredAt))
    .limit(limit);
}

export async function getApplications() {
  const db = await getDb();
  return db.select().from(t.applications).orderBy(desc(t.applications.createdAt));
}

export async function getApplicationDetail(id: number) {
  const db = await getDb();
  const [application] = await db
    .select()
    .from(t.applications)
    .where(eq(t.applications.id, id))
    .limit(1);
  if (!application) return null;
  const notes = await db
    .select()
    .from(t.applicationNotes)
    .where(eq(t.applicationNotes.applicationId, id))
    .orderBy(desc(t.applicationNotes.createdAt));
  return { application, notes };
}

export async function getTrials() {
  const db = await getDb();
  return db.select().from(t.trials).orderBy(asc(t.trials.expectedEndDate));
}

export async function getIntegrations() {
  const db = await getDb();
  return db.select().from(t.integrationConnections).orderBy(asc(t.integrationConnections.name));
}

export async function getRecentReports(limit = 6) {
  const db = await getDb();
  return db.select().from(t.raidReports).orderBy(desc(t.raidReports.startTime)).limit(limit);
}

/** Roster health per role vs targets (counts active raiders + trials). */
export async function getRosterHealth() {
  const roster = await getRoster();
  const active = roster.filter(
    (c) => c.rosterStatus === "RAIDER" || c.rosterStatus === "TRIAL",
  );
  const targets = guildConfig.rosterTargets;
  const count = (role: RoleKey) => active.filter((c) => c.role === role).length;
  return (Object.keys(targets) as RoleKey[]).map((role) => ({
    role,
    have: count(role),
    target: targets[role],
    pct: Math.round((count(role) / targets[role]) * 100),
  }));
}

export async function getMemberDashboard(dbUserId: number | undefined) {
  const db = await getDb();
  const nextRaid = await getNextRaid();
  const activity = await getActivity(6);
  const progression = await getProgression();
  let character = null;
  let signupStatus: string | null = null;
  if (dbUserId) {
    const chars = await db
      .select()
      .from(t.characters)
      .where(eq(t.characters.userId, dbUserId))
      .limit(1);
    character = chars[0] ?? null;
    if (character && nextRaid) {
      const own = nextRaid.signups.find((s) => s.characterId === character!.id);
      signupStatus = own?.status ?? null;
    }
  }
  return { nextRaid, activity, progression, character, signupStatus };
}
