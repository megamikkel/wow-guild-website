import { NAVY, RED, type RoleIconProps } from "./types";

/**
 * DPS — the cordless drill. "Problemet skal væk."
 *
 * Four blocks: motor housing, chuck, grip, battery. The bit is the accent and
 * the only thing pointing anywhere, which is the whole joke — everything else
 * is a rectangle. Kept blocky rather than rendered, so it stays a silhouette
 * at 18px instead of becoming a smudge of detail.
 */
export function DpsIcon({
  size = 24,
  monochrome = false,
  className = "",
  title,
}: RoleIconProps) {
  const body = monochrome ? "currentColor" : NAVY;
  const bit = monochrome ? "currentColor" : RED;

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
      <g fill={body}>
        {/* Motor housing. */}
        <rect x={3.4} y={5.6} width={11.4} height={6.6} rx={1.8} />
        {/* Chuck. */}
        <rect x={14.4} y={7.2} width={2.9} height={3.4} rx={0.7} />
        {/* Grip, raked back the way a drill handle is. */}
        <path d="M5.4 11.8 L10.6 11.8 L9.4 18.6 L4.6 18.6 Z" />
        {/* Battery. */}
        <rect x={3.4} y={18.0} width={6.6} height={2.8} rx={1} />
      </g>
      {/* The bit. */}
      <rect x={17.3} y={8.35} width={5.1} height={1.1} rx={0.55} fill={bit} opacity={monochrome ? 0.55 : 1} />
    </svg>
  );
}
