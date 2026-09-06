import type { RadarConfig } from "../config/config.js";
import { log } from "../logger.js";
import { AnthropicClassifier } from "./anthropic.js";
import { RuleBasedClassifier } from "./rules.js";
import type { Classifier } from "./types.js";

export type { Classifier, ClassificationResult, ClassifierInput, Classification } from "./types.js";

/**
 * Vælger classifier ud fra konfigurationen.
 *
 * - "anthropic": LLM via Anthropic API (kræver ANTHROPIC_API_KEY)
 * - "rules":     indbygget regelbaseret dansk classifier (ingen netværk)
 */
export function createClassifier(config: Pick<RadarConfig, "classifier" | "llmModel" | "anthropicApiKey">): Classifier {
  if (config.classifier === "anthropic") {
    if (!config.anthropicApiKey) {
      log.warn("RADAR_CLASSIFIER=anthropic men ANTHROPIC_API_KEY mangler - falder tilbage til regelbaseret classifier");
      return new RuleBasedClassifier();
    }
    log.info("Bruger Anthropic-classifier", { model: config.llmModel });
    return new AnthropicClassifier({ apiKey: config.anthropicApiKey, model: config.llmModel });
  }
  log.info("Bruger regelbaseret classifier (sæt ANTHROPIC_API_KEY for LLM-klassificering)");
  return new RuleBasedClassifier();
}
