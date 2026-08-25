import { describe, expect, it } from "vitest";

import { applicationSchema } from "@/domain/application-schema";

const valid = {
  discordName: "frostmage",
  characterName: "Frostmage",
  realm: "Tarren Mill",
  className: "Mage",
  specName: "Frost",
  altSpecs: "Fire",
  warcraftLogsUrl: "https://www.warcraftlogs.com/character/eu/tarren-mill/frostmage",
  raiderIoUrl: "https://raider.io/characters/eu/tarren-mill/Frostmage",
  previousGuild: "Old Guild",
  raidExperience: "7/8M last tier, CE before that.",
  availability: "Wed + Sun",
  expectations: "",
  whyPapi: "Your pace matches mine and the roster looks stable.",
  comment: "",
  website: "",
};

describe("applicationSchema", () => {
  it("accepts a valid application", () => {
    expect(applicationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a spec that does not belong to the class", () => {
    const result = applicationSchema.safeParse({ ...valid, specName: "Restoration" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown classes", () => {
    expect(applicationSchema.safeParse({ ...valid, className: "Necromancer" }).success).toBe(false);
  });

  it("rejects log links pointing at other domains", () => {
    expect(
      applicationSchema.safeParse({ ...valid, warcraftLogsUrl: "https://evil.example/logs" })
        .success,
    ).toBe(false);
  });

  it("rejects a filled honeypot", () => {
    expect(applicationSchema.safeParse({ ...valid, website: "https://spam.example" }).success).toBe(
      false,
    );
  });

  it("requires substance in free-text answers", () => {
    expect(applicationSchema.safeParse({ ...valid, whyPapi: "gold" }).success).toBe(false);
  });
});
