import fs from "node:fs";
import { loadConfig } from "./config/config.js";
import { configureLogger } from "./logger.js";
import { createClassifier } from "./classifier/classifier.js";

/**
 * Prøv classifieren af på tekster uden at røre Facebook eller databasen.
 *
 *   npm run try -- "Er 900 kr. en fair pris?"
 *   npm run try -- --file opslag.txt      (ét opslag pr. linje, tomme linjer ignoreres;
 *                                          brug "---" på egen linje til flerlinjede opslag)
 *   echo "Hvad er den værd?" | npm run try
 */
async function readInput(): Promise<string[]> {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf("--file");
  if (fileIndex !== -1) {
    const file = args[fileIndex + 1];
    if (!file) throw new Error("--file kræver en filsti");
    return splitPosts(fs.readFileSync(file, "utf8"));
  }
  const inline = args.filter((a) => !a.startsWith("--"));
  if (inline.length > 0) return inline;

  if (process.stdin.isTTY) return [];
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return splitPosts(Buffer.concat(chunks).toString("utf8"));
}

function splitPosts(raw: string): string[] {
  const parts = raw.includes("\n---") ? raw.split(/^---+$/m) : raw.split("\n");
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

async function main(): Promise<void> {
  const config = loadConfig();
  configureLogger({ level: "warn", dir: null });

  const texts = await readInput();
  if (texts.length === 0) {
    console.log('Brug: npm run try -- "opslagstekst"   eller   npm run try -- --file opslag.txt');
    process.exitCode = 1;
    return;
  }

  const classifier = createClassifier(config);
  console.log(`Classifier: ${classifier.name}\n`);

  let relevant = 0;
  for (const text of texts) {
    try {
      const result = await classifier.classify({ text });
      if (result.relevant) relevant++;
      const mark = result.relevant ? "★ RELEVANT" : "  ";
      const pct = `${Math.round(result.confidence * 100)}%`.padStart(4);
      console.log(`${mark} ${result.classification.padEnd(15)} ${pct}  ${text.replace(/\s+/g, " ").slice(0, 70)}`);
      console.log(`        ${result.reason}\n`);
    } catch (err) {
      console.log(`  FEJL                      ${text.slice(0, 70)}`);
      console.log(`        ${(err as Error).message}\n`);
    }
  }
  console.log(`${relevant} af ${texts.length} opslag markeret relevante.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
