import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";
import type { ClassificationResult, Classifier, ClassifierInput } from "./types.js";
import { CLASSIFICATIONS, normalizeResult } from "./types.js";

const ResultSchema = z.object({
  classification: z.enum(CLASSIFICATIONS),
  relevant: z.boolean(),
  confidence: z.number(),
  reason: z.string(),
});

export interface AnthropicClassifierOptions {
  apiKey?: string;
  model?: string;
  /** Tillader test at injicere en falsk klient */
  client?: Anthropic;
}

export class ClassificationError extends Error {}

/**
 * LLM-classifier baseret på Anthropic Messages API med struktureret output.
 * Skift model via RADAR_LLM_MODEL. Kan senere suppleres med andre udbydere
 * ved at implementere samme Classifier-interface.
 */
export class AnthropicClassifier implements Classifier {
  readonly name: string;
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: AnthropicClassifierOptions = {}) {
    this.model = options.model ?? "claude-opus-5";
    this.name = `anthropic:${this.model}`;
    this.client = options.client ?? new Anthropic(options.apiKey ? { apiKey: options.apiKey } : {});
  }

  async classify(input: ClassifierInput): Promise<ClassificationResult> {
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 512,
      output_config: { effort: "low", format: zodOutputFormat(ResultSchema) },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserMessage(input.text, input.groupName) }],
    });

    if (response.stop_reason === "refusal") {
      throw new ClassificationError("Modellen afviste at klassificere opslaget.");
    }
    const parsed = response.parsed_output;
    if (!parsed) {
      throw new ClassificationError("Modellen returnerede ikke gyldig JSON.");
    }
    return normalizeResult(parsed);
  }
}
