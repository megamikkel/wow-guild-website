/**
 * Gear optimizer data model.
 *
 * The optimizer never ranks gear itself: every DPS number in these types
 * comes from a real SimulationCraft run. See docs/gear-optimizer.md.
 */

export const SLOT_TOKENS = [
  "head",
  "neck",
  "shoulder",
  "back",
  "chest",
  "wrist",
  "hands",
  "waist",
  "legs",
  "feet",
  "finger1",
  "finger2",
  "trinket1",
  "trinket2",
  "main_hand",
  "off_hand",
] as const;

export type SlotToken = (typeof SLOT_TOKENS)[number];

/** Slots optimized together because their items are interchangeable. */
export const SLOT_GROUPS = [
  "head",
  "neck",
  "shoulder",
  "back",
  "chest",
  "wrist",
  "hands",
  "waist",
  "legs",
  "feet",
  "finger",
  "trinket",
  "weapon",
] as const;

export type SlotGroupId = (typeof SLOT_GROUPS)[number];

export const GROUP_SLOTS: Record<SlotGroupId, SlotToken[]> = {
  head: ["head"],
  neck: ["neck"],
  shoulder: ["shoulder"],
  back: ["back"],
  chest: ["chest"],
  wrist: ["wrist"],
  hands: ["hands"],
  waist: ["waist"],
  legs: ["legs"],
  feet: ["feet"],
  finger: ["finger1", "finger2"],
  trinket: ["trinket1", "trinket2"],
  weapon: ["main_hand", "off_hand"],
};

export function groupOfSlot(slot: SlotToken): SlotGroupId {
  if (slot === "finger1" || slot === "finger2") return "finger";
  if (slot === "trinket1" || slot === "trinket2") return "trinket";
  if (slot === "main_hand" || slot === "off_hand") return "weapon";
  return slot;
}

/**
 * Slots where set bonuses, on-use/proc effects and weapon damage make item
 * comparisons highly non-linear. Screening prunes these far more
 * conservatively than plain stat slots.
 */
export const SENSITIVE_GROUPS: ReadonlySet<SlotGroupId> = new Set([
  "head",
  "shoulder",
  "chest",
  "hands",
  "legs",
  "trinket",
  "weapon",
  "finger",
]);

export interface ItemInstance {
  /** Unique per physical copy the character owns (eq:head, bag:3, ...). */
  instanceId: string;
  /** Slot the item occupied in the /simc export. */
  exportSlot: SlotToken;
  group: SlotGroupId;
  itemId: number | null;
  /** Item name from the export comment (bag items) — equipped items are
   *  named later by SimulationCraft's own item database. */
  name: string | null;
  ilvl: number | null;
  /**
   * The verbatim right-hand side of the item line from the export
   * (",id=...,bonus_id=..."), reused untouched in generated profiles so
   * SimC reconstructs the item exactly (gems, crafted stats, tuning, ...).
   */
  simcString: string;
  source: "equipped" | "bags";
}

export interface SavedLoadout {
  name: string;
  talents: string;
}

export interface ParsedCharacter {
  /** SimC class token, e.g. "paladin". */
  classToken: string;
  name: string;
  level: number | null;
  race: string | null;
  region: string | null;
  server: string | null;
  spec: string | null;
  role: string | null;
  talents: string | null;
  savedLoadouts: SavedLoadout[];
  /**
   * All character-scope key=value lines from the export, in order, with
   * gear lines and sim-control options removed. Reused verbatim when
   * generating profiles (talents, consumables, professions, ...).
   */
  charLines: string[];
  equipped: Partial<Record<SlotToken, ItemInstance>>;
  bagItems: ItemInstance[];
  warnings: string[];
}

export interface GearPoolGroup {
  group: SlotGroupId;
  slots: SlotToken[];
  /** Every owned candidate for this group, equipped items first. */
  items: ItemInstance[];
}

export type GearPool = Record<SlotGroupId, GearPoolGroup>;

export type SimMode = "single_target" | "aoe";

export interface SimSettings {
  mode: SimMode;
  targets: number;
  durationSeconds: number;
  fightStyle: string;
  screeningIterations: number;
  evaluationIterations: number;
  verificationIterations: number;
  /** simc `threads=` — 0 lets simc pick. */
  threads: number;
  /** Cap on stage-2 full combination sims. */
  maxCombinations: number;
  /** Setups re-simmed at verification iterations. */
  verifyTop: number;
}

/** One tested gear configuration, expressed as overrides vs equipped gear. */
export interface GearOverride {
  slot: SlotToken;
  /** null clears the slot (e.g. off_hand when equipping a two-hander). */
  item: ItemInstance | null;
}

export interface Candidate {
  /** Doubles as the SimC profileset name (unique, no dots). */
  id: string;
  overrides: GearOverride[];
  stage: "screening" | "combination";
}

export interface SimResultPoint {
  mean: number;
  /** Half-width of the 95% confidence interval, from SimC. */
  meanError: number;
  iterations: number;
}

export interface SlotItemView {
  slot: SlotToken;
  name: string;
  ilvl: number | null;
  itemId: number | null;
  source: "equipped" | "bags" | "empty";
}

export interface SetupResult {
  rank: number;
  dps: number;
  dpsError: number;
  gainDps: number;
  gainPct: number;
  withinErrorOfBest: boolean;
  overrides: { slot: SlotToken; label: string }[];
  gear: SlotItemView[];
}

export interface GearChange {
  slot: SlotToken;
  from: SlotItemView | null;
  to: SlotItemView | null;
}

export interface OptimizerResult {
  character: {
    name: string;
    classToken: string;
    spec: string | null;
    level: number | null;
    region: string | null;
    server: string | null;
    talentSource: "active";
  };
  mode: SimMode;
  simulation: {
    simcVersion: string;
    wowVersion: string;
    fightStyle: string;
    targets: number;
    durationSeconds: number;
    verificationIterations: number;
    threads: number;
  };
  baseline: SimResultPoint & { gear: SlotItemView[] };
  bestSetup: SetupResult;
  topSetups: SetupResult[];
  gearChanges: GearChange[];
  candidatesTested: number;
  simsRun: number;
  cacheHits: number;
  invalidCombinations: string[];
  /** Best vs. baseline difference is inside the combined 95% error bars. */
  improvementWithinError: boolean;
  warnings: string[];
}

export type JobPhase =
  | "parsing"
  | "baseline"
  | "screening"
  | "combinations"
  | "verifying"
  | "done"
  | "error";

export interface JobProgress {
  phase: JobPhase;
  message: string;
  /** Work units done / total within the current phase, when known. */
  done: number;
  total: number;
  itemsDetected: number;
  candidatesPlanned: number;
  candidatesTested: number;
  startedAt: number;
  updatedAt: number;
}

export interface OptimizerJob {
  id: string;
  status: "running" | "done" | "error";
  progress: JobProgress;
  result: OptimizerResult | null;
  error: string | null;
}

export class OptimizerError extends Error {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "NO_CHARACTER"
      | "NO_GEAR"
      | "ENGINE_NOT_FOUND"
      | "ENGINE_FAILED"
      | "NO_RESULTS",
    message: string,
  ) {
    super(message);
    this.name = "OptimizerError";
  }
}
