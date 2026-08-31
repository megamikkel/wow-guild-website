import { runSimc } from "./engine";
import { baseProfileLines, simHeader } from "./profile";
import type { ItemInstance, ParsedCharacter, SimSettings } from "./types";

/**
 * Weapon equip legality.
 *
 * SimulationCraft does not validate that a weapon combination is legal: it
 * will happily equip an off-hand alongside a two-handed weapon and count
 * its stats, which the game forbids. So the engine cannot be trusted to
 * reject those setups — but it does know each weapon's hand type, and
 * exposes it through the `main_hand.2h` action expression.
 *
 * This probe asks it. The profile's action list is replaced with a single
 * auto-attack, once unconditionally and once gated on `main_hand.2h`; a
 * weapon that swings in both runs is two-handed, one that swings only in
 * the unconditional run is one-handed. The runs are short — they exist to
 * read a flag, not to measure damage.
 */

export type HandType = "1h" | "2h";

/** DPS below this counts as "did not attack" rather than a real swing. */
const SWING_EPSILON = 1;

function probeProfile(
  parsed: ParsedCharacter,
  settings: SimSettings,
  mainHands: ItemInstance[],
  condition: string | null,
): string {
  const action = condition ? `actions=auto_attack,if=${condition}` : "actions=auto_attack";
  const lines = [
    "# Weapon hand-type probe — reads a flag from SimulationCraft, measures nothing.",
    ...simHeader({ ...settings, targets: 1 }, 50),
    "max_time=60",
    "",
    ...baseProfileLines(parsed),
    action,
    "",
    ...mainHands.map(
      (item, idx) => `profileset."w_${idx}"=main_hand=${item.simcString}`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

export interface WeaponProbeResult {
  /** Item instance id → hand type. */
  types: Map<string, HandType>;
  warnings: string[];
}

/**
 * Determine the hand type of every main-hand candidate.
 *
 * Anything the probe cannot resolve is reported as two-handed: that only
 * ever removes off-hand pairings from the search, so an inconclusive
 * probe can never produce a setup the game would reject.
 */
export async function probeWeaponHandTypes(
  parsed: ParsedCharacter,
  settings: SimSettings,
  mainHands: ItemInstance[],
): Promise<WeaponProbeResult> {
  const types = new Map<string, HandType>();
  const warnings: string[] = [];
  if (mainHands.length === 0) return { types, warnings };

  const equipped = parsed.equipped.main_hand ?? null;
  const timeout = 5 * 60_000;

  const [control, gated] = await Promise.all([
    runSimc(probeProfile(parsed, settings, mainHands, null), timeout),
    runSimc(probeProfile(parsed, settings, mainHands, "main_hand.2h"), timeout),
  ]);

  // SimulationCraft omits profilesets whose metric is zero, so a missing
  // entry means "did not swing".
  const dpsFor = (
    run: { baseline: { mean: number }; profilesets: Map<string, { mean: number }> },
    idx: number,
    item: ItemInstance,
  ): number => {
    if (equipped && item.instanceId === equipped.instanceId) return run.baseline.mean;
    return run.profilesets.get(`w_${idx}`)?.mean ?? 0;
  };

  mainHands.forEach((item, idx) => {
    const swings = dpsFor(control, idx, item);
    const swingsWhenTwoHanded = dpsFor(gated, idx, item);

    if (swings <= SWING_EPSILON) {
      // The actor does not auto-attack at all, so the gate tells us
      // nothing. Assume two-handed, which only narrows the search.
      types.set(item.instanceId, "2h");
      warnings.push(
        `Could not determine the hand type of ${item.name ?? `item ${item.itemId}`}; it was treated as two-handed and not paired with an off-hand.`,
      );
      return;
    }
    types.set(item.instanceId, swingsWhenTwoHanded > SWING_EPSILON ? "2h" : "1h");
  });

  return { types, warnings };
}
