CREATE TYPE "public"."application_status" AS ENUM('NEW', 'REVIEW', 'INTERVIEW', 'TRIAL', 'ACCEPTED', 'DECLINED');--> statement-breakpoint
CREATE TYPE "public"."boss_status" AS ENUM('KILLED', 'PROGRESS', 'LOCKED');--> statement-breakpoint
CREATE TYPE "public"."character_role" AS ENUM('TANK', 'HEALER', 'DPS');--> statement-breakpoint
CREATE TYPE "public"."integration_state" AS ENUM('CONNECTED', 'DEGRADED', 'ERROR', 'NOT_CONFIGURED');--> statement-breakpoint
CREATE TYPE "public"."recruitment_priority" AS ENUM('HIGH', 'MEDIUM', 'LOW', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."papi_role" AS ENUM('PUBLIC', 'MEMBER', 'TRIAL', 'RAIDER', 'OFFICER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."roster_status" AS ENUM('RAIDER', 'TRIAL', 'MEMBER', 'ALT', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."signup_status" AS ENUM('CONFIRMED', 'TENTATIVE', 'ABSENT', 'NO_RESPONSE', 'BENCH');--> statement-breakpoint
CREATE TYPE "public"."trial_status" AS ENUM('ACTIVE', 'PASSED', 'FAILED', 'EXTENDED');--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"source" text DEFAULT 'papi' NOT NULL,
	"external_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"author_id" integer,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_name" text NOT NULL,
	"discord_user_id" text,
	"character_name" text NOT NULL,
	"realm" text NOT NULL,
	"class_name" text NOT NULL,
	"spec_name" text NOT NULL,
	"alt_specs" text,
	"role" character_role NOT NULL,
	"warcraft_logs_url" text,
	"raider_io_url" text,
	"previous_guild" text,
	"raid_experience" text NOT NULL,
	"availability" text NOT NULL,
	"expectations" text,
	"why_papi" text NOT NULL,
	"comment" text,
	"status" "application_status" DEFAULT 'NEW' NOT NULL,
	"reviewer_id" integer,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boss_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"tier_name" text NOT NULL,
	"boss_slot" integer NOT NULL,
	"boss_name" text NOT NULL,
	"difficulty" text DEFAULT 'Mythic' NOT NULL,
	"status" "boss_status" DEFAULT 'LOCKED' NOT NULL,
	"best_pct" real,
	"pulls" integer DEFAULT 0 NOT NULL,
	"killed_at" timestamp with time zone,
	"last_raid_start_pct" real,
	"last_raid_end_pct" real,
	"wcl_encounter_id" integer,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "character_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"report_id" integer,
	"boss_name" text,
	"metric" text DEFAULT 'dps' NOT NULL,
	"percentile" real,
	"recorded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"realm_slug" text NOT NULL,
	"realm_name" text NOT NULL,
	"region" text DEFAULT 'eu' NOT NULL,
	"class_name" text NOT NULL,
	"spec_name" text NOT NULL,
	"role" character_role NOT NULL,
	"roster_status" "roster_status" DEFAULT 'MEMBER' NOT NULL,
	"guild_rank" text,
	"item_level" real,
	"mythic_plus_score" real,
	"raid_progress_summary" text,
	"attendance_pct" real,
	"avg_performance" real,
	"user_id" integer,
	"blizzard_id" text,
	"raider_io_last_crawled_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"state" "integration_state" DEFAULT 'NOT_CONFIGURED' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "mythic_plus_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"dungeon" text NOT NULL,
	"level" integer NOT NULL,
	"timed" boolean NOT NULL,
	"score" real,
	"completed_at" timestamp with time zone NOT NULL,
	"raider_io_run_id" text
);
--> statement-breakpoint
CREATE TABLE "raid_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"raid_helper_id" text,
	"title" text NOT NULL,
	"description" text,
	"difficulty" text DEFAULT 'Mythic' NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"target_boss" text,
	"closed" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raid_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"wcl_code" text NOT NULL,
	"title" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"url" text NOT NULL,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "raid_signups" (
	"id" serial PRIMARY KEY NOT NULL,
	"raid_event_id" integer NOT NULL,
	"raid_helper_signup_id" text,
	"character_id" integer,
	"name" text NOT NULL,
	"class_name" text,
	"spec_name" text,
	"role" character_role,
	"status" "signup_status" DEFAULT 'NO_RESPONSE' NOT NULL,
	"signed_up_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recruitment_needs" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_name" text NOT NULL,
	"spec_name" text,
	"role" character_role NOT NULL,
	"priority" "recruitment_priority" NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"message" text,
	"items_upserted" integer
);
--> statement-breakpoint
CREATE TABLE "trials" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer,
	"application_id" integer,
	"character_name" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"expected_end_date" timestamp with time zone NOT NULL,
	"raids_attended" integer DEFAULT 0 NOT NULL,
	"attendance_pct" real,
	"performance_note" text,
	"status" "trial_status" DEFAULT 'ACTIVE' NOT NULL,
	"decision_note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"discord_username" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"role" "papi_role" DEFAULT 'PUBLIC' NOT NULL,
	"battle_net_id" text,
	"battle_net_tag" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_notes" ADD CONSTRAINT "application_notes_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_notes" ADD CONSTRAINT "application_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_performance" ADD CONSTRAINT "character_performance_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_performance" ADD CONSTRAINT "character_performance_report_id_raid_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."raid_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mythic_plus_runs" ADD CONSTRAINT "mythic_plus_runs_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_signups" ADD CONSTRAINT "raid_signups_raid_event_id_raid_events_id_fk" FOREIGN KEY ("raid_event_id") REFERENCES "public"."raid_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_signups" ADD CONSTRAINT "raid_signups_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trials" ADD CONSTRAINT "trials_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trials" ADD CONSTRAINT "trials_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "boss_progress_idx" ON "boss_progress" USING btree ("tier_name","difficulty","boss_slot");--> statement-breakpoint
CREATE UNIQUE INDEX "characters_identity_idx" ON "characters" USING btree ("name","realm_slug","region");--> statement-breakpoint
CREATE UNIQUE INDEX "guild_settings_key_idx" ON "guild_settings" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_name_idx" ON "integration_connections" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "raid_events_rh_idx" ON "raid_events" USING btree ("raid_helper_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raid_reports_code_idx" ON "raid_reports" USING btree ("wcl_code");--> statement-breakpoint
CREATE UNIQUE INDEX "users_discord_id_idx" ON "users" USING btree ("discord_id");