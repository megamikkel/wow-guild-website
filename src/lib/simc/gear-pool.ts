import {
  GROUP_SLOTS,
  type GearOverride,
  type GearPool,
  type ItemInstance,
  type ParsedCharacter,
  SLOT_GROUPS,
  type SlotGroupId,
  type SlotToken,
} from "./types";

export function buildGearPool(parsed: ParsedCharacter): GearPool {
  const pool = {} as GearPool;
  for (const group of SLOT_GROUPS) {
    pool[group] = { group, slots: GROUP_SLOTS[group], items: [] };
  }
  for (const slot of Object.keys(parsed.equipped) as SlotToken[]) {
    const item = parsed.equipped[slot];
    if (item) pool[item.group].items.push(item);
  }
  for (const item of parsed.bagItems) {
    pool[item.group].items.push(item);
  }
  return pool;
}

export function itemLabel(item: ItemInstance | null): string {
  if (!item) return "Empty";
  if (item.name) return item.ilvl ? `${item.name} (${item.ilvl})` : item.name;
  if (item.itemId) return `Item ${item.itemId}`;
  return "Unknown item";
}

/**
 * One way to fill a slot group. `overrides` is empty for the currently
 * equipped configuration; every option is only ever ranked by an actual
 * SimulationCraft result.
 */
export interface GroupOption {
  key: string;
  group: SlotGroupId;
  overrides: GearOverride[];
  isCurrent: boolean;
  label: string;
}

function overrideSignature(overrides: GearOverride[]): string {
  return overrides
    .map((o) => `${o.slot}=${o.item ? o.item.simcString : ""}`)
    .sort()
    .join("&");
}

function pairKey(a: ItemInstance, b: ItemInstance | null): string {
  const ids = [a.instanceId, b?.instanceId ?? "-"].sort();
  return ids.join("+");
}

/** Overrides that turn the equipped pair slots into the pair {a, b}. */
function pairOverrides(
  slots: SlotToken[],
  equipped: (ItemInstance | null)[],
  a: ItemInstance,
  b: ItemInstance | null,
): GearOverride[] {
  const want: (ItemInstance | null)[] = [a, b];
  // Keep an item in the slot it already occupies where possible, so
  // overrides stay minimal (fewer profileset lines, better cache reuse).
  const [e0, e1] = equipped;
  const inSlot = (item: ItemInstance | null, eq: ItemInstance | null) =>
    item !== null && eq !== null && item.instanceId === eq.instanceId;
  let assigned: (ItemInstance | null)[];
  if (inSlot(want[0], e1) || inSlot(want[1], e0)) {
    assigned = [want[1], want[0]];
  } else {
    assigned = want;
  }
  const overrides: GearOverride[] = [];
  for (let i = 0; i < slots.length; i++) {
    const eq = equipped[i] ?? null;
    const target = assigned[i] ?? null;
    if (eq?.instanceId === target?.instanceId) continue;
    if (eq === null && target === null) continue;
    overrides.push({ slot: slots[i], item: target });
  }
  return overrides;
}

/**
 * Enumerate every legal way the character's owned items can fill a slot
 * group. Two identical items are only paired when the character owns two
 * physical copies (distinct instances). Illegal combinations that slip
 * through (e.g. an off-hand next to a two-hander) are rejected later by
 * SimulationCraft itself and dropped.
 */
export function generateGroupOptions(
  parsed: ParsedCharacter,
  pool: GearPool,
): Map<SlotGroupId, GroupOption[]> {
  const result = new Map<SlotGroupId, GroupOption[]>();

  for (const group of SLOT_GROUPS) {
    const { slots, items } = pool[group];
    const options: GroupOption[] = [];
    const seen = new Set<string>();
    const push = (o: GroupOption) => {
      const sig = overrideSignature(o.overrides);
      if (seen.has(sig)) return;
      seen.add(sig);
      options.push(o);
    };

    if (group === "finger" || group === "trinket") {
      const [s1, s2] = slots;
      const equippedPair = [parsed.equipped[s1] ?? null, parsed.equipped[s2] ?? null];
      if (items.length === 0) continue;
      if (items.length === 1) {
        push({
          key: pairKey(items[0], null),
          group,
          overrides: pairOverrides(slots, equippedPair, items[0], null),
          isCurrent: true,
          label: itemLabel(items[0]),
        });
      } else {
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const overrides = pairOverrides(slots, equippedPair, items[i], items[j]);
            push({
              key: pairKey(items[i], items[j]),
              group,
              overrides,
              isCurrent: overrides.length === 0,
              label: `${itemLabel(items[i])} + ${itemLabel(items[j])}`,
            });
          }
        }
      }
    } else if (group === "weapon") {
      const mhItems = items.filter((i) => i.exportSlot === "main_hand");
      const ohItems = items.filter((i) => i.exportSlot === "off_hand");
      const eqMh = parsed.equipped.main_hand ?? null;
      const eqOh = parsed.equipped.off_hand ?? null;
      const ohChoices: (ItemInstance | null)[] =
        ohItems.length > 0 ? [...ohItems, null] : [null];
      for (const mh of mhItems) {
        for (const oh of ohChoices) {
          const overrides: GearOverride[] = [];
          if (mh.instanceId !== eqMh?.instanceId) {
            overrides.push({ slot: "main_hand", item: mh });
          }
          if ((oh?.instanceId ?? null) !== (eqOh?.instanceId ?? null)) {
            overrides.push({ slot: "off_hand", item: oh });
          }
          push({
            key: `${mh.instanceId}+${oh?.instanceId ?? "-"}`,
            group,
            overrides,
            isCurrent: overrides.length === 0,
            label: oh ? `${itemLabel(mh)} + ${itemLabel(oh)}` : itemLabel(mh),
          });
        }
      }
    } else {
      const slot = slots[0];
      const eq = parsed.equipped[slot] ?? null;
      for (const item of items) {
        const isCurrent = item.instanceId === eq?.instanceId;
        push({
          key: item.instanceId,
          group,
          overrides: isCurrent ? [] : [{ slot, item }],
          isCurrent,
          label: itemLabel(item),
        });
      }
    }

    // Make sure the current configuration is always a candidate, even
    // when pairing logic produced it implicitly.
    if (options.length > 0 && !options.some((o) => o.isCurrent)) {
      options.unshift({
        key: `${group}:current`,
        group,
        overrides: [],
        isCurrent: true,
        label: "Currently equipped",
      });
    }
    if (options.length > 0) result.set(group, options);
  }

  return result;
}
