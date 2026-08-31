import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { OptimizerError, type SimResultPoint } from "./types";

/**
 * SimulationCraft process boundary.
 *
 * There is deliberately no fallback here: when the engine is missing or
 * fails, the optimizer stops. No DPS number in this app is ever estimated.
 */

export interface SimcEngine {
  binary: string;
  version: string;
  wowVersion: string;
}

/**
 * Read at call time, not at import: the binary is often configured by an
 * environment variable that is set after this module loads.
 */
function candidateBinaries(): string[] {
  return [
    process.env.SIMC_PATH,
    "simc",
    "/usr/local/bin/simc",
    "/usr/bin/simc",
    "/opt/simc/simc",
  ].filter((v): v is string => Boolean(v));
}

const VERSION_LINE =
  /SimulationCraft\s+(\S+)\s+for\s+World\s+of\s+Warcraft\s+([^(]+?)\s*\(/i;

function runBinary(
  binary: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(binary, args, { cwd });
    } catch (err) {
      reject(err);
      return;
    }
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`SimulationCraft timed out after ${timeoutMs}ms`));
        return;
      }
      resolve({ code, stdout, stderr });
    });
  });
}

let cachedEngine: SimcEngine | null = null;

/**
 * Locate a working `simc` binary and read its version banner.
 * Throws ENGINE_NOT_FOUND when none of the candidates can run.
 */
export async function findEngine(force = false): Promise<SimcEngine> {
  if (cachedEngine && !force) return cachedEngine;

  const tried: string[] = [];
  for (const binary of candidateBinaries()) {
    if (binary.includes(path.sep)) {
      try {
        await access(binary, constants.X_OK);
      } catch {
        tried.push(`${binary} (not executable)`);
        continue;
      }
    }
    try {
      // simc with no profile prints its banner and exits 0.
      const { stdout } = await runBinary(binary, [], process.cwd(), 30_000);
      const match = stdout.match(VERSION_LINE);
      if (!match) {
        tried.push(`${binary} (unrecognized output)`);
        continue;
      }
      cachedEngine = {
        binary,
        version: match[1],
        wowVersion: match[2].trim(),
      };
      return cachedEngine;
    } catch {
      tried.push(`${binary} (not found)`);
    }
  }

  throw new OptimizerError(
    "ENGINE_NOT_FOUND",
    [
      "SimulationCraft engine not found.",
      "No gear recommendation can be calculated reliably.",
      "",
      `Tried: ${tried.join(", ")}`,
      "Install SimulationCraft and set SIMC_PATH to the simc binary.",
    ].join("\n"),
  );
}

/**
 * simc aborted the whole run. `rejected` names the profilesets it named in
 * its error output, which the caller can drop before retrying.
 */
export class SimcRunFailure extends Error {
  constructor(
    message: string,
    public readonly rejected: string[],
  ) {
    super(message);
    this.name = "SimcRunFailure";
  }
}

/** What SimulationCraft's own item database says about an equipped item. */
export interface ResolvedItem {
  name: string;
  ilvl: number | null;
}

export interface SimcRunOutput {
  /** The unmodified baseline profile's result. */
  baseline: SimResultPoint;
  /** Profileset name → result. */
  profilesets: Map<string, SimResultPoint>;
  /** Slot → item as resolved by simc for the baseline profile. */
  gear: Map<string, ResolvedItem>;
  engine: SimcEngine;
}

const PROFILESET_ERROR = /Error:\s*Profileset\s+'([^']+)'/g;

interface SimcJson {
  version?: string;
  sim?: {
    players?: {
      collected_data?: {
        dps?: { mean?: number; mean_std_dev?: number; count?: number };
      };
      gear?: Record<string, { name?: string; ilevel?: number }>;
    }[];
    profilesets?: {
      results?: {
        name?: string;
        mean?: number;
        mean_error?: number;
        iterations?: number;
      }[];
    };
    options?: { iterations?: number };
  };
}

/**
 * Run one simc invocation and return structured results.
 *
 * When simc rejects individual profilesets (an item a class cannot use,
 * an illegal weapon combination), their names are reported so the caller
 * can drop them and retry rather than losing the whole batch.
 */
export async function runSimc(
  profile: string,
  timeoutMs: number,
): Promise<SimcRunOutput & { rejected: string[] }> {
  const engine = await findEngine();
  const dir = await mkdtemp(path.join(tmpdir(), "papi-simc-"));
  try {
    const profilePath = path.join(dir, "profile.simc");
    const jsonPath = path.join(dir, "result.json");
    await writeFile(profilePath, profile, "utf8");

    const { code, stdout, stderr } = await runBinary(
      engine.binary,
      [profilePath, `json2=${jsonPath}`],
      dir,
      timeoutMs,
    );

    const combined = `${stdout}\n${stderr}`;
    const rejected: string[] = [];
    for (const m of combined.matchAll(PROFILESET_ERROR)) rejected.push(m[1]);

    let raw: string;
    try {
      raw = await readFile(jsonPath, "utf8");
    } catch {
      const detail = firstError(combined) ?? `simc exited with code ${code}`;
      throw new SimcRunFailure(
        `SimulationCraft produced no results: ${detail}`,
        rejected,
      );
    }

    let json: SimcJson;
    try {
      json = JSON.parse(raw) as SimcJson;
    } catch {
      throw new OptimizerError(
        "ENGINE_FAILED",
        "SimulationCraft wrote a JSON report that could not be parsed.",
      );
    }

    const player = json.sim?.players?.[0];
    const dps = player?.collected_data?.dps;
    if (!player || typeof dps?.mean !== "number") {
      throw new OptimizerError(
        "NO_RESULTS",
        "SimulationCraft returned no DPS for the baseline profile.",
      );
    }

    // SimC reports the standard error of the mean; the 95% confidence
    // half-width used everywhere else in this app is 1.96 * that.
    const baseline: SimResultPoint = {
      mean: dps.mean,
      meanError: (dps.mean_std_dev ?? 0) * 1.96,
      iterations: dps.count ?? json.sim?.options?.iterations ?? 0,
    };

    const profilesets = new Map<string, SimResultPoint>();
    for (const entry of json.sim?.profilesets?.results ?? []) {
      if (!entry.name || typeof entry.mean !== "number") continue;
      profilesets.set(entry.name, {
        mean: entry.mean,
        meanError: entry.mean_error ?? 0,
        iterations: entry.iterations ?? 0,
      });
    }

    const gear = new Map<string, ResolvedItem>();
    for (const [slot, item] of Object.entries(player.gear ?? {})) {
      if (!item?.name) continue;
      gear.set(slot, { name: item.name, ilvl: item.ilevel ?? null });
    }

    return { baseline, profilesets, gear, engine, rejected };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function firstError(output: string): string | null {
  for (const line of output.split("\n")) {
    if (line.trim().startsWith("Error:")) return line.trim();
  }
  return null;
}
