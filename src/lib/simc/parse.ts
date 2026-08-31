import {
  type ItemInstance,
  OptimizerError,
  type ParsedCharacter,
  type SavedLoadout,
  SLOT_TOKENS,
  type SlotToken,
  groupOfSlot,
} from "./types";

const CLASS_TOKENS = [
  "deathknight",
  "death_knight",
  "demonhunter",
  "demon_hunter",
  "druid",
  "evoker",
  "hunter",
  "mage",
  "monk",
  "paladin",
  "priest",
  "rogue",
  "shaman",
  "warlock",
  "warrior",
] as const;

const SLOT_SET = new Set<string>(SLOT_TOKENS);

/** Cosmetic slots we carry through to profiles but never optimize. */
const PASSTHROUGH_SLOTS = new Set(["shirt", "tabard"]);

/**
 * Sim-control keys are stripped from the character block: the optimizer
 * owns encounter settings so every candidate is simmed under identical
 * conditions.
 */
const STRIPPED_KEYS = new Set([
  "iterations",
  "target_error",
  "threads",
  "max_time",
  "vary_combat_length",
  "desired_targets",
  "fight_style",
  "optimal_raid",
  "output",
  "html",
  "json",
  "json2",
  "report_details",
  "single_actor_batch",
  "deterministic",
  "seed",
  "input",
]);

const ITEM_LINE = /^([a-z_0-9]+)=(.*)$/;
const BAG_ITEM_COMMENT = /^#\s*([a-z_0-9]+)=(,.*)$/i;
const BAG_NAME_COMMENT = /^#\s*(.+?)\s*\((\d+)\)\s*$/;
const SAVED_LOADOUT = /^#\s*Saved Loadout:\s*(.+)$/i;
const COMMENT_TALENTS = /^#\s*talents=(\S+)/;

function parseItemId(simcString: string): number | null {
  const m = simcString.match(/(?:^|,)id=(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Some exports lead with the item's token name (`head=name,id=...`); the
 * /simc addon leaves it empty (`head=,id=...`). SimulationCraft supplies
 * the authoritative name later, so this is only a fallback.
 */
function parseItemNameToken(simcString: string): string | null {
  const head = simcString.split(",")[0]?.trim();
  if (!head || head.includes("=")) return null;
  return head;
}

/** "tempered_horns_of_the_jade_warlord" → "Tempered Horns of the Jade Warlord" */
export function humanizeToken(token: string | null): string | null {
  if (!token) return null;
  const small = new Set(["of", "the", "a", "an", "and", "in", "to", "for"]);
  return token
    .split("_")
    .filter(Boolean)
    .map((word, idx) =>
      idx > 0 && small.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

/**
 * Parse a complete `/simc` addon export.
 *
 * Only items under a "Gear from Bags" heading count as owned bag gear;
 * commented items in other sections (Weekly Reward Choices etc.) are not
 * in the character's possession and are ignored.
 */
export function parseSimcInput(input: string): ParsedCharacter {
  if (!input || input.trim().length === 0) {
    throw new OptimizerError("INVALID_INPUT", "SimC input is empty.");
  }

  const lines = input.replace(/\r\n/g, "\n").split("\n");

  let classToken: string | null = null;
  let name: string | null = null;
  const meta: Record<string, string> = {};
  const charLines: string[] = [];
  const equipped: Partial<Record<SlotToken, ItemInstance>> = {};
  const bagItems: ItemInstance[] = [];
  const savedLoadouts: SavedLoadout[] = [];
  const warnings: string[] = [];

  type Section = "character" | "bags" | "ignored";
  let section: Section = "character";
  let pendingBagName: { name: string; ilvl: number } | null = null;
  let pendingLoadoutName: string | null = null;
  let bagSeq = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    if (line.startsWith("###")) {
      const heading = line.replace(/^#+\s*/, "").toLowerCase();
      section = heading.includes("gear from bags") ? "bags" : "ignored";
      pendingBagName = null;
      continue;
    }

    if (line.startsWith("#")) {
      const loadout = line.match(SAVED_LOADOUT);
      if (loadout) {
        pendingLoadoutName = loadout[1].trim();
        continue;
      }
      const talents = line.match(COMMENT_TALENTS);
      if (talents && pendingLoadoutName) {
        savedLoadouts.push({ name: pendingLoadoutName, talents: talents[1] });
        pendingLoadoutName = null;
        continue;
      }

      if (section !== "bags") continue;

      const bagItem = line.match(BAG_ITEM_COMMENT);
      if (bagItem) {
        const slot = bagItem[1].toLowerCase();
        const simcString = bagItem[2];
        if (PASSTHROUGH_SLOTS.has(slot)) continue;
        if (!SLOT_SET.has(slot)) {
          warnings.push(`Ignored bag item in unknown slot "${slot}".`);
          pendingBagName = null;
          continue;
        }
        const slotToken = slot as SlotToken;
        bagItems.push({
          instanceId: `bag:${bagSeq++}`,
          exportSlot: slotToken,
          group: groupOfSlot(slotToken),
          itemId: parseItemId(simcString),
          name: pendingBagName?.name ?? humanizeToken(parseItemNameToken(simcString)),
          ilvl: pendingBagName?.ilvl ?? null,
          simcString,
          source: "bags",
        });
        pendingBagName = null;
        continue;
      }

      const nameComment = line.match(BAG_NAME_COMMENT);
      if (nameComment) {
        pendingBagName = { name: nameComment[1], ilvl: Number(nameComment[2]) };
      }
      continue;
    }

    // Non-comment lines only define the character in the top section.
    if (section !== "character") continue;

    const kv = line.match(ITEM_LINE);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    const value = kv[2];

    if (!classToken && (CLASS_TOKENS as readonly string[]).includes(key)) {
      classToken = key;
      name = value.replace(/^"|"$/g, "");
      charLines.push(line);
      continue;
    }

    if (SLOT_SET.has(key)) {
      const slotToken = key as SlotToken;
      if (value.trim() === "") continue; // empty slot
      equipped[slotToken] = {
        instanceId: `eq:${slotToken}`,
        exportSlot: slotToken,
        group: groupOfSlot(slotToken),
        itemId: parseItemId(value),
        name: humanizeToken(parseItemNameToken(value)),
        ilvl: null,
        simcString: value,
        source: "equipped",
      };
      continue;
    }

    if (PASSTHROUGH_SLOTS.has(key)) {
      charLines.push(line);
      continue;
    }

    if (STRIPPED_KEYS.has(key)) {
      warnings.push(`Removed sim-control option "${key}" from the input.`);
      continue;
    }

    meta[key] = value;
    charLines.push(line);
  }

  if (!classToken || !name) {
    throw new OptimizerError(
      "NO_CHARACTER",
      'No character definition found. Expected a line like paladin="Name" from the /simc addon export.',
    );
  }
  if (Object.keys(equipped).length === 0) {
    throw new OptimizerError(
      "NO_GEAR",
      "No equipped gear found in the SimC input. Paste the complete /simc export.",
    );
  }
  if (!meta.talents) {
    warnings.push("No talents= line found — SimC will sim without talents.");
  }

  return {
    classToken,
    name,
    level: meta.level ? Number(meta.level) : null,
    race: meta.race ?? null,
    region: meta.region ?? null,
    server: meta.server ?? null,
    spec: meta.spec ?? null,
    role: meta.role ?? null,
    talents: meta.talents ?? null,
    savedLoadouts,
    charLines,
    equipped,
    bagItems,
    warnings,
  };
}
