import { NAVY, PAPER, RED, type RoleIconProps } from "./types";

/**
 * TANK — the ribbed undershirt. "Jeg tager den."
 *
 * Deliberately the garment and not the man: two straps, a scooped neck, deep
 * armholes and a straight body. The ribbing is three lines rather than many,
 * because at 18px anything denser turns into grey mush. The neck trim is the
 * red accent — a real detail on a real vest, so it earns its colour.
 */
export function TankIcon({
  size = 24,
  monochrome = false,
  className = "",
  title,
}: RoleIconProps) {
  const body = monochrome ? "currentColor" : NAVY;
  const fill = monochrome ? "none" : PAPER;
  const trim = monochrome ? "currentColor" : RED;

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
      {/* Garment outline: straps, neck scoop, armholes, straight body. */}
      <path
        d="M7.6 3.2 L9.5 3.2 C9.5 5.7 14.5 5.7 14.5 3.2 L16.4 3.2
           C16.4 6.4 18.3 8.4 18.3 10.8 L18.3 20.8 L5.7 20.8 L5.7 10.8
           C5.7 8.4 7.6 6.4 7.6 3.2 Z"
        fill={fill}
        stroke={body}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      {/* Neck trim — the accent. */}
      <path
        d="M9.5 3.4 C9.5 5.9 14.5 5.9 14.5 3.4"
        fill="none"
        stroke={trim}
        strokeWidth={1.7}
        strokeLinecap="round"
        opacity={monochrome ? 0.55 : 1}
      />
      {/* Ribbing. */}
      <g stroke={body} strokeWidth={1.1} strokeLinecap="round" opacity={0.4}>
        <path d="M9.6 11.6 L9.6 18.4" />
        <path d="M12 11.2 L12 18.4" />
        <path d="M14.4 11.6 L14.4 18.4" />
      </g>
    </svg>
  );
}
