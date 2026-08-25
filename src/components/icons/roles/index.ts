export { TankIcon } from "./TankIcon";
export { HealerIcon } from "./HealerIcon";
export { DpsIcon } from "./DpsIcon";
export type { RoleIconProps } from "./types";

import { DpsIcon } from "./DpsIcon";
import { HealerIcon } from "./HealerIcon";
import { TankIcon } from "./TankIcon";
import type { RoleIconProps } from "./types";

export type RoleKey = "TANK" | "HEALER" | "DPS";

/** Accepts "tank" and "TANK" alike; anything unknown falls through to DPS. */
export function roleKey(role: string): RoleKey {
  const upper = role.toUpperCase();
  return upper === "TANK" || upper === "HEALER" ? upper : "DPS";
}

export const ROLE_ICON: Record<RoleKey, (props: RoleIconProps) => React.JSX.Element> = {
  TANK: TankIcon,
  HEALER: HealerIcon,
  DPS: DpsIcon,
};

/** Danish label and the line that goes with it. Kept next to the icons so the
 * joke and the mark never drift apart. */
export const ROLE_MEANING: Record<RoleKey, { label: string; line: string }> = {
  TANK: { label: "Tank", line: "Jeg tager den." },
  HEALER: { label: "Healer", line: "Det kan repareres." },
  DPS: { label: "DPS", line: "Problemet skal væk." },
};
