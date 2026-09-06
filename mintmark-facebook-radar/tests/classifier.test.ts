import { describe, expect, it } from "vitest";
import { classifyWithRules, RuleBasedClassifier } from "../src/classifier/rules.js";
import { RELEVANT_CLASSIFICATIONS, normalizeResult } from "../src/classifier/types.js";
import { SYSTEM_PROMPT, buildUserMessage } from "../src/classifier/prompt.js";
import { EXAMPLES } from "./fixtures/examples.js";

describe("evalueringssæt", () => {
  it("indeholder mindst 30 danske eksempler med den krævede fordeling", () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(30);
    const count = (pred: (e: (typeof EXAMPLES)[number]) => boolean) => EXAMPLES.filter(pred).length;
    const has = (e: (typeof EXAMPLES)[number], c: string) =>
      Array.isArray(e.expected) ? e.expected.includes(c as never) : e.expected === c;

    expect(count((e) => e.expected === "SALE_ONLY")).toBeGreaterThanOrEqual(10);
    expect(count((e) => has(e, "PRICE_HELP"))).toBeGreaterThanOrEqual(5);
    expect(count((e) => has(e, "VALUATION_HELP"))).toBeGreaterThanOrEqual(5);
    expect(count((e) => has(e, "MARKET_HELP"))).toBeGreaterThanOrEqual(5);
    expect(count((e) => has(e, "PRODUCT_SEARCH") || e.expected === "OTHER")).toBeGreaterThanOrEqual(5);
  });
});

describe("regelbaseret classifier", () => {
  for (const example of EXAMPLES) {
    const accepted = Array.isArray(example.expected) ? example.expected : [example.expected];
    it(`"${example.text}" -> ${accepted.join(" | ")}`, () => {
      const result = classifyWithRules(example.text);
      expect(accepted).toContain(result.classification);
      expect(result.relevant).toBe(example.relevant);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.reason.length).toBeGreaterThan(0);
    });
  }

  it("skelner mellem 'Pris 900 kr.' og 'Er 900 kr. en fair pris?'", () => {
    const sale = classifyWithRules("Pris 900 kr.");
    const help = classifyWithRules("Er 900 kr. en fair pris?");
    expect(sale.classification).toBe("SALE_ONLY");
    expect(sale.relevant).toBe(false);
    expect(help.classification).toBe("PRICE_HELP");
    expect(help.relevant).toBe(true);
  });

  it("markerer aldrig en ikke-hjælpe-kategori som relevant", () => {
    for (const example of EXAMPLES) {
      const result = classifyWithRules(example.text);
      if (!RELEVANT_CLASSIFICATIONS.has(result.classification)) {
        expect(result.relevant).toBe(false);
      }
    }
  });

  it("markerer ingen salgsannoncer i evalueringssættet som relevante (precision)", () => {
    const sales = EXAMPLES.filter((e) => e.expected === "SALE_ONLY");
    const falsePositives = sales.filter((e) => classifyWithRules(e.text).relevant);
    expect(falsePositives.map((e) => e.text)).toEqual([]);
  });

  it("implementerer Classifier-interfacet", async () => {
    const classifier = new RuleBasedClassifier();
    expect(classifier.name).toBe("rules");
    const result = await classifier.classify({ text: "Hvad ville I sætte denne til?", groupName: "Test" });
    expect(result.classification).toBe("VALUATION_HELP");
  });
});

describe("normalizeResult", () => {
  it("tvinger relevant=false for ikke-hjælpe-kategorier", () => {
    const r = normalizeResult({ classification: "SALE_ONLY", relevant: true, confidence: 0.9, reason: "x" });
    expect(r.relevant).toBe(false);
  });
  it("klemmer confidence ind i [0, 1]", () => {
    expect(normalizeResult({ classification: "PRICE_HELP", confidence: 1.7, reason: "x" }).confidence).toBe(1);
    expect(normalizeResult({ classification: "PRICE_HELP", confidence: -2, reason: "x" }).confidence).toBe(0);
    expect(normalizeResult({ classification: "PRICE_HELP", confidence: Number.NaN, reason: "x" }).confidence).toBe(0);
  });
});

describe("LLM-prompt", () => {
  it("beskriver alle kategorier og de vigtige eksempler", () => {
    for (const c of ["PRICE_HELP", "VALUATION_HELP", "MARKET_HELP", "PRODUCT_SEARCH", "SALE_ONLY", "BUY_ONLY", "TRADE_ONLY", "OTHER"]) {
      expect(SYSTEM_PROMPT).toContain(c);
    }
    expect(SYSTEM_PROMPT).toContain("Er 900 kr. en fair pris?");
    expect(SYSTEM_PROMPT).toContain("Pris 900 kr.");
    expect(SYSTEM_PROMPT).toContain("Kom med bud");
  });
  it("pakker opslagsteksten ind sammen med gruppenavnet", () => {
    const msg = buildUserMessage("Hvad går en 151 ETB for?", "Pokémon DK");
    expect(msg).toContain("Gruppe: Pokémon DK");
    expect(msg).toContain("Hvad går en 151 ETB for?");
  });
});
