import { configureLogger, errorMeta, log } from "./logger.js";
import { ConfigError, loadConfig, loadGroups } from "./config/config.js";
import { launchBrowser, sleep } from "./facebook/browser.js";
import { detectAuthState, FACEBOOK_HOME } from "./facebook/auth.js";
import { saveDiagnostics } from "./facebook/diagnostics.js";
import { expandSeeMore, extractRawCandidates } from "./facebook/parser.js";

/**
 * Diagnostic mode: gemmer sanitiseret DOM, screenshot og en oversigt over
 * hvad parseren kan finde, for forsiden og hver konfigureret gruppe.
 * Bruges til at reparere selectors i src/facebook/selectors.ts.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  configureLogger({ level: "debug", dir: config.logDir });

  let groups;
  try {
    groups = loadGroups(config.groupsFile).groups;
  } catch (err) {
    if (err instanceof ConfigError) {
      log.error(err.message);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const browser = await launchBrowser({ profileDir: config.profileDir, headless: config.headless, executablePath: config.chromiumPath });
  try {
    const page = await browser.newPage();
    await page.goto(FACEBOOK_HOME, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await sleep(2000);
    const state = await detectAuthState(page);
    log.info("Login-tilstand", { state });
    await saveDiagnostics(page, config.diagnosticsDir, "home");
    if (state !== "logged_in") {
      log.warn("Ikke logget ind - gruppediagnostik springes over. Kør `npm run login` først.");
      return;
    }

    for (const group of groups) {
      try {
        await page.goto(group.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await sleep(4000);
        await expandSeeMore(page);
        const candidates = await extractRawCandidates(page);
        log.info("Parser-resultat", {
          groupId: group.id,
          candidates: candidates.length,
          withPermalink: candidates.filter((c) => c.permalink).length,
          withText: candidates.filter((c) => c.text.trim().length > 0).length,
        });
        for (const c of candidates.slice(0, 5)) {
          log.debug("Kandidat", {
            index: c.index,
            permalink: c.permalink ? c.permalink.split("?")[0] : null,
            timeText: c.timeText,
            textPreview: c.text.slice(0, 80),
          });
        }
        await saveDiagnostics(page, config.diagnosticsDir, `group_${group.id}`);
      } catch (err) {
        log.error("Diagnostik fejlede for gruppe", { groupId: group.id, ...errorMeta(err) });
      }
    }
    log.info("Diagnostik færdig", { dir: config.diagnosticsDir });
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  log.error("Diagnostik crashede", errorMeta(err));
  process.exitCode = 1;
});
