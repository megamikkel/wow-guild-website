/**
 * Command line entry point for the gear optimizer.
 *
 *   npm run optimize -- --file profile.simc --mode aoe
 *
 * Prints a human readable report and, with --json <path>, the structured
 * result. Exits non-zero when SimulationCraft is missing or fails: there
 * is no estimated fallback.
 */

import { readFile, writeFile } from "node:fs/promises";

import { optimizeGear } from "./optimizer";
import {
  type JobProgress,
  OptimizerError,
  type OptimizerResult,
  type SimMode,
  type SimSettings,
} from "./types";

const SLOT_LABELS: Record<string, string> = {
  head: "HEAD",
  neck: "NECK",
  shoulder: "SHOULDER",
  back: "BACK",
  chest: "CHEST",
  wrist: "WRIST",
  hands: "HANDS",
  waist: "WAIST",
  legs: "LEGS",
  feet: "FEET",
  finger1: "FINGER 1",
  finger2: "FINGER 2",
  trinket1: "TRINKET 1",
  trinket2: "TRINKET 2",
  main_hand: "MAIN HAND",
  off_hand: "OFF HAND",
};

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

interface CliArgs {
  file: string | null;
  mode: SimMode;
  jsonOut: string | null;
  settings: Partial<SimSettings>;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { file: null, mode: "single_target", jsonOut: null, settings: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--file":
      case "-f":
        args.file = next();
        break;
      case "--mode":
      case "-m": {
        const value = next();
        if (value !== "single_target" && value !== "aoe") {
          throw new Error(`--mode must be single_target or aoe (got "${value}")`);
        }
        args.mode = value;
        break;
      }
      case "--json":
        args.jsonOut = next();
        break;
      case "--targets":
        args.settings.targets = Number(next());
        break;
      case "--duration":
        args.settings.durationSeconds = Number(next());
        break;
      case "--threads":
        args.settings.threads = Number(next());
        break;
      case "--screening-iterations":
        args.settings.screeningIterations = Number(next());
        break;
      case "--evaluation-iterations":
        args.settings.evaluationIterations = Number(next());
        break;
      case "--verification-iterations":
        args.settings.verificationIterations = Number(next());
        break;
      case "--max-combinations":
        args.settings.maxCombinations = Number(next());
        break;
      case "--verify-top":
        args.settings.verifyTop = Number(next());
        break;
      default:
        if (!args.file && !arg.startsWith("-")) args.file = arg;
    }
  }
  return args;
}

export function renderReport(result: OptimizerResult): string {
  const out: string[] = [];
  const best = result.bestSetup;

  out.push("");
  out.push(result.mode === "aoe" ? "BEST AOE GEAR" : "BEST SINGLE TARGET GEAR");
  out.push("");
  out.push(result.character.name);
  out.push(
    `${result.character.spec ?? ""} ${result.character.classToken}`.trim().toUpperCase(),
  );
  out.push("");
  out.push(`Current DPS:   ${fmt(result.baseline.mean)} ±${fmt(result.baseline.meanError)}`);
  out.push(`Optimized DPS: ${fmt(best.dps)} ±${fmt(best.dpsError)}`);
  out.push(
    `Gain:          ${best.gainDps >= 0 ? "+" : ""}${fmt(best.gainDps)} DPS (${
      best.gainPct >= 0 ? "+" : ""
    }${best.gainPct.toFixed(2)}%)`,
  );
  if (result.improvementWithinError) {
    out.push("");
    out.push("Result is within simulation error.");
    out.push("These setups should be considered effectively equal.");
  }

  out.push("");
  out.push("BEST SETUP");
  out.push("");
  for (const item of best.gear) {
    out.push(SLOT_LABELS[item.slot] ?? item.slot.toUpperCase());
    out.push(item.name);
    out.push(`${item.ilvl ?? "?"}  ${item.source === "bags" ? "FROM BAGS" : "CURRENT"}`);
    out.push("");
  }

  out.push("CHANGES FROM CURRENT GEAR");
  out.push("");
  if (result.gearChanges.length === 0) {
    out.push("None — the currently equipped setup was the best simulated combination.");
  } else {
    for (const change of result.gearChanges) {
      out.push(SLOT_LABELS[change.slot] ?? change.slot.toUpperCase());
      out.push(
        `${change.from ? `${change.from.ilvl ?? "?"} ${change.from.name}` : "Empty"}`,
      );
      out.push("→");
      out.push(`${change.to ? `${change.to.ilvl ?? "?"} ${change.to.name}` : "Empty"}`);
      if (
        change.from?.ilvl != null &&
        change.to?.ilvl != null &&
        change.to.ilvl < change.from.ilvl
      ) {
        out.push("(lower item level, but simulated higher — set bonus or item effect)");
      }
      out.push("");
    }
  }

  out.push("TOP SETUPS");
  out.push("");
  for (const setup of result.topSetups) {
    out.push(
      `${setup.rank}. ${fmt(setup.dps)} DPS   ${setup.gainPct >= 0 ? "+" : ""}${setup.gainPct.toFixed(2)}%${
        setup.withinErrorOfBest ? "   (tied with best, within error)" : ""
      }`,
    );
  }

  out.push("");
  out.push("SIMULATION DETAILS");
  out.push("");
  out.push(`Mode: ${result.mode === "aoe" ? "AoE" : "Single Target"}`);
  out.push(`Targets: ${result.simulation.targets}`);
  out.push(`Fight style: ${result.simulation.fightStyle}`);
  out.push(`Duration: ${result.simulation.durationSeconds} sec`);
  out.push(`Iterations: ${fmt(result.simulation.verificationIterations)}`);
  out.push(`SimulationCraft version: ${result.simulation.simcVersion}`);
  out.push(`Game data: ${result.simulation.wowVersion}`);
  out.push("Talent build: Active");
  out.push(`Error: ±${fmt(best.dpsError)} DPS`);
  out.push(`Setups tested: ${fmt(result.candidatesTested)}`);
  out.push(`SimC runs: ${fmt(result.simsRun)} (cache hits: ${fmt(result.cacheHits)})`);
  for (const warning of result.warnings) out.push(`Note: ${warning}`);
  if (result.invalidCombinations.length > 0) {
    out.push(
      `Note: ${result.invalidCombinations.length} combination(s) rejected by SimulationCraft as invalid.`,
    );
  }
  out.push("");
  return out.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    process.stderr.write(
      "Usage: optimize --file <simc-export.txt> [--mode single_target|aoe] [--json out.json]\n",
    );
    process.exit(2);
  }

  const input = await readFile(args.file, "utf8");
  let lastLine = "";
  const report = (progress: Partial<JobProgress>) => {
    const line = progress.total
      ? `${progress.message ?? progress.phase ?? ""} ${progress.done ?? 0} / ${progress.total}`
      : (progress.message ?? "");
    if (line && line !== lastLine) {
      lastLine = line;
      process.stderr.write(`${line}\n`);
    }
  };

  try {
    const result = await optimizeGear({
      input,
      mode: args.mode,
      settings: args.settings,
      onProgress: report,
    });
    if (args.jsonOut) {
      await writeFile(args.jsonOut, JSON.stringify(result, null, 2), "utf8");
    }
    process.stdout.write(renderReport(result));
  } catch (err) {
    if (err instanceof OptimizerError) {
      process.stderr.write(`\n${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && /simc[\\/]cli\.[tj]s$/.test(process.argv[1]);
if (invokedDirectly) {
  void main();
}
