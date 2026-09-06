import { createHash } from "node:crypto";
import type { Page } from "playwright";
import type { GroupConfig } from "../config/config.js";
import { errorMeta, log } from "../logger.js";
import { ensureLoggedIn } from "./auth.js";
import { sleep } from "./browser.js";
import { saveDiagnostics } from "./diagnostics.js";
import { expandSeeMore, extractRawCandidates, PostParseError, toScrapedPost } from "./parser.js";
import { SELECTORS } from "./selectors.js";
import type { GroupScanSummary, ScrapedPost } from "./types.js";

export interface ScanOptions {
  maxPosts: number;
  /** Maks antal scroll-runder, så vi aldrig crawler historik i stor skala */
  maxScrolls?: number;
  /** Pause mellem scroll-runder i ms */
  scrollPauseMs?: number;
  /** Mappe til diagnostik hvis feedet ikke kan findes (valgfri) */
  diagnosticsDir?: string;
}

/**
 * Stabil nøgle for et opslag. Bruger Facebooks post-id når det findes,
 * ellers en hash af gruppe + tekst, så dedup stadig virker.
 */
export function postKey(groupId: string, post: ScrapedPost): string {
  if (post.facebookPostId) return post.facebookPostId;
  const digest = createHash("sha1").update(`${groupId}\n${post.text}`).digest("hex");
  return `hash:${groupId}:${digest.slice(0, 24)}`;
}

/**
 * Scanner én gruppes feed: åbner URL'en, venter på indhold, scroller
 * kontrolleret og udtrækker op til maxPosts opslag.
 *
 * Read-only: åbner ingen profiler, henter ingen billeder, læser ingen
 * kommentarer, og skriver/liker/kommenterer aldrig.
 */
export async function scanGroup(page: Page, group: GroupConfig, options: ScanOptions): Promise<GroupScanSummary> {
  const maxScrolls = options.maxScrolls ?? 12;
  const pause = options.scrollPauseMs ?? 2000;
  log.info("Gruppe startet", { groupId: group.id, groupName: group.name });

  await page.goto(group.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await sleep(1500);
  await ensureLoggedIn(page);

  try {
    await page.locator(SELECTORS.feed).first().waitFor({ state: "attached", timeout: 20_000 });
  } catch {
    log.warn("Fandt ikke feed-containeren - Facebook-markup kan være ændret", { groupId: group.id });
    if (options.diagnosticsDir) await saveDiagnostics(page, options.diagnosticsDir, `no-feed_${group.id}`);
  }

  const collected = new Map<string, ScrapedPost>();
  /** Kandidater der allerede er logget som parse-fejl (så de ikke tælles pr. scroll-runde) */
  const failedCandidates = new Set<string>();
  let parseErrors = 0;
  let idleRounds = 0;

  for (let round = 0; round <= maxScrolls; round++) {
    await expandSeeMore(page);
    const before = collected.size;

    let candidates;
    try {
      candidates = await extractRawCandidates(page);
    } catch (err) {
      log.error("Kunne ikke udtrække opslag fra siden", { groupId: group.id, ...errorMeta(err) });
      parseErrors++;
      break;
    }

    for (const candidate of candidates) {
      try {
        const post = toScrapedPost(candidate);
        const key = postKey(group.id, post);
        if (!collected.has(key)) collected.set(key, post);
      } catch (err) {
        const signature = candidate.permalink ?? `index:${candidate.index}`;
        if (failedCandidates.has(signature)) continue;
        failedCandidates.add(signature);
        parseErrors++;
        if (err instanceof PostParseError) {
          log.debug("Opslag sprunget over", { groupId: group.id, index: err.candidateIndex, reason: err.message });
        } else {
          log.warn("Parsing-fejl på opslag", { groupId: group.id, index: candidate.index, ...errorMeta(err) });
        }
      }
      if (collected.size >= options.maxPosts) break;
    }

    log.debug("Scroll-runde", { groupId: group.id, round, candidates: candidates.length, collected: collected.size });
    if (collected.size >= options.maxPosts) break;

    idleRounds = collected.size === before ? idleRounds + 1 : 0;
    if (idleRounds >= 3) {
      log.info("Ingen nye opslag efter flere scroll-runder - stopper gruppen", { groupId: group.id });
      break;
    }
    if (round === maxScrolls) break;

    await page.mouse.wheel(0, 1800);
    await sleep(pause);
  }

  const posts = Array.from(collected.values()).slice(0, options.maxPosts);
  const withoutId = posts.filter((p) => !p.facebookPostId).length;
  if (withoutId > 0) {
    log.warn("Opslag uden Facebook post-id (bruger tekst-hash som nøgle)", { groupId: group.id, count: withoutId });
  }
  log.info("Antal fundne opslag", { groupId: group.id, found: posts.length, parseErrors });

  return { groupId: group.id, groupName: group.name, found: posts.length, parseErrors, posts };
}
