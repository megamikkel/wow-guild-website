/**
 * Role-based access control. All checks are enforced server-side — hiding a
 * link in the UI is presentation, not security.
 */

export const ROLES = ["PUBLIC", "MEMBER", "TRIAL", "RAIDER", "OFFICER", "ADMIN"] as const;
export type PapiRole = (typeof ROLES)[number];

const RANK: Record<PapiRole, number> = {
  PUBLIC: 0,
  MEMBER: 1,
  TRIAL: 2,
  RAIDER: 3,
  OFFICER: 4,
  ADMIN: 5,
};

export function isPapiRole(value: unknown): value is PapiRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** True when `actual` grants at least the privileges of `required`. */
export function hasRole(actual: PapiRole | undefined | null, required: PapiRole): boolean {
  if (!actual) return required === "PUBLIC";
  return RANK[actual] >= RANK[required];
}

/**
 * Map the Discord role ids of a guild member to the highest matching PAPI
 * role. `roleMap` is configured via DISCORD_ROLE_MAP ("discordRoleId:PAPIROLE").
 * A verified guild member with no mapped role is at least MEMBER.
 */
export function mapDiscordRolesToPapiRole(
  discordRoleIds: string[],
  roleMap: Record<string, string>,
  { isGuildMember }: { isGuildMember: boolean },
): PapiRole {
  if (!isGuildMember) return "PUBLIC";
  let best: PapiRole = "MEMBER";
  for (const id of discordRoleIds) {
    const mapped = roleMap[id];
    if (isPapiRole(mapped) && RANK[mapped] > RANK[best]) best = mapped;
  }
  return best;
}
