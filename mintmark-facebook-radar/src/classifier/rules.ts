import type { Classification, ClassificationResult, Classifier, ClassifierInput } from "./types.js";
import { normalizeResult } from "./types.js";

/**
 * Regelbaseret dansk classifier.
 *
 * Bruges som fallback når der ikke er nogen LLM-nøgle, og som deterministisk
 * reference i tests. Reglerne er bevidst konservative (høj precision):
 * et opslag markeres kun som hjælpe-anmodning, når det indeholder en tydelig
 * spørgende formulering om pris, værdi eller marked.
 */

interface Candidate {
  classification: Classification;
  confidence: number;
  reason: string;
}

interface Rule {
  classification: Classification;
  pattern: RegExp;
  confidence: number;
  reason: string;
  /** Kræv at teksten er formuleret som et spørgsmål */
  requiresQuestion?: boolean;
}

const SEG = "[^.!?\\n]{0,70}"; // inden for samme sætning

const HELP_RULES: Rule[] = [
  // ---- PRICE_HELP ----------------------------------------------------------
  {
    classification: "PRICE_HELP",
    pattern: new RegExp(
      `\\b(er|synes|syntes|tænker|mener|tror)\\b${SEG}\\b(fair|rimelig\\w*|okay|ok|fornuftig\\w*|realistisk\\w*|for meget|for højt|for lidt|for lavt|for dyrt|for billigt|for lav|for høj)\\b`,
    ),
    confidence: 0.9,
    reason: "Spørger om en konkret pris er fair/rimelig.",
    requiresQuestion: true,
  },
  {
    classification: "PRICE_HELP",
    pattern: /\b(fair|rimelig|god|ok|okay) pris\?/,
    confidence: 0.9,
    reason: "Spørger direkte om prisen er fair.",
  },
  {
    classification: "PRICE_HELP",
    pattern: /\bhvad (bør|skal|kan|ville|vil) (jeg|man|vi|i) (tage|forlange|betale|give|sætte (den|dem|det) til)\b/,
    confidence: 0.88,
    reason: "Spørger hvad personen bør tage/betale.",
  },
  {
    classification: "PRICE_HELP",
    pattern: /\bhvad er (en )?(fair|rimelig|god|realistisk|fornuftig) pris\b/,
    confidence: 0.88,
    reason: "Spørger hvad en fair pris ville være.",
  },
  {
    classification: "PRICE_HELP",
    pattern: new RegExp(`\\b(fået|blevet) (budt|tilbudt)\\b${SEG}\\b(men|er det|synes|for lidt|for meget|ved ikke|aner ikke|\\?)`),
    confidence: 0.86,
    reason: "Har fået et bud og er i tvivl om det er rimeligt.",
  },
  {
    classification: "PRICE_HELP",
    pattern: /\b(skal|bør) (jeg|man) (sige ja|slå til|tage imod|acceptere)\b/,
    confidence: 0.85,
    reason: "Spørger om et konkret bud/pris bør accepteres.",
    requiresQuestion: true,
  },
  {
    classification: "PRICE_HELP",
    pattern: /\b(betaler|giver|betalte|gav) (jeg|man) for (meget|lidt)\b/,
    confidence: 0.85,
    reason: "Spørger om personen betaler for meget/lidt.",
  },

  // ---- VALUATION_HELP ------------------------------------------------------
  {
    classification: "VALUATION_HELP",
    pattern: new RegExp(`\\bhvad (er|ville|vil|tror|mener|synes|syntes|kan)\\b${SEG}\\bværd\\b`),
    confidence: 0.92,
    reason: "Spørger direkte hvad noget er værd.",
  },
  {
    classification: "VALUATION_HELP",
    pattern: /\b(mere|mindre) værd\b/,
    confidence: 0.85,
    reason: "I tvivl om noget er mere/mindre værd end tilbudt.",
  },
  {
    classification: "VALUATION_HELP",
    pattern: /\bhvad (ville|vil|ville i|vil i) (i )?(sætte|prissætte|vurdere|værdisætte)\b/,
    confidence: 0.9,
    reason: "Beder andre sætte en værdi på produktet.",
  },
  {
    classification: "VALUATION_HELP",
    pattern: /\b(vurder(e|ing|et)|værdiansæt\w*|værdisæt\w*|prissæt\w*)\b/,
    confidence: 0.85,
    reason: "Beder om en vurdering/værdiansættelse.",
    requiresQuestion: true,
  },
  {
    classification: "VALUATION_HELP",
    pattern: new RegExp(`\\b(aner ikke|ved ikke|ingen (anelse|ide|idé) om)\\b${SEG}\\b(værd|værdi\\w*)`),
    confidence: 0.85,
    reason: "Ved ikke hvad produktet er værd.",
  },
  {
    classification: "VALUATION_HELP",
    pattern: new RegExp(`\\b(hjælp|hjælpe)\\b${SEG}\\b(værdi\\w*|vurder\\w*)`),
    confidence: 0.85,
    reason: "Beder om hjælp til værdien.",
  },
  {
    classification: "VALUATION_HELP",
    pattern: new RegExp(`\\bhvad (kan|ville|vil) ${SEG}\\b(indbringe|give i salg)\\b`),
    confidence: 0.85,
    reason: "Spørger hvad et salg kan indbringe.",
  },

  // ---- MARKET_HELP ---------------------------------------------------------
  {
    classification: "MARKET_HELP",
    pattern: new RegExp(`\\bhvad (går|ryger|handles|sælges|ligger) ${SEG}\\b(for|til|i pris|på markedet)\\b`),
    confidence: 0.9,
    reason: "Spørger hvad produktet går for på markedet.",
  },
  {
    classification: "MARKET_HELP",
    pattern: new RegExp(`\\bhvad (sælger|går|tager) (i|folk|man|andre) ${SEG}\\b(for|til)\\b`),
    confidence: 0.85,
    reason: "Spørger hvad andre sælger produktet for.",
  },
  {
    classification: "MARKET_HELP",
    pattern: /\b(markedspris\w*|markedsværdi\w*|prisniveau\w*|prisleje\w*|gængse? pris\w*|normalpris\w*|dagspris\w*)\b/,
    confidence: 0.85,
    reason: "Spørger om markedspris/prisniveau.",
    requiresQuestion: true,
  },
  {
    classification: "MARKET_HELP",
    pattern: /\bhvad (ligger|er) (prisen|priserne|prisniveauet|prislejet|værdien)\b/,
    confidence: 0.88,
    reason: "Spørger hvad prisen ligger på.",
  },
  {
    classification: "MARKET_HELP",
    pattern: new RegExp(`\\bhvad (plejer|plejede) ${SEG}\\b(at gå|at koste|at sælge|at ligge|at ryge)\\b`),
    confidence: 0.85,
    reason: "Spørger hvad produktet plejer at koste.",
  },
  {
    classification: "MARKET_HELP",
    pattern: new RegExp(`\\bhvad koster ${SEG}\\b(normalt|typisk|i dag|lige nu|nu om dage|for tiden|i øjeblikket|på markedet|cirka|ca|sådan cirka|omkring)\\b`),
    confidence: 0.85,
    reason: "Spørger hvad produktet typisk koster.",
  },
  {
    classification: "MARKET_HELP",
    pattern: new RegExp(`\\b(nogen|nogle) der (ved|kender|har styr på) ${SEG}\\b(pris\\w*|værdi\\w*|hvad .{0,30}(går|koster))`),
    confidence: 0.8,
    reason: "Spørger om nogen kender prisniveauet.",
  },

  // ---- PRODUCT_SEARCH ------------------------------------------------------
  {
    classification: "PRODUCT_SEARCH",
    pattern: new RegExp(`\\bhvor (kan|finder|får|køber) (man|jeg|vi|i) ${SEG}\\b(billigst\\w*|billigere|bedst\\w* pris|god pris|tilbud|på lager|fat i|købe|finde)\\b`),
    confidence: 0.88,
    reason: "Leder efter et produkt og spørger hvor det kan købes/billigst.",
  },
  {
    classification: "PRODUCT_SEARCH",
    pattern: new RegExp(`\\b(hvilke|hvilken|hvor er der) (butik\\w*|steder|sider|shops?)\\b${SEG}\\b(har|sælger|billigst\\w*|på lager|tilbud|fører)\\b`),
    confidence: 0.85,
    reason: "Spørger hvilke butikker der har produktet.",
  },
  {
    classification: "PRODUCT_SEARCH",
    pattern: new RegExp(`\\b(nogen|nogle) der ved hvor ${SEG}\\b(købe|finde|få fat|fås|billigst\\w*|på lager)`),
    confidence: 0.85,
    reason: "Spørger om nogen ved hvor produktet kan købes.",
  },
];

