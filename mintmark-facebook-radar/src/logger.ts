import fs from "node:fs";
import path from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Nøgler der aldrig må ende i en logfil. Værdier under disse nøgler
 * erstattes med "[redacted]" før de skrives.
 */
const SENSITIVE_KEY = /(cookie|token|password|secret|session|authorization|api[-_]?key|c_user|xs|datr)/i;

let minLevel: LogLevel = "info";
let logDir: string | null = null;

export function configureLogger(options: { level?: LogLevel; dir?: string | null }): void {
  if (options.level) minLevel = options.level;
  if (options.dir !== undefined) logDir = options.dir;
  if (logDir) fs.mkdirSync(logDir, { recursive: true });
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[deep]";
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
  const ts = new Date().toISOString();
  const safeMeta = meta ? redact(meta) : undefined;
  const metaText = safeMeta && Object.keys(safeMeta as object).length > 0 ? " " + JSON.stringify(safeMeta) : "";
  const line = `${ts} [${level.toUpperCase().padEnd(5)}] ${message}${metaText}`;

  const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
  stream.write(line + "\n");

  if (logDir) {
    const file = path.join(logDir, `radar-${ts.slice(0, 10)}.log`);
    try {
      fs.appendFileSync(file, line + "\n");
    } catch {
      // Logfilen må aldrig vælte programmet.
    }
  }
}

export const log = {
  debug: (message: string, meta?: Record<string, unknown>) => write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};

export function errorMeta(err: unknown): Record<string, unknown> {
  if (err instanceof Error) return { error: err.message, errorName: err.name };
  return { error: String(err) };
}
