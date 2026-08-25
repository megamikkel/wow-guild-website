import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Application roles, ordered by privilege. RBAC lives in src/lib/rbac.ts. */
export const roleEnum = pgEnum("papi_role", [
  "PUBLIC",
  "MEMBER",
  "TRIAL",
  "RAIDER",
  "OFFICER",
  "ADMIN",
]);

export const characterRoleEnum = pgEnum("character_role", ["TANK", "HEALER", "DPS"]);

export const rosterStatusEnum = pgEnum("roster_status", [
  "RAIDER",
  "TRIAL",
  "MEMBER",
  "ALT",
  "INACTIVE",
]);

export const bossStatusEnum = pgEnum("boss_status", ["KILLED", "PROGRESS", "LOCKED"]);

export const signupStatusEnum = pgEnum("signup_status", [
  "CONFIRMED",
  "TENTATIVE",
  "ABSENT",
  "NO_RESPONSE",
  "BENCH",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "NEW",
  "REVIEW",
  "INTERVIEW",
  "TRIAL",
  "ACCEPTED",
  "DECLINED",
]);

export const recruitmentPriorityEnum = pgEnum("recruitment_priority", [
  "HIGH",
  "MEDIUM",
  "LOW",
  "CLOSED",
]);

export const trialStatusEnum = pgEnum("trial_status", ["ACTIVE", "PASSED", "FAILED", "EXTENDED"]);

export const integrationStatusEnum = pgEnum("integration_state", [
  "CONNECTED",
  "DEGRADED",
  "ERROR",
  "NOT_CONFIGURED",
]);

/** People who have logged in via Discord (or demo login). */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    discordId: text("discord_id").notNull(),
    discordUsername: text("discord_username").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    role: roleEnum("role").notNull().default("PUBLIC"),
    battleNetId: text("battle_net_id"),
    battleNetTag: text("battle_net_tag"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_discord_id_idx").on(t.discordId)],
);

/** Guild roster characters. Source of truth: Blizzard + Raider.IO (synced). */
export const characters = pgTable(
  "characters",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    realmSlug: text("realm_slug").notNull(),
    realmName: text("realm_name").notNull(),
    region: text("region").notNull().default("eu"),
    className: text("class_name").notNull(),
    specName: text("spec_name").notNull(),
    /**
     * Spec icon on Blizzard's CDN, resolved through their media API by the
     * sync job. Their artwork is never stored here — only the URL they serve.
     */
    specIconUrl: text("spec_icon_url"),
    role: characterRoleEnum("role").notNull(),
    rosterStatus: rosterStatusEnum("roster_status").notNull().default("MEMBER"),
    guildRank: text("guild_rank"),
    itemLevel: real("item_level"),
    mythicPlusScore: real("mythic_plus_score"),
    raidProgressSummary: text("raid_progress_summary"),
    attendancePct: real("attendance_pct"),
    avgPerformance: real("avg_performance"),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    /** External ids for idempotent sync. */
    blizzardId: text("blizzard_id"),
    raiderIoLastCrawledAt: timestamp("raider_io_last_crawled_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("characters_identity_idx").on(t.name, t.realmSlug, t.region)],
);

/** Raid events. Source of truth: Raid-Helper (read-only sync). */
export const raidEvents = pgTable(
  "raid_events",
  {
    id: serial("id").primaryKey(),
    raidHelperId: text("raid_helper_id"),
    title: text("title").notNull(),
    description: text("description"),
    difficulty: text("difficulty").notNull().default("Mythic"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }),
    targetBoss: text("target_boss"),
    closed: boolean("closed").notNull().default(false),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("raid_events_rh_idx").on(t.raidHelperId)],
);

/** Signups per raid event. Source of truth: Raid-Helper. */
export const raidSignups = pgTable("raid_signups", {
  id: serial("id").primaryKey(),
  raidEventId: integer("raid_event_id")
    .notNull()
    .references(() => raidEvents.id, { onDelete: "cascade" }),
  raidHelperSignupId: text("raid_helper_signup_id"),
  characterId: integer("character_id").references(() => characters.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  className: text("class_name"),
  specName: text("spec_name"),
  role: characterRoleEnum("role"),
  status: signupStatusEnum("status").notNull().default("NO_RESPONSE"),
  signedUpAt: timestamp("signed_up_at", { withTimezone: true }),
});

/** Per-boss progression for the current tier. Source of truth: Warcraft Logs. */
export const bossProgress = pgTable(
  "boss_progress",
  {
    id: serial("id").primaryKey(),
    tierName: text("tier_name").notNull(),
    bossSlot: integer("boss_slot").notNull(),
    bossName: text("boss_name").notNull(),
    difficulty: text("difficulty").notNull().default("Mythic"),
    status: bossStatusEnum("status").notNull().default("LOCKED"),
    bestPct: real("best_pct"),
    pulls: integer("pulls").notNull().default(0),
    killedAt: timestamp("killed_at", { withTimezone: true }),
    lastRaidStartPct: real("last_raid_start_pct"),
    lastRaidEndPct: real("last_raid_end_pct"),
    wclEncounterId: integer("wcl_encounter_id"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("boss_progress_idx").on(t.tierName, t.difficulty, t.bossSlot)],
);

/** Uploaded raid reports. Source of truth: Warcraft Logs. */
export const raidReports = pgTable(
  "raid_reports",
  {
    id: serial("id").primaryKey(),
    wclCode: text("wcl_code").notNull(),
    title: text("title").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }),
    url: text("url").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("raid_reports_code_idx").on(t.wclCode)],
);

