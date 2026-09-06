import fs from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import { log } from "../logger.js";
import { PERMALINK_PATTERNS, SELECTORS } from "./selectors.js";

/**
 * Gemmer sanitiseret DOM, screenshot og en lille oversigt lokalt, så
 * selectors kan repareres uden at dele login-data. Fjerner scripts, styles,
 * formularværdier og query-strenge fra links før HTML'en gemmes.
 */
export async function saveDiagnostics(page: Page, dir: string, label: string): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeLabel = label.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 40);
  const target = path.join(dir, `${stamp}_${safeLabel}`);
  fs.mkdirSync(target, { recursive: true });

  try {
    await page.screenshot({ path: path.join(target, "screenshot.png"), fullPage: false });
  } catch (err) {
    log.warn("Kunne ikke gemme screenshot", { error: (err as Error).message });
  }

  try {
    const result = await page.evaluate(
      (args) => {
        const doc = document.documentElement.cloneNode(true) as HTMLElement;
        doc.querySelectorAll("script, style, noscript, link, meta, iframe, svg, img, video, canvas").forEach((el) => el.remove());
        doc.querySelectorAll("input, textarea").forEach((el) => {
          el.removeAttribute("value");
          el.textContent = "";
        });
        doc.querySelectorAll("a[href]").forEach((a) => {
          const href = a.getAttribute("href") ?? "";
          a.setAttribute("href", href.split("?")[0] ?? "");
        });
        doc.querySelectorAll("[style]").forEach((el) => el.removeAttribute("style"));

        const articles = Array.from(document.querySelectorAll(args.article));
        const topLevel = articles.filter((a) => !a.parentElement?.closest(args.article));
        const patterns = args.permalinkPatterns.map((p) => new RegExp(p));
        const permalinkSamples = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
          .map((a) => a.href.split("?")[0] ?? "")
          .filter((h) => patterns.some((p) => p.test(h)))
          .slice(0, 10);

        return {
          html: "<!doctype html>\n" + doc.outerHTML,
          summary: {
            url: location.href.split("?")[0],
            title: document.title,
            feedFound: document.querySelector(args.feed) !== null,
            articlesTotal: articles.length,
            articlesTopLevel: topLevel.length,
            messageBlocks: document.querySelectorAll(args.postText).length,
            loginFormFound: document.querySelector(args.loginForm) !== null,
            permalinkSamples,
          },
        };
      },
      {
        article: SELECTORS.article,
        feed: SELECTORS.feed,
        postText: SELECTORS.postText,
        loginForm: SELECTORS.loginForm,
        permalinkPatterns: [...PERMALINK_PATTERNS],
      },
    );
    fs.writeFileSync(path.join(target, "dom.sanitized.html"), result.html, "utf8");
    fs.writeFileSync(path.join(target, "summary.json"), JSON.stringify(result.summary, null, 2), "utf8");
    log.info("Diagnostik gemt", { dir: target, ...result.summary, permalinkSamples: result.summary.permalinkSamples.length });
  } catch (err) {
    log.warn("Kunne ikke gemme DOM-diagnostik", { error: (err as Error).message });
  }
  return target;
}
