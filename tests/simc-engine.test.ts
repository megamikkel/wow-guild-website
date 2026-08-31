import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { clearResultCache, optimizeGear } from "@/lib/simc/optimizer";
import { OptimizerError } from "@/lib/simc/types";

/**
 * These tests drive a real SimulationCraft binary. They are the only
 * proof that the generated profiles are valid SimC and that the reported
 * numbers come from the engine, so they run whenever SIMC_PATH points at
 * an installation and are skipped otherwise.
 */

const fixture = readFileSync(
  path.join(__dirname, "fixtures", "simc-export.txt"),
  "utf8",
);

const hasEngine = Boolean(process.env.SIMC_PATH);
const describeEngine = hasEngine ? describe : describe.skip;

// A short, low-iteration search: enough to exercise every stage.
const fastSettings = {
  screeningIterations: 200,
  evaluationIterations: 300,
  verificationIterations: 500,
  maxCombinations: 8,
  verifyTop: 3,
  threads: 4,
};

describeEngine("optimizer against a real SimulationCraft engine", () => {
  it("simulates single target and reports engine-sourced numbers", async () => {
    clearResultCache();
    const result = await optimizeGear({
      input: fixture,
      mode: "single_target",
      settings: fastSettings,
    });

    expect(result.simulation.simcVersion).toMatch(/^\d/);
    expect(result.simulation.targets).toBe(1);
    expect(result.baseline.mean).toBeGreaterThan(0);
    expect(result.baseline.iterations).toBeGreaterThan(0);
    expect(result.bestSetup.dps).toBeGreaterThan(0);
    // The winner is never worse than the current gear it was ranked against.
    expect(result.bestSetup.dps).toBeGreaterThanOrEqual(
      result.baseline.mean - result.baseline.meanError,
    );
    expect(result.topSetups.length).toBeGreaterThan(1);
    // Ranking is by simulated DPS, descending.
    for (let i = 1; i < result.topSetups.length; i++) {
      expect(result.topSetups[i - 1].dps).toBeGreaterThanOrEqual(result.topSetups[i].dps);
    }
    // The final ranking must come from the verification iteration count.
    expect(result.simulation.verificationIterations).toBe(
      fastSettings.verificationIterations,
    );
  }, 900_000);

  it("simulates AoE against several targets, not single target relabelled", async () => {
    clearResultCache();
    const [st, aoe] = [
      await optimizeGear({ input: fixture, mode: "single_target", settings: fastSettings }),
      await optimizeGear({ input: fixture, mode: "aoe", settings: fastSettings }),
    ];

    expect(aoe.simulation.targets).toBe(5);
    expect(st.simulation.targets).toBe(1);
    // Five targets must produce materially more damage than one.
    expect(aoe.baseline.mean).toBeGreaterThan(st.baseline.mean * 1.5);
  }, 1_800_000);

  it("excludes combinations the engine cannot simulate", async () => {
    clearResultCache();
    const result = await optimizeGear({
      input: fixture,
      mode: "single_target",
      settings: fastSettings,
    });
    // The fixture holds an off-hand the character cannot pair with its
    // two-handed weapon; SimulationCraft rejects it and it must not
    // appear in any recommended setup.
    for (const setup of result.topSetups) {
      const offHand = setup.gear.find((g) => g.slot === "off_hand");
      expect(offHand?.itemId ?? null).not.toBe(268196);
    }
  }, 900_000);

  it("reuses cached results for an identical repeated search", async () => {
    clearResultCache();
    const settings = { ...fastSettings, maxCombinations: 4, verifyTop: 2 };
    const first = await optimizeGear({ input: fixture, mode: "single_target", settings });
    const second = await optimizeGear({ input: fixture, mode: "single_target", settings });
    expect(first.cacheHits).toBe(0);
    expect(second.cacheHits).toBeGreaterThan(0);
    expect(second.simsRun).toBeLessThan(first.simsRun);
    expect(second.bestSetup.dps).toBeCloseTo(first.bestSetup.dps, 5);
  }, 1_800_000);
});

describe("engine discovery", () => {
  it("refuses to produce a recommendation without SimulationCraft", async () => {
    const original = process.env.SIMC_PATH;
    const originalPath = process.env.PATH;
    process.env.SIMC_PATH = "/nonexistent/simc";
    process.env.PATH = "/nonexistent";
    try {
      const { findEngine } = await import("@/lib/simc/engine");
      await expect(findEngine(true)).rejects.toThrow(OptimizerError);
      await expect(findEngine(true)).rejects.toThrow(
        /SimulationCraft engine not found[\s\S]*No gear recommendation can be calculated reliably/,
      );
    } finally {
      process.env.SIMC_PATH = original;
      process.env.PATH = originalPath;
      const { findEngine } = await import("@/lib/simc/engine");
      if (original) await findEngine(true).catch(() => undefined);
    }
  }, 120_000);
});
