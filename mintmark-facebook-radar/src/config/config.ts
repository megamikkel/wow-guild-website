import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";
import type { LogLevel } from "../logger.js";

const here = path.dirname(fileURLToPath(import.meta.url));
/** Projektets rodmappe (den der indeholder package.json). */
export const PROJECT_ROOT = path.resolve(here, "..", "..");

dotenv.config({ path: path.join(PROJECT_ROOT, ".env"), quiet: true });

const GroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().min(1),
});
const GroupsSchema = z.array(GroupSchema);

export type GroupConfig = z.infer<typeof GroupSchema>;

export type ClassifierKind = "anthropic" | "rules";

/** Installerede browsere Playwright kan starte i stedet for sin egen Chromium. */
export const BROWSER_CHANNELS = ["chrome", "chrome-beta", "msedge", "msedge-beta"] as const;
export type BrowserChannel = (typeof BROWSER_CHANNELS)[number];

function parseBrowserChannel(value: string | undefined): BrowserChannel | undefined {
  const v = value?.trim().toLowerCase();
  if (!v) return undefined;
  return (BROWSER_CHANNELS as readonly string[]).includes(v) ? (v as BrowserChannel) : undefined;
}

export interface RadarConfig {
  projectRoot: string;
  dbPath: string;
  profileDir: string;
  groupsFile: string;
  logDir: string;
  diagnosticsDir: string;
  logLevel: LogLevel;
  maxPostsPerGroup: number;
  headless: boolean;
  /** Valgfri sti til en Chromium-binær (ellers Playwrights egen) */
  chromiumPath: string | undefined;
  /** Brug en installeret browser i stedet for Playwrights egen Chromium */
  browserChannel: BrowserChannel | undefined;
  dashboardPort: number;
  classifier: ClassifierKind;
  llmModel: string;
  anthropicApiKey: string | undefined;
}

function resolveFromRoot(p: string): string {
  return path.isAbsolute(p) ? p : path.join(PROJECT_ROOT, p);
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseLogLevel(value: string | undefined): LogLevel {
  const v = (value ?? "info").toLowerCase();
  return v === "debug" || v === "warn" || v === "error" ? v : "info";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RadarConfig {
  const anthropicApiKey = env.ANTHROPIC_API_KEY?.trim() || undefined;
  const requested = env.RADAR_CLASSIFIER?.trim().toLowerCase();
  let classifier: ClassifierKind;
  if (requested === "anthropic" || requested === "rules") {
    classifier = requested;
  } else {
    classifier = anthropicApiKey ? "anthropic" : "rules";
  }

  const dataDir = resolveFromRoot("data");
  return {
    projectRoot: PROJECT_ROOT,
    dbPath: resolveFromRoot(env.RADAR_DB_PATH || "data/radar.db"),
    profileDir: resolveFromRoot(env.RADAR_PROFILE_DIR || "playwright-profile"),
    groupsFile: resolveFromRoot(env.RADAR_GROUPS_FILE || "config/groups.json"),
    logDir: path.join(dataDir, "logs"),
    diagnosticsDir: path.join(dataDir, "diagnostics"),
    logLevel: parseLogLevel(env.RADAR_LOG_LEVEL),
    maxPostsPerGroup: parseInt(env.RADAR_MAX_POSTS_PER_GROUP, 50),
    headless: parseBool(env.RADAR_HEADLESS, false),
    chromiumPath: env.RADAR_CHROMIUM_PATH?.trim() || undefined,
    browserChannel: parseBrowserChannel(env.RADAR_BROWSER_CHANNEL),
    dashboardPort: parseInt(env.RADAR_PORT, 3742),
    classifier,
    llmModel: env.RADAR_LLM_MODEL?.trim() || "claude-opus-5",
    anthropicApiKey,
  };
}

export class ConfigError extends Error {}

/**
 * Læser config/groups.json. Grupper hvis url stadig er pladsholderen
 * "GROUP_URL" (eller tom) springes over med en advarsel, så man kan
 * konfigurere dem én ad gangen.
 */
export function loadGroups(groupsFile: string): { groups: GroupConfig[]; skipped: GroupConfig[] } {
  if (!fs.existsSync(groupsFile)) {
    throw new ConfigError(`Fandt ikke gruppe-konfiguration: ${groupsFile}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(groupsFile, "utf8"));
  } catch (err) {
    throw new ConfigError(`Kunne ikke læse ${groupsFile} som JSON: ${(err as Error).message}`);
  }
  const parsed = GroupsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ConfigError(`Ugyldigt format i ${groupsFile}: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
  }

  const ids = new Set<string>();
  for (const g of parsed.data) {
    if (ids.has(g.id)) throw new ConfigError(`Gruppe-id "${g.id}" forekommer mere end én gang i ${groupsFile}`);
    ids.add(g.id);
  }

  const groups: GroupConfig[] = [];
  const skipped: GroupConfig[] = [];
  for (const g of parsed.data) {
    if (isPlaceholderUrl(g.url)) skipped.push(g);
    else groups.push(g);
  }
  return { groups, skipped };
}

export function isPlaceholderUrl(url: string): boolean {
  const u = url.trim();
  return u === "" || u === "GROUP_URL" || !/^https?:\/\//i.test(u);
}