const BUY_INTENT =
  /\b(søger|leder efter|købes|ønskes købt|ønsker at købe|vil gerne købe|på jagt efter|jagter|(er der )?nogen der (sælger|har (en|et|nogle)|ligger inde med)|har nogen (en|et|nogle))\b/;
/** Sætninger der indeholder "sælger" men er købsintention, fjernes før salgs-tjek. */
const BUY_PHRASES_WITH_SALE_WORDS = /\b(nogen der sælger|nogen som sælger|hvem sælger|er der nogen der sælger)\b/g;
const STRONG_SALE_MARKERS = /\b(sælges|sælger|til salg|ts:|ts)\b/;
const PRODUCT_SEARCH_INFO = /\b(billigst\w*|billigere|bedste pris|hvor (kan|finder|får) (man|jeg)|hvilke butikker|hvilken butik|på lager|lagerstatus|hvor (sælger|har) de|tilbud)\b/;

const TRADE_MARKERS = /\b(byttes|bytte\w*|bytter|trade\w*|trades?)\b/;
const SALE_MARKERS =
  /\b(sælges|sælger|til salg|ts|kom med (et )?bud|bud modtages|byd|mp|mindstepris|fast pris|fastpris|pris:|prisen er|priser (i|på)|afhentes|sendes|kan sendes|mobilepay|pp|hvad (vil|ville|giver) i give|hvad giver i|bud fra|højeste bud|stk|kr|dkk)\b|,-|\bpris \d/;
