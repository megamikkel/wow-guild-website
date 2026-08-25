/** WoW class metadata: canonical names, specs, roles and color tokens. */

export const WOW_CLASSES: Record<
  string,
  { specs: Array<{ name: string; role: "TANK" | "HEALER" | "DPS" }>; colorVar: string }
> = {
  "Death Knight": {
    colorVar: "--color-class-deathknight",
    specs: [
      { name: "Blood", role: "TANK" },
      { name: "Frost", role: "DPS" },
      { name: "Unholy", role: "DPS" },
    ],
  },
  "Demon Hunter": {
    colorVar: "--color-class-demonhunter",
    specs: [
      { name: "Havoc", role: "DPS" },
      { name: "Vengeance", role: "TANK" },
    ],
  },
  Druid: {
    colorVar: "--color-class-druid",
    specs: [
      { name: "Balance", role: "DPS" },
      { name: "Feral", role: "DPS" },
      { name: "Guardian", role: "TANK" },
      { name: "Restoration", role: "HEALER" },
    ],
  },
  Evoker: {
    colorVar: "--color-class-evoker",
    specs: [
      { name: "Devastation", role: "DPS" },
      { name: "Preservation", role: "HEALER" },
      { name: "Augmentation", role: "DPS" },
    ],
  },
  Hunter: {
    colorVar: "--color-class-hunter",
    specs: [
      { name: "Beast Mastery", role: "DPS" },
      { name: "Marksmanship", role: "DPS" },
      { name: "Survival", role: "DPS" },
    ],
  },
  Mage: {
    colorVar: "--color-class-mage",
    specs: [
      { name: "Arcane", role: "DPS" },
      { name: "Fire", role: "DPS" },
      { name: "Frost", role: "DPS" },
    ],
  },
  Monk: {
    colorVar: "--color-class-monk",
    specs: [
      { name: "Brewmaster", role: "TANK" },
      { name: "Mistweaver", role: "HEALER" },
      { name: "Windwalker", role: "DPS" },
    ],
  },
  Paladin: {
    colorVar: "--color-class-paladin",
    specs: [
      { name: "Holy", role: "HEALER" },
      { name: "Protection", role: "TANK" },
      { name: "Retribution", role: "DPS" },
    ],
  },
  Priest: {
    colorVar: "--color-class-priest",
    specs: [
      { name: "Discipline", role: "HEALER" },
      { name: "Holy", role: "HEALER" },
      { name: "Shadow", role: "DPS" },
    ],
  },
  Rogue: {
    colorVar: "--color-class-rogue",
    specs: [
      { name: "Assassination", role: "DPS" },
      { name: "Outlaw", role: "DPS" },
      { name: "Subtlety", role: "DPS" },
    ],
  },
  Shaman: {
    colorVar: "--color-class-shaman",
    specs: [
      { name: "Elemental", role: "DPS" },
      { name: "Enhancement", role: "DPS" },
      { name: "Restoration", role: "HEALER" },
    ],
  },
  Warlock: {
    colorVar: "--color-class-warlock",
    specs: [
      { name: "Affliction", role: "DPS" },
      { name: "Demonology", role: "DPS" },
      { name: "Destruction", role: "DPS" },
    ],
  },
  Warrior: {
    colorVar: "--color-class-warrior",
    specs: [
      { name: "Arms", role: "DPS" },
      { name: "Fury", role: "DPS" },
      { name: "Protection", role: "TANK" },
    ],
  },
};

export const CLASS_NAMES = Object.keys(WOW_CLASSES);

/**
 * Three-letter spec abbreviations, as players write them in Discord.
 * Used by the spec badge when no Blizzard icon URL is available.
 */
export const SPEC_ABBR: Record<string, string> = {
  Blood: "BLD", Frost: "FRO", Unholy: "UNH",
  Havoc: "HAV", Vengeance: "VEN",
  Balance: "BAL", Feral: "FER", Guardian: "GRD", Restoration: "RES",
  Devastation: "DEV", Preservation: "PRE", Augmentation: "AUG",
  "Beast Mastery": "BM", Marksmanship: "MM", Survival: "SV",
  Arcane: "ARC", Fire: "FIR",
  Brewmaster: "BRM", Mistweaver: "MW", Windwalker: "WW",
  Holy: "HOL", Protection: "PRT", Retribution: "RET",
  Discipline: "DIS", Shadow: "SHA",
  Assassination: "ASS", Outlaw: "OUT", Subtlety: "SUB",
  Elemental: "ELE", Enhancement: "ENH",
  Affliction: "AFF", Demonology: "DEM", Destruction: "DST",
  Arms: "ARM", Fury: "FUR",
};

