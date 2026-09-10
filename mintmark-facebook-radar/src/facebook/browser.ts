import fs from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { log } from "../logger.js";

export interface BrowserOptions {
  profileDir: string;
  headless: boolean;
  /** Valgfri sti til Chromium-binær. Udelades normalt. */
  executablePath?: string;
  /**
   * Start en installeret browser ("chrome", "msedge", ...) i stedet for
   * Playwrights egen Chromium. Facebook viser ofte færre CAPTCHA'er for en
   * almindelig installeret browser. Dette er et valg af browser - ikke
   * maskering, fingerprint-manipulation eller anden evasion.
   */
  channel?: string;
}

/**
 * Tynd abstraktion over Playwright, så resten af koden ikke kender til
 * launch-detaljer og så den kan erstattes i tests.
 */
export interface BrowserSession {
  readonly context: BrowserContext;
  newPage(): Promise<Page>;
  close(): Promise<void>;
}

/**
 * Starter Chromium med en dedikeret, persistent brugerprofil. Profilen
 * indeholder Facebook-loginsessionen og ligger i .gitignore.
 *
 * Der bruges ingen stealth-, fingerprint- eller evasion-teknikker.
 */
export async function launchBrowser(options: BrowserOptions): Promise<BrowserSession> {
  fs.mkdirSync(options.profileDir, { recursive: true });
  log.info("Starter browser", { headless: options.headless, channel: options.channel ?? "playwright-chromium" });

  const context = await chromium.launchPersistentContext(options.profileDir, {
    headless: options.headless,
    viewport: { width: 1280, height: 900 },
    locale: "da-DK",
    timezoneId: "Europe/Copenhagen",
    ...(options.executablePath ? { executablePath: options.executablePath } : {}),
    ...(options.channel ? { channel: options.channel } : {}),
  });

  // Kode der køres i siden via page.evaluate kan indeholde esbuild's
  // __name-hjælper når projektet køres med tsx. Denne shim gør den harmløs.
  await context.addInitScript(() => {
    const g = globalThis as unknown as { __name?: (fn: unknown) => unknown };
    if (typeof g.__name !== "function") g.__name = (fn) => fn;
  });

  return {
    context,
    async newPage() {
      const existing = context.pages()[0];
      return existing ?? context.newPage();
    },
    async close() {
      try {
        await context.close();
      } catch (err) {
        log.debug("Fejl ved lukning af browser (ignoreres)", { error: (err as Error).message });
      }
    },
  };
}

/** Hjælper til at vente et bestemt antal millisekunder. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
