import { describe, expect, it } from "vitest";

import {
  normalizeEvent,
  normalizeSignupStatus,
} from "@/integrations/raid-helper/adapter";
import { normalizeCharacterProfile } from "@/integrations/raider-io/adapter";
import { normalizeBossProgress, type WclReport } from "@/integrations/warcraft-logs/adapter";

describe("raid-helper normalization", () => {
  it("maps pseudo-classes to signup statuses", () => {
    expect(normalizeSignupStatus("Absence")).toBe("ABSENT");
    expect(normalizeSignupStatus("Bench")).toBe("BENCH");
    expect(normalizeSignupStatus("Tentative")).toBe("TENTATIVE");
    expect(normalizeSignupStatus("Late")).toBe("TENTATIVE");
    expect(normalizeSignupStatus("Mage")).toBe("CONFIRMED");
    expect(normalizeSignupStatus(null)).toBe("CONFIRMED");
  });

  it("normalizes an event with unix timestamps and mixed signups", () => {
    const event = normalizeEvent({
      id: "12345",
      title: "Mythic night",
      description: null,
      startTime: 1_750_000_000,
      endTime: 1_750_010_800,
      closingTime: 1_749_999_000,
      signUps: [
        { id: "1", name: "Frostmage", className: "Mage", specName: "Frost", entryTime: 1_749_900_000 },
        { id: "2", name: "Vexweaver", className: "Absence", specName: null, entryTime: null },
      ],
    });
    expect(event.raidHelperId).toBe("12345");
    expect(event.startTime.getTime()).toBe(1_750_000_000_000);
    expect(event.signups[0].status).toBe("CONFIRMED");
    expect(event.signups[0].className).toBe("Mage");
    expect(event.signups[1].status).toBe("ABSENT");
    expect(event.signups[1].className).toBeNull();
  });
});

describe("raider.io normalization", () => {
  it("extracts ilvl, score, raid summary and runs", () => {
    const stats = normalizeCharacterProfile({
      name: "Frostmage",
      class: "Mage",
      active_spec_name: "Frost",
      gear: { item_level_equipped: 712 },
      mythic_plus_scores_by_season: [{ scores: { all: 3142 } }],
      raid_progression: { "eternal-citadel": { summary: "6/8 M" } },
      mythic_plus_recent_runs: [
        {
          dungeon: "Ara-Kara",
          mythic_level: 17,
          num_keystone_upgrades: 1,
          score: 172,
          completed_at: "2026-08-20T20:00:00.000Z",
          keystone_run_id: 991,
        },
        {
          dungeon: "The Dawnbreaker",
          mythic_level: 16,
          num_keystone_upgrades: 0,
          score: null,
          completed_at: "2026-08-19T20:00:00.000Z",
          keystone_run_id: null,
        },
      ],
      last_crawled_at: "2026-08-22T10:00:00.000Z",
    });
    expect(stats.itemLevel).toBe(712);
    expect(stats.mythicPlusScore).toBe(3142);
    expect(stats.raidProgressSummary).toBe("6/8 M");
    expect(stats.recentRuns).toHaveLength(2);
    expect(stats.recentRuns[0].timed).toBe(true);
    expect(stats.recentRuns[1].timed).toBe(false);
    expect(stats.recentRuns[1].externalId).toBeNull();
  });
});

describe("warcraft logs boss progress", () => {
  const reports: WclReport[] = [
    {
      code: "a",
      title: "Week 1",
      startTime: 1_000,
      endTime: 2_000,
      fights: [
        { encounterID: 7, name: "The Void Emperor", difficulty: 5, kill: false, bossPercentage: 38 },
        { encounterID: 7, name: "The Void Emperor", difficulty: 5, kill: false, bossPercentage: 52 },
        { encounterID: 6, name: "Nerezza, Void Weaver", difficulty: 5, kill: true, bossPercentage: 0 },
        { encounterID: 6, name: "Nerezza, Void Weaver", difficulty: 4, kill: true, bossPercentage: 0 },
      ],
    },
    {
      code: "b",
      title: "Week 2",
      startTime: 3_000,
      endTime: 4_000,
      fights: [
        { encounterID: 7, name: "The Void Emperor", difficulty: 5, kill: false, bossPercentage: 11.7 },
      ],
    },
  ];

  it("tracks best pull, pull count and kills per mythic boss", () => {
    const progress = normalizeBossProgress(reports);
    const emperor = progress.get("The Void Emperor")!;
    expect(emperor.pulls).toBe(3);
    expect(emperor.bestPct).toBe(11.7);
    expect(emperor.killed).toBe(false);

    const nerezza = progress.get("Nerezza, Void Weaver")!;
    expect(nerezza.killed).toBe(true);
    expect(nerezza.bestPct).toBe(0);
    // heroic kill (difficulty 4) must not count
    expect(nerezza.pulls).toBe(1);
  });
});
