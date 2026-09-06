export const CLASSIFICATIONS = [
  "PRICE_HELP",
  "VALUATION_HELP",
  "MARKET_HELP",
  "PRODUCT_SEARCH",
  "SALE_ONLY",
  "BUY_ONLY",
  "TRADE_ONLY",
  "OTHER",
] as const;

export type Classification = (typeof CLASSIFICATIONS)[number];

/** Kategorier der som udgangspunkt kan være relevant=true. */
export const RELEVANT_CLASSIFICATIONS: ReadonlySet<Classification> = new Set<Classification>([
  "PRICE_HELP",
  "VALUATION_HELP",
  "MARKET_HELP",
  "PRODUCT_SEARCH",
]);

export function isClassification(value: unknown): value is Classification {
  return typeof value === "string" && (CLASSIFICATIONS as readonly string[]).includes(value);
}

export interface ClassificationResult {
  classification: Classification;
  relevant: boolean;
  /** 0..1 */
  confidence: number;
  reason: string;
}

export interface ClassifierInput {
  text: string;
  groupName?: string;
}

/**
 * Fælles interface for alle classifiers, så der senere kan skiftes mellem
 * LLM-udbydere (eller den regelbaserede fallback) uden at røre resten.
 */
export interface Classifier {
  readonly name: string;
  classify(input: ClassifierInput): Promise<ClassificationResult>;
}

/**
 * Sikrer at et resultat overholder reglerne: kun de fire hjælpe-kategorier
 * kan være relevante, og confidence ligger i [0, 1].
 */
export function normalizeResult(raw: {
  classification: Classification;
  relevant?: boolean;
  confidence: number;
  reason: string;
}): ClassificationResult {
  const confidence = Math.min(1, Math.max(0, Number.isFinite(raw.confidence) ? raw.confidence : 0));
  const canBeRelevant = RELEVANT_CLASSIFICATIONS.has(raw.classification);
  const relevant = canBeRelevant && (raw.relevant ?? true);
  return {
    classification: raw.classification,
    relevant,
    confidence,
    reason: raw.reason.trim() || "(ingen begrundelse)",
  };
}
