import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildGearPool, generateGroupOptions } from "@/lib/simc/gear-pool";
import { parseSimcInput } from "@/lib/simc/parse";
import { buildProfile, candidateLines } from "@/lib/simc/profile";
import { buildCombinations, resolveSettings, withinError } from "@/lib/simc/optimizer";
import { parseArgs } from "@/lib/simc/cli";
import { OptimizerError, type SlotGroupId } from "@/lib/simc/types";

const fixture = readFileSync(
  path.join(__dirname, "fixtures", "simc-export.txt"),
  "utf8",
);

describe("simc parser", () => {
  const parsed = parseSimcInput(fixture);

  it("extracts the character definition", () => {
    expect(parsed.classToken).toBe("warrior");
    expect(parsed.name).toBe("Kreaturen");
    expect(parsed.level).toBe(90);
    expect(parsed.race).toBe("dwarf");
    expect(parsed.region).toBe("eu");
    expect(parsed.server).toBe("draenor");
    expect(parsed.spec).toBe("arms");
    expect(parsed.talents).toMatch(/^CcEAA/);
  });

  it("keeps the active talents and stores saved loadouts separately", () => {
    expect(parsed.savedLoadouts).toHaveLength(1);
    expect(parsed.savedLoadouts[0].name).toBe("M+");
    // The active build must not be replaced by a saved loadout.
    expect(parsed.charLines.some((l) => l === `talents=${parsed.talents}`)).toBe(true);
  });

  it("stores the original item string verbatim", () => {
    expect(parsed.equipped.head?.simcString).toBe(
      "tempered_horns_of_the_jade_warlord,id=271456,bonus_id=12854/13335/13750,gem_id=240967,enchant_id=7961",
    );
    expect(parsed.equipped.head?.itemId).toBe(271456);
  });

  it("parses bag items with name and item level from the comment", () => {
    const legs = parsed.bagItems.find((i) => i.itemId === 271455);
    expect(legs).toBeDefined();
    expect(legs?.name).toBe("Greaves of the Jade Warlord");
    expect(legs?.ilvl).toBe(330);
    expect(legs?.exportSlot).toBe("legs");
    expect(legs?.source).toBe("bags");
  });

  it("ignores commented items outside the Gear from Bags section", () => {
    // A weekly reward choice is not owned gear.
    expect(parsed.bagItems.some((i) => i.itemId === 999999)).toBe(false);
  });

  it("carries consumables through but strips sim-control options", () => {
    const withOptions = parseSimcInput(
      fixture.replace(
        "spec=arms",
        "spec=arms\niterations=50000\nmax_time=120\nfight_style=DungeonSlice",
      ),
    );
    expect(withOptions.charLines.some((l) => l.startsWith("iterations="))).toBe(false);
    expect(withOptions.charLines.some((l) => l.startsWith("fight_style="))).toBe(false);
    expect(withOptions.charLines).toContain("potion=lights_potential_2");
    expect(withOptions.warnings.some((w) => w.includes("iterations"))).toBe(true);
  });

  it("rejects input without a character or gear", () => {
    expect(() => parseSimcInput("")).toThrow(OptimizerError);
    expect(() => parseSimcInput("level=90\nrace=dwarf")).toThrow(/No character definition/);
    expect(() => parseSimcInput('warrior="X"\nlevel=90')).toThrow(/No equipped gear/);
  });
});

