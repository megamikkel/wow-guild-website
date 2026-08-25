import { BLUE, NAVY, PAPER, type RoleIconProps } from "./types";

/**
 * HEALER — the plaster. "Det kan repareres."
 *
 * Was a roll of duct tape, which at this size read as a target or a shield:
 * concentric rings are exactly what every other guild site puts in this
 * column. A plaster has a silhouette nothing else in the set can be mistaken
 * for — a long bar laid at an angle, pinched by a pad in the middle.
 *
 * The angle is what sells it. Laid flat it is a battery; tilted it is
 * unmistakably stuck on something.
 */
export function HealerIcon({
  size = 24,
  monochrome = false,
  className = "",
  title,
}: RoleIconProps) {
  const body = monochrome ? "currentColor" : NAVY;
  const pad = monochrome ? "currentColor" : BLUE;
  const fill = monochrome ? "none" : PAPER;

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
      <g transform="rotate(-34 12 12)">
        {/* The strip. */}
        <rect
          x={2.4}
          y={8.9}
          width={19.2}
          height={6.2}
          rx={3.1}
          fill={fill}
          stroke={body}
          strokeWidth={1.7}
        />
        {/* The pad — the accent, and the thing that stops it being a battery. */}
        <rect
          x={8.9}
          y={9.6}
          width={6.2}
          height={4.8}
          rx={0.8}
          fill={pad}
          opacity={monochrome ? 0.5 : 1}
        />
        {/* Perforations. They soften rather than read at 18px, which is fine —
            they are texture, not information. */}
        {monochrome ? null : (
          <g fill={fill}>
            <circle cx={10.6} cy={11.0} r={0.62} />
            <circle cx={13.4} cy={11.0} r={0.62} />
            <circle cx={10.6} cy={13.0} r={0.62} />
            <circle cx={13.4} cy={13.0} r={0.62} />
          </g>
        )}
      </g>
    </svg>
  );
}
