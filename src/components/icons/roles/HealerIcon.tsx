import { BLUE, NAVY, PAPER, type RoleIconProps } from "./types";

/**
 * HEALER — the roll of duct tape. "Det kan repareres."
 *
 * A ring on its own is a donut, a record, a washer. The peeled strip is what
 * makes it tape, so the strip gets the accent and enough length to survive at
 * 18px. The torn end is two notches, not a fine zigzag, for the same reason.
 */
export function HealerIcon({
  size = 24,
  monochrome = false,
  className = "",
  title,
}: RoleIconProps) {
  const roll = monochrome ? "currentColor" : NAVY;
  const strip = monochrome ? "currentColor" : BLUE;
  const hole = monochrome ? "none" : PAPER;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {/* Peeled strip, torn at the far end. Drawn first so the roll laps it. */}
      <path
        d="M14.6 6.6 L20.1 3.0 L21.0 4.6 L22.3 4.9 L22.9 6.6 L17.4 10.2 Z"
        fill={monochrome ? "none" : strip}
        stroke={strip}
        strokeWidth={monochrome ? 1.5 : 0.8}
        strokeLinejoin="round"
        opacity={monochrome ? 0.55 : 1}
      />
      {/* The roll. */}
      <circle
        cx={10.4}
        cy={13.4}
        r={6.4}
        fill="none"
        stroke={roll}
        strokeWidth={3.4}
      />
      {/* Core. */}
      <circle cx={10.4} cy={13.4} r={2.5} fill={hole} stroke={roll} strokeWidth={1.2} />
    </svg>
  );
}