describe("gear pool", () => {
  const parsed = parseSimcInput(fixture);
  const pool = buildGearPool(parsed);

  it("always keeps the equipped item as a candidate", () => {
    expect(pool.head.items.some((i) => i.itemId === 271456)).toBe(true);
    expect(pool.head.items.some((i) => i.itemId === 271474)).toBe(true);
  });

  it("adds bag items to the right slot group", () => {
    expect(pool.legs.items.map((i) => i.itemId).sort()).toEqual([271455, 271878]);
    // A shoulder exists only in bags — the slot is otherwise empty.
    expect(pool.shoulder.items).toHaveLength(1);
    expect(pool.weapon.items.map((i) => i.itemId).sort()).toEqual([268196, 268209, 268213]);
  });

  it("enumerates rings as unordered pairs, not per-slot picks", () => {
    const options = generateGroupOptions(parsed, pool).get("finger")!;
    // 4 owned rings → C(4,2) = 6 distinct pairs.
    expect(options).toHaveLength(6);
    expect(options.filter((o) => o.overrides.length === 0)).toHaveLength(1);
    // No pair may use the same physical copy twice.
    for (const option of options) {
      const ids = option.overrides.map((o) => o.item?.instanceId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("pairs each main hand with every off hand and with none", () => {
    const options = generateGroupOptions(parsed, pool).get("weapon")!;
    // 2 main hands × (1 off hand + empty) = 4.
    expect(options).toHaveLength(4);
    const clearsOffHand = options.find((o) =>
      o.overrides.some((ov) => ov.slot === "off_hand" && ov.item === null),
    );
    expect(clearsOffHand).toBeUndefined(); // no off hand equipped, nothing to clear
    expect(
      options.some((o) => o.overrides.some((ov) => ov.slot === "off_hand" && ov.item)),
    ).toBe(true);
  });

  it("keeps the currently equipped configuration in every group", () => {
    const options = generateGroupOptions(parsed, pool);
    for (const [, group] of options) {
      expect(group.some((o) => o.isCurrent)).toBe(true);
    }
  });
});

describe("profile generation", () => {
  const parsed = parseSimcInput(fixture);
  const settings = resolveSettings("aoe");

  it("writes verified sim options and identical settings for every setup", () => {
    const profile = buildProfile(parsed, settings, 1000, []);
    expect(profile).toContain("iterations=1000");
    expect(profile).toContain("fight_style=Patchwerk");
    expect(profile).toContain("desired_targets=5");
    expect(profile).toContain("max_time=180");
    expect(profile).toContain("optimal_raid=1");
  });

  it("reuses the original item strings unchanged", () => {
    const profile = buildProfile(parsed, settings, 1000, []);
    expect(profile).toContain(
      "head=tempered_horns_of_the_jade_warlord,id=271456,bonus_id=12854/13335/13750,gem_id=240967,enchant_id=7961",
    );
  });

  it("emits one profileset with = then += for extra slots", () => {
    const pool = buildGearPool(parsed);
    const legs = pool.legs.items.find((i) => i.itemId === 271455)!;
    const head = pool.head.items.find((i) => i.itemId === 271474)!;
    const lines = candidateLines({
      id: "c_0",
      stage: "combination",
      overrides: [
        { slot: "legs", item: legs },
        { slot: "head", item: head },
      ],
    });
    expect(lines[0]).toBe(`profileset."c_0"=head=,id=271474,bonus_id=4786/12854/13692/13698/13750`);
    expect(lines[1]).toBe(
      `profileset."c_0"+=legs=,id=271455,bonus_id=13693/13698/13846/13848`,
    );
  });

  it("clears a slot with an empty value", () => {
    const lines = candidateLines({
      id: "c_1",
      stage: "combination",
      overrides: [{ slot: "off_hand", item: null }],
    });
    expect(lines[0]).toBe(`profileset."c_1"=off_hand=`);
  });
});

describe("combination search", () => {
  it("produces cross-slot combinations, not isolated single swaps", () => {
    const parsed = parseSimcInput(fixture);
    const pool = buildGearPool(parsed);
    const all = generateGroupOptions(parsed, pool);
    const kept = new Map<SlotGroupId, ReturnType<typeof generateGroupOptions> extends never ? never : NonNullable<ReturnType<typeof all.get>>>();
    for (const group of ["head", "legs", "shoulder"] as SlotGroupId[]) {
      const options = all.get(group);
      if (options) kept.set(group, options);
    }
    const combos = buildCombinations(kept, 100);
    expect(combos.length).toBeGreaterThan(3);
    // At least one setup must change more than one slot at once, which is
    // what makes tier set trade-offs visible to SimulationCraft.
    expect(combos.some((c) => c.length > 1)).toBe(true);
  });

  it("respects the combination cap", () => {
    const parsed = parseSimcInput(fixture);
    const pool = buildGearPool(parsed);
    const all = generateGroupOptions(parsed, pool);
    expect(buildCombinations(all, 7)).toHaveLength(7);
  });
});

describe("statistical comparison", () => {
  it("treats results inside the combined error as equal", () => {
    const a = { mean: 2_104_332, meanError: 2_000, iterations: 20_000 };
    const b = { mean: 2_102_918, meanError: 2_000, iterations: 20_000 };
    expect(withinError(a, b)).toBe(true);
  });

  it("separates results outside the combined error", () => {
    const a = { mean: 2_104_332, meanError: 500, iterations: 20_000 };
    const b = { mean: 2_000_000, meanError: 500, iterations: 20_000 };
    expect(withinError(a, b)).toBe(false);
  });
});

describe("settings", () => {
  it("defaults single target and AoE to different encounters", () => {
    const st = resolveSettings("single_target");
    const aoe = resolveSettings("aoe");
    expect(st.targets).toBe(1);
    expect(aoe.targets).toBe(5);
    expect(aoe.durationSeconds).not.toBe(st.durationSeconds);
  });

  it("allows target count and duration to be configured", () => {
    const custom = resolveSettings("aoe", { targets: 8, durationSeconds: 240 });
    expect(custom.targets).toBe(8);
    expect(custom.durationSeconds).toBe(240);
  });
});

describe("cli argument parsing", () => {
  it("reads mode, file and iteration overrides", () => {
    const args = parseArgs([
      "--file",
      "x.simc",
      "--mode",
      "aoe",
      "--targets",
      "8",
      "--verification-iterations",
      "30000",
    ]);
    expect(args.file).toBe("x.simc");
    expect(args.mode).toBe("aoe");
    expect(args.settings.targets).toBe(8);
    expect(args.settings.verificationIterations).toBe(30_000);
  });

  it("rejects an unknown mode", () => {
    expect(() => parseArgs(["--mode", "cleave"])).toThrow(/single_target or aoe/);
  });
});
