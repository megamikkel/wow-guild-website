import { classColorVar, specAbbr, WOW_CLASSES } from "@/lib/wow";

/**
 * WoW-flavoured presentation pieces. Everything here is drawn from the game's
 * own conventions — class colours, difficulty tiers, role colours — rather
 * than Blizzard artwork, which is not ours to ship.
 */

/**
 * The full class palette as one band. Instantly reads as World of Warcraft to
 * anyone who plays, and means nothing to anyone else, which is exactly right
 * for a guild site.
 */
export function ClassSpectrum({ className = "" }: { className?: string }) {
  const colours = Object.values(WOW_CLASSES).map((c) => c.colorVar);
  return (
    <div className={`flex h-1.5 w-full overflow-hidden ${className}`} aria-hidden>
      {colours.map((v) => (
        <span key={v} className="flex-1" style={{ background: `var(${v})` }} />
      ))}
    </div>
  );
}

/** Difficulty tiers in the colours the game uses for them. */
const DIFFICULTY: Record<string, { label: string; bg: string; fg: string }> = {
  LFR: { label: "Looking for Raid", bg: "#4a5568", fg: "#ffffff" },
  Normal: { label: "Normal", bg: "#1f7a4d", fg: "#ffffff" },
  Heroic: { label: "Heroic", bg: "#0b4f9e", fg: "#ffffff" },
  Mythic: { label: "Mythic", bg: "#7d1f9c", fg: "#ffffff" },
};

export function DifficultyBadge({
  difficulty,
  short = false,
}: {
  difficulty: string;
  short?: boolean;
}) {
  const d = DIFFICULTY[difficulty] ?? DIFFICULTY.Normal;
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 font-display text-[11px] font-bold tracking-[0.12em] uppercase"
      style={{ background: d.bg, color: d.fg }}
    >
      {short ? difficulty[0] : d.label}
    </span>
  );
}

/** Role colours follow the game's own tank/healer/damage convention. */
export const ROLE_COLOR: Record<string, string> = {
  TANK: "#2b5fa8",
  HEALER: "#1f7a4d",
  DPS: "#a5152c",
};

export const ROLE_DA: Record<string, string> = {
  TANK: "Tank",
  HEALER: "Healer",
  DPS: "DPS",
};

/** An item level, styled the way the game tints high-end gear. */
export function ItemLevel({ value }: { value: number | null }) {
  if (value == null) return <span className="text-ink-faint">—</span>;
  return (
    <span className="font-mono font-bold tabular-nums" style={{ color: "#b8500a" }}>
      {value}
    </span>
  );
}

/**
 * Identifies a spec at a glance: the class colour as the ground, the spec's
 * three-letter shorthand as players write it in Discord.
 *
 * When a Blizzard icon URL is available it is shown instead — resolved through
 * Blizzard's own media API and served from their CDN, which is what that API
 * exists for. Their artwork is never copied into this repository.
 */
export function SpecBadge({
  className: wowClass,
  specName,
  iconUrl,
  size = 28,
}: {
  className: string;
  specName: string;
  iconUrl?: string | null;
  size?: number;
}) {
  const label = `${specName} ${wowClass}`;
  if (iconUrl) {
    // The URL points at Blizzard's CDN and is only known at runtime, so
    // next/image cannot optimise it and the static export has no optimiser.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconUrl}
        alt={label}
        width={size}
        height={size}
        loading="lazy"
        className="shrink-0 rounded-md border border-edge-strong"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      title={label}
      aria-label={label}
      role="img"
      className="inline-flex shrink-0 items-center justify-center rounded-md border font-display font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        letterSpacing: "0.02em",
        background: `var(${classColorVar(wowClass)})`,
        borderColor: "rgba(12,19,56,0.25)",
      }}
    >
      {specAbbr(specName)}
    </span>
  );
}