/** Per-character performance snapshots from WCL rankings. */
export const characterPerformance = pgTable("character_performance", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  reportId: integer("report_id").references(() => raidReports.id, { onDelete: "cascade" }),
  bossName: text("boss_name"),
  metric: text("metric").notNull().default("dps"),
  percentile: real("percentile"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
});

/** Recent M+ runs per character. Source of truth: Raider.IO. */
export const mythicPlusRuns = pgTable("mythic_plus_runs", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  dungeon: text("dungeon").notNull(),
  level: integer("level").notNull(),
  timed: boolean("timed").notNull(),
  score: real("score"),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
  raiderIoRunId: text("raider_io_run_id"),
});

/** What the guild is recruiting. Source of truth: PAPI. */
export const recruitmentNeeds = pgTable("recruitment_needs", {
  id: serial("id").primaryKey(),
  className: text("class_name").notNull(),
  specName: text("spec_name"),
  role: characterRoleEnum("role").notNull(),
  priority: recruitmentPriorityEnum("priority").notNull(),
  note: text("note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Recruitment applications. Source of truth: PAPI. */
export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  discordName: text("discord_name").notNull(),
  discordUserId: text("discord_user_id"),
  characterName: text("character_name").notNull(),
  realm: text("realm").notNull(),
  className: text("class_name").notNull(),
  specName: text("spec_name").notNull(),
  altSpecs: text("alt_specs"),
  role: characterRoleEnum("role").notNull(),
  warcraftLogsUrl: text("warcraft_logs_url"),
  raiderIoUrl: text("raider_io_url"),
  previousGuild: text("previous_guild"),
  raidExperience: text("raid_experience").notNull(),
  availability: text("availability").notNull(),
  expectations: text("expectations"),
  whyPapi: text("why_papi").notNull(),
  comment: text("comment"),
  status: applicationStatusEnum("status").notNull().default("NEW"),
  reviewerId: integer("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  decisionNote: text("decision_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Officer-only notes on applications. Never exposed publicly. */
export const applicationNotes = pgTable("application_notes", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Trial tracking. Source of truth: PAPI (data supports the decision). */
export const trials = pgTable("trials", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").references(() => characters.id, { onDelete: "set null" }),
  applicationId: integer("application_id").references(() => applications.id, {
    onDelete: "set null",
  }),
  characterName: text("character_name").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  expectedEndDate: timestamp("expected_end_date", { withTimezone: true }).notNull(),
  raidsAttended: integer("raids_attended").notNull().default(0),
  attendancePct: real("attendance_pct"),
  performanceNote: text("performance_note"),
  status: trialStatusEnum("status").notNull().default("ACTIVE"),
  decisionNote: text("decision_note"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Unified guild activity feed; sources append normalized events. */
export const activityEvents = pgTable("activity_events", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // boss_kill | progress | roster | mythic_plus | report | recruitment
  title: text("title").notNull(),
  detail: text("detail"),
  source: text("source").notNull().default("papi"),
  externalId: text("external_id"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Health of each external integration, shown on /admin/integrations. */
export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(), // discord | raid_helper | raider_io | warcraft_logs | battle_net
    state: integrationStatusEnum("state").notNull().default("NOT_CONFIGURED"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    /** Diagnostic message — must never contain secrets. */
    lastError: text("last_error"),
    detail: jsonb("detail"),
  },
  (t) => [uniqueIndex("integration_name_idx").on(t.name)],
);

/** History of sync executions. */
export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  integration: text("integration").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ok: boolean("ok"),
  message: text("message"),
  itemsUpserted: integer("items_upserted"),
});

/** Audit log for administrative actions. */
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  target: text("target"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Simple key/value guild settings. */
export const guildSettings = pgTable(
  "guild_settings",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    value: jsonb("value"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("guild_settings_key_idx").on(t.key)],
);
