import { describe, expect, it } from "vitest";

import { canTransition } from "@/domain/recruitment";

describe("recruitment pipeline transitions", () => {
  it("follows the happy path NEW → REVIEW → INTERVIEW → TRIAL → ACCEPTED", () => {
    expect(canTransition("NEW", "REVIEW")).toBe(true);
    expect(canTransition("REVIEW", "INTERVIEW")).toBe(true);
    expect(canTransition("INTERVIEW", "TRIAL")).toBe(true);
    expect(canTransition("TRIAL", "ACCEPTED")).toBe(true);
  });

  it("allows declining at any active stage", () => {
    for (const from of ["NEW", "REVIEW", "INTERVIEW", "TRIAL"]) {
      expect(canTransition(from, "DECLINED")).toBe(true);
    }
  });

  it("blocks skipping stages", () => {
    expect(canTransition("NEW", "TRIAL")).toBe(false);
    expect(canTransition("NEW", "ACCEPTED")).toBe(false);
    expect(canTransition("REVIEW", "ACCEPTED")).toBe(false);
  });

  it("keeps ACCEPTED terminal but lets DECLINED be reopened", () => {
    expect(canTransition("ACCEPTED", "DECLINED")).toBe(false);
    expect(canTransition("DECLINED", "REVIEW")).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(canTransition("LIMBO", "REVIEW")).toBe(false);
  });
});
