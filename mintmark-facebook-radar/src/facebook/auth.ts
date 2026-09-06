import type { Page } from "playwright";
import { log } from "../logger.js";
import { sleep } from "./browser.js";
import { CHECKPOINT_URL_PATTERN, SELECTORS } from "./selectors.js";
import { AuthRequiredError, type AuthState } from "./types.js";

export const FACEBOOK_HOME = "https://www.facebook.com/";

/**
 * Afgør ud fra den aktuelle side om brugeren er logget ind.
 * Læser kun DOM'en - rører aldrig cookies eller tokens.
 */
export async function detectAuthState(page: Page): Promise<AuthState> {
  const url = page.url();
  if (CHECKPOINT_URL_PATTERN.test(url)) {
    return url.includes("/login") ? "logged_out" : "checkpoint";
  }
  try {
    const hasLoginForm = (await page.locator(SELECTORS.loginForm).count()) > 0;
    if (hasLoginForm) return "logged_out";
    for (const hint of SELECTORS.loggedInHints) {
      if ((await page.locator(hint).count()) > 0) return "logged_in";
    }
  } catch (err) {
    log.debug("Kunne ikke aflæse login-tilstand", { error: (err as Error).message });
  }
  return "unknown";
}

/**
 * Kaster AuthRequiredError hvis Facebook kræver login eller manuel
 * godkendelse. Programmet forsøger aldrig at omgå checkpoints, CAPTCHA
 * eller MFA - det stopper og beder brugeren gøre det manuelt.
 */
export async function ensureLoggedIn(page: Page): Promise<void> {
  const state = await detectAuthState(page);
  if (state === "logged_out") {
    throw new AuthRequiredError(state, "Ikke logget ind på Facebook. Kør `npm run login` og log ind manuelt i browseren.");
  }
  if (state === "checkpoint") {
    throw new AuthRequiredError(
      state,
      "Facebook kræver manuel godkendelse (checkpoint/MFA/CAPTCHA). Åbn browseren via `npm run login`, gennemfør godkendelsen manuelt, og kør derefter scan igen.",
    );
  }
}

/**
 * Venter på at brugeren logger ind manuelt i det åbne browservindue.
 * Returnerer true ved login, false ved timeout eller hvis vinduet lukkes.
 */
export async function waitForManualLogin(page: Page, timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  let lastState: AuthState | null = null;
  while (Date.now() - started < timeoutMs) {
    if (page.isClosed()) return false;
    const state = await detectAuthState(page);
    if (state !== lastState) {
      lastState = state;
      if (state === "checkpoint") {
        log.warn("Facebook beder om manuel godkendelse - gennemfør den selv i browservinduet. Radar venter.");
      } else if (state === "logged_out") {
        log.info("Venter på at du logger ind i browservinduet...");
      }
    }
    if (state === "logged_in") return true;
    await sleep(2000);
  }
  return false;
}