export function specAbbr(specName: string): string {
  return SPEC_ABBR[specName] ?? specName.slice(0, 3).toUpperCase();
}

/**
 * Blizzard's own icon slug for each spec, keyed by class then spec — "Frost",
 * "Holy", "Protection" and "Restoration" all belong to more than one class, so
 * the spec name alone is not enough.
 *
 * These build a URL on Blizzard's CDN. No artwork is stored in this repository;
 * the site links to the files Blizzard already serves, which is the same thing
 * their media API returns and the reason the icons stay current.
 */
export const SPEC_ICON: Record<string, Record<string, string>> = {
  "Death Knight": {
    Blood: "spell_deathknight_bloodpresence",
    Frost: "spell_deathknight_frostpresence",
    Unholy: "spell_deathknight_unholypresence",
  },
  "Demon Hunter": {
    Havoc: "ability_demonhunter_specdps",
    Vengeance: "ability_demonhunter_spectank",
  },
  Druid: {
    Balance: "spell_nature_starfall",
    Feral: "ability_druid_catform",
    Guardian: "ability_racial_bearform",
    Restoration: "spell_nature_healingtouch",
  },
  Evoker: {
    Devastation: "classicon_evoker_devastation",
    Preservation: "classicon_evoker_preservation",
    Augmentation: "classicon_evoker_augmentation",
  },
  Hunter: {
    "Beast Mastery": "ability_hunter_bestialdiscipline",
    Marksmanship: "ability_hunter_focusedaim",
    Survival: "ability_hunter_camouflage",
  },
  Mage: {
    Arcane: "spell_holy_magicalsentry",
    Fire: "spell_fire_firebolt02",
    Frost: "spell_frost_frostbolt02",
  },
  Monk: {
    Brewmaster: "spell_monk_brewmaster_spec",
    Mistweaver: "spell_monk_mistweaver_spec",
    Windwalker: "spell_monk_windwalker_spec",
  },
  Paladin: {
    Holy: "spell_holy_holybolt",
    Protection: "ability_paladin_shieldofthetemplar",
    Retribution: "spell_holy_auraoflight",
  },
  Priest: {
    Discipline: "spell_holy_powerwordshield",
    Holy: "spell_holy_guardianspirit",
    Shadow: "spell_shadow_shadowwordpain",
  },
  Rogue: {
    Assassination: "ability_rogue_eviscerate",
    Outlaw: "ability_rogue_waylay",
    Subtlety: "ability_stealth",
  },
  Shaman: {
    Elemental: "spell_nature_lightning",
    Enhancement: "spell_shaman_improvedstormstrike",
    Restoration: "spell_nature_magicimmunity",
  },
  Warlock: {
    Affliction: "spell_shadow_deathcoil",
    Demonology: "spell_shadow_metamorphosis",
    Destruction: "spell_shadow_rainoffire",
  },
  Warrior: {
    Arms: "ability_warrior_savageblow",
    Fury: "ability_warrior_innerrage",
    Protection: "ability_warrior_defensivestance",
  },
};

/**
 * URL for a spec's icon on Blizzard's render CDN, or null for a spec we have
 * no slug for. The badge falls back to the class-coloured tile in that case,
 * and also if the request fails, so a wrong slug degrades rather than breaks.
 */
export function specIconUrl(className: string, specName: string): string | null {
  const slug = SPEC_ICON[className]?.[specName];
  return slug ? `https://render.worldofwarcraft.com/eu/icons/56/${slug}.jpg` : null;
}

export function classColorVar(className: string): string {
  return WOW_CLASSES[className]?.colorVar ?? "--color-ink";
}

export function classColorStyle(className: string) {
  return { color: `var(${classColorVar(className)})` };
}

export function specRole(className: string, specName: string): "TANK" | "HEALER" | "DPS" {
  return (
    WOW_CLASSES[className]?.specs.find((s) => s.name === specName)?.role ?? "DPS"
  );
}
