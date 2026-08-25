import { describe, expect, it } from "vitest";

import { hasRole, isPapiRole, mapDiscordRolesToPapiRole } from "@/lib/rbac";

describe("hasRole", () => {
  it("orders roles by privilege", () => {
    expect(hasRole("ADMIN", "OFFICER")).toBe(true);
    expect(hasRole("OFFICER", "ADMIN")).toBe(false);
    expect(hasRole("RAIDER", "MEMBER")).toBe(true);
    expect(hasRole("MEMBER", "RAIDER")).toBe(false);
    expect(hasRole("PUBLIC", "MEMBER")).toBe(false);
  });

  it("treats missing role as PUBLIC", () => {
    expect(hasRole(undefined, "PUBLIC")).toBe(true);
    expect(hasRole(null, "MEMBER")).toBe(false);
  });
});

describe("mapDiscordRolesToPapiRole", () => {
  const roleMap = { "111": "ADMIN", "222": "OFFICER", "333": "RAIDER" };

  it("returns PUBLIC for non-members regardless of roles", () => {
    expect(mapDiscordRolesToPapiRole(["111"], roleMap, { isGuildMember: false })).toBe("PUBLIC");
  });

  it("defaults guild members to MEMBER", () => {
    expect(mapDiscordRolesToPapiRole(["999"], roleMap, { isGuildMember: true })).toBe("MEMBER");
  });

  it("picks the highest mapped role", () => {
    expect(mapDiscordRolesToPapiRole(["333", "222"], roleMap, { isGuildMember: true })).toBe(
      "OFFICER",
    );
  });

  it("ignores invalid role names in the map", () => {
    expect(
      mapDiscordRolesToPapiRole(["444"], { "444": "SUPREME_LEADER" }, { isGuildMember: true }),
    ).toBe("MEMBER");
  });
});

describe("isPapiRole", () => {
  it("accepts only known roles", () => {
    expect(isPapiRole("OFFICER")).toBe(true);
    expect(isPapiRole("banana")).toBe(false);
    expect(isPapiRole(42)).toBe(false);
  });
});
