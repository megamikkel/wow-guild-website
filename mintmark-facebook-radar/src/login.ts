import { configureLogger, errorMeta, log } from "./logger.js";
import { loadConfig } from "./config/config.js";
import { launchBrowser } from "./facebook/browser.js";
import { FACEBOOK_HOME, waitForManualLogin } from "./facebook/auth.js";

const LOGIN_TIMEOUT_MS = 15 * 60 * 1000;

async function main(): Promise<void> {
  const config = loadConfig();
  configureLogger({ level: config.logLevel, dir: config.logDir });

  log.info("Åbner Chromium til manuelt Facebook-login", { profileDir: config.profileDir });
  const browser = await launchBrowser({ profileDir: config.profileDir, headless: false, executablePath: config.chromiumPath, channel: config.browserChannel });

  try {
    const page = await browser.newPage();
    await page.goto(FACEBOOK_HOME, { waitUntil: "domcontentloaded", timeout: 60_000 });

    console.log("\n==============================================================");
    console.log(" Log ind på Facebook i browservinduet.");
    console.log(" Radar gemmer INTET password - kun browserens egen session");
    console.log(` i mappen: ${config.profileDir}`);
    console.log(" Hvis Facebook beder om kode/godkendelse, så gennemfør den selv.");
    console.log("");
    console.log(" Kommer der CAPTCHA igen og igen, stoler Facebook ikke på");
    console.log(" browseren. Prøv med din installerede Chrome i stedet:");
    console.log("   sæt RADAR_BROWSER_CHANNEL=chrome i .env og kør login igen.");
    console.log("==============================================================\n");

    const ok = await waitForManualLogin(page, LOGIN_TIMEOUT_MS);
    if (ok) {
      log.info("Login registreret. Sessionen er gemt i browserprofilen - du kan nu køre `npm run scan`.");
      // Giv Facebook et øjeblik til at skrive session-data til profilen.
      await page.waitForTimeout(3000);
    } else {
      log.warn("Login blev ikke registreret (timeout eller vinduet blev lukket). Kør `npm run login` igen.");
      log.warn("Blev du ved med at få CAPTCHA? Sæt RADAR_BROWSER_CHANNEL=chrome i .env og prøv igen.");
    }
  } catch (err) {
    log.error("Login-flowet fejlede", errorMeta(err));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