const PRICE_DIGITS = /\d[\d.]*\s*(kr|dkk|,-)/;

const QUESTION_HINT =
  /\?|\b(hvad|hvor|hvilke|hvilken|hvordan|hvornår|hvem|nogen der|nogle der|er der nogen|kan nogen|synes i|syntes i|tænker i|mener i|tror i)\b/;

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/kr\./g, "kr")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function isQuestionLike(normalized: string): boolean {
  return QUESTION_HINT.test(normalized);
}

export function classifyWithRules(text: string): ClassificationResult {
  const t = normalizeText(text);
  const question = isQuestionLike(t);

  const candidates: Candidate[] = [];
  for (const rule of HELP_RULES) {
    if (rule.requiresQuestion && !question) continue;
    if (rule.pattern.test(t)) {
      candidates.push({ classification: rule.classification, confidence: rule.confidence, reason: rule.reason });
    }
  }

  const hasBuyIntent = BUY_INTENT.test(t);
  if (question && hasBuyIntent && PRODUCT_SEARCH_INFO.test(t)) {
    candidates.push({
      classification: "PRODUCT_SEARCH",
      confidence: 0.78,
      reason: "Leder efter et produkt og efterspørger pris-/butiksinformation.",
    });
  }

  if (candidates.length > 0) {
    // Stabil sortering: højeste confidence først, ved lighed rækkefølgen i reglerne.
    candidates.sort((a, b) => b.confidence - a.confidence);
    const best = candidates[0]!;
    return normalizeResult({ ...best, relevant: true });
  }

  const saleText = t.replace(BUY_PHRASES_WITH_SALE_WORDS, " ");
  const hasTrade = TRADE_MARKERS.test(t);
  const hasSale = SALE_MARKERS.test(saleText);
  const hasStrongSale = STRONG_SALE_MARKERS.test(saleText);
  const hasPrice = PRICE_DIGITS.test(t);

  if (hasTrade && !hasStrongSale) {
    return normalizeResult({ classification: "TRADE_ONLY", confidence: 0.85, reason: "Bytteannonce uden efterspørgsel på hjælp." });
  }
  if (hasBuyIntent && !hasStrongSale) {
    return normalizeResult({ classification: "BUY_ONLY", confidence: 0.8, reason: "Almindelig købsannonce uden efterspørgsel på prisinformation." });
  }
  if (hasSale || hasPrice) {
    return normalizeResult({
      classification: "SALE_ONLY",
      confidence: hasPrice ? 0.9 : 0.75,
      reason: "Almindelig salgsannonce uden efterspørgsel på pris- eller markedshjælp.",
    });
  }
  if (hasBuyIntent) {
    return normalizeResult({ classification: "BUY_ONLY", confidence: 0.7, reason: "Købsannonce uden efterspørgsel på prisinformation." });
  }
  return normalizeResult({ classification: "OTHER", confidence: 0.6, reason: "Ingen tydelig annonce eller hjælpe-anmodning fundet." });
}

export class RuleBasedClassifier implements Classifier {
  readonly name = "rules";

  async classify(input: ClassifierInput): Promise<ClassificationResult> {
    return classifyWithRules(input.text);
  }
}
