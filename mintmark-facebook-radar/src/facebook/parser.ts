import type { Page } from "playwright";
import { PERMALINK_PATTERNS, SELECTORS } from "./selectors.js";
import type { RawPostCandidate, ScrapedPost } from "./types.js";

export class PostParseError extends Error {
  constructor(
    message: string,
    public readonly candidateIndex: number,
  ) {
    super(message);
    this.name = "PostParseError";
  }
}

/**
 * Udtrækker Facebooks post-id fra et permalink.
 * Understøtter /groups/<g>/posts/<id>/, /permalink/<id>/, story_fbid=<id>,
 * multi_permalinks=<id> samt de nyere pfbid-id'er.
 */
export function extractPostId(url: string | null | undefined): string | null {
  if (!url) return null;
  const patterns: RegExp[] = [
    /\/posts\/(pfbid[A-Za-z0-9]+|\d+)/,
    /\/permalink\/(pfbid[A-Za-z0-9]+|\d+)/,
    /[?&]story_fbid=(pfbid[A-Za-z0-9]+|\d+)/,
    /[?&]multi_permalinks=(\d+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Fjerner tracking-parametre (__cft__, __tn__ osv.) fra et permalink. */
export function cleanPermalink(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!/^(https?:\/\/|\/)/i.test(url.trim())) return null;
  try {
    const u = new URL(url, "https://www.facebook.com");
    const keep = new URLSearchParams();
    for (const key of ["story_fbid", "id", "multi_permalinks"]) {
      const v = u.searchParams.get(key);
      if (v) keep.set(key, v);
    }
    u.search = keep.toString() ? `?${keep.toString()}` : "";
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

export function normalizePostText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();
}

/**
 * Kører i browser-konteksten. Skal være selvstændig (ingen lukninger over
 * modul-variabler) - alt sendes ind som argument.
 */
function extractInBrowser(args: {
  article: string;
  postText: string;
  textBlocks: string;
  anchors: string;
  permalinkPatterns: string[];
}): RawPostCandidate[] {
  const patterns = args.permalinkPatterns.map((p) => new RegExp(p));
  const all = Array.from(document.querySelectorAll<HTMLElement>(args.article));
  // Kun top-niveau artikler = opslag. Nested artikler er kommentarer.
  const topLevel = all.filter((a) => !a.parentElement?.closest(args.article));

  return topLevel.map((article, index) => {
    // Kun ankre der hører til selve opslaget (ikke til kommentarer).
    const anchorEls = Array.from(article.querySelectorAll<HTMLAnchorElement>(args.anchors)).filter(
      (a) => a.closest(args.article) === article,
    );
    const permalinkAnchor = anchorEls.find((a) => patterns.some((p) => p.test(a.href)));
    const permalink = permalinkAnchor ? permalinkAnchor.href : null;
    const timeText =
      permalinkAnchor?.getAttribute("aria-label")?.trim() ||
      permalinkAnchor?.textContent?.trim() ||
      article.querySelector("abbr")?.textContent?.trim() ||
      null;

    // NB: ingen navngivne indre funktioner her - tsx/esbuild injicerer en
    // __name-hjælper for dem, som ikke findes i browser-konteksten.
    let text: string;
    const messageEl = Array.from(article.querySelectorAll<HTMLElement>(args.postText)).find(
      (el) => el.closest(args.article) === article,
    );
    if (messageEl) {
      text = messageEl.innerText;
    } else {
      // Fallback: saml tekstblokke der ikke tilhører kommentarer og ikke er
      // rene navne/tidsstempler (meget korte).
      const seen = new Set<string>();
      const blocks: string[] = [];
      for (const el of Array.from(article.querySelectorAll<HTMLElement>(args.textBlocks))) {
        if (el.closest(args.article) !== article) continue;
        if (el.querySelector(args.textBlocks)) continue; // kun blade
        const t = el.innerText.trim();
        if (t.length < 20 || seen.has(t)) continue;
        seen.add(t);
        blocks.push(t);
      }
      text = blocks.join("\n");
    }

    return {
      index,
      permalink,
      timeText,
      text,
      hasNestedArticles: article.querySelector(args.article) !== null,
    };
  });
}

/** Udtrækker rå kandidater fra den aktuelle side. */
export async function extractRawCandidates(page: Page): Promise<RawPostCandidate[]> {
  return page.evaluate(extractInBrowser, {
    article: SELECTORS.article,
    postText: SELECTORS.postText,
    textBlocks: SELECTORS.textBlocks,
    anchors: SELECTORS.anchors,
    permalinkPatterns: [...PERMALINK_PATTERNS],
  });
}

/**
 * Folder "Se mere" ud i opslag, så den fulde tekst kan læses.
 * Dette er den eneste klik-interaktion værktøjet foretager, og den ændrer
 * intet på Facebook.
 */
export async function expandSeeMore(page: Page, maxClicks = 60): Promise<number> {
  let clicked = 0;
  const buttons = page.locator(SELECTORS.seeMoreButton);
  const count = Math.min(await buttons.count(), 400);
  for (let i = 0; i < count && clicked < maxClicks; i++) {
    const button = buttons.nth(i);
    try {
      const label = (await button.innerText({ timeout: 300 })).trim().toLowerCase();
      if (!SELECTORS.seeMoreTexts.includes(label as (typeof SELECTORS.seeMoreTexts)[number])) continue;
      if (!(await button.isVisible())) continue;
      await button.click({ timeout: 1000, noWaitAfter: true });
      clicked++;
    } catch {
      // Knappen forsvandt eller kunne ikke klikkes - ignorér.
    }
  }
  return clicked;
}

/**
 * Validerer en rå kandidat og omdanner den til et ScrapedPost.
 * Kaster PostParseError hvis opslaget ikke kan parses sikkert.
 */
export function toScrapedPost(candidate: RawPostCandidate): ScrapedPost {
  const text = normalizePostText(candidate.text ?? "");
  const permalink = cleanPermalink(candidate.permalink);
  const facebookPostId = extractPostId(candidate.permalink);

  if (text.length === 0) {
    throw new PostParseError("Opslaget har ingen læsbar tekst (måske kun billede/video)", candidate.index);
  }
  if (text.length > 20_000) {
    throw new PostParseError("Opslagsteksten er urealistisk lang - sandsynligvis forkert element", candidate.index);
  }

  return { facebookPostId, permalink, text, timeText: candidate.timeText || null };
}
