import { configureLogger, errorMeta, log } from "./logger.js";
import { ConfigError, loadConfig, loadGroups } from "./config/config.js";
import { openDatabase } from "./database/db.js";
import { PostRepository, ScanRepository, type ScanCounters } from "./database/repositories.js";
import { createClassifier } from "./classifier/classifier.js";
import type { Classifier } from "./classifier/types.js";
import { launchBrowser } from "./facebook/browser.js";
import { postKey, scanGroup } from "./facebook/scanner.js";
import { AuthRequiredError } from "./facebook/types.js";

/**
 * Klassificerer alle opslag der endnu ikke er klassificeret (også fra
 * tidligere scans, hvis en classification fejlede).
 */
export async function classifyPending(posts: PostRepository, classifier: Classifier): Promise<{ classified: number; errors: number }> {
  const pending = posts.listUnclassified();
  let classified = 0;
  let errors = 0;
  if (pending.length === 0) return { classified, errors };

  log.info("Klassificerer opslag", { count: pending.length, classifier: classifier.name });
  for (const post of pending) {
    try {
      const result = await classifier.classify({ text: post.post_text, groupName: post.group_name });
      posts.saveClassification(post.id, result, classifier.name);
      classified++;
      if (result.relevant) {
        log.info("Relevant opslag fundet", {
          postId: post.id,
          classification: result.classification,
          confidence: result.confidence,
          group: post.group_name,
        });
      }
    } catch (err) {
      errors++;
      posts.saveClassificationError(post.id, (err as Error).message ?? String(err));
      log.error("Classification-fejl", { postId: post.id, ...errorMeta(err) });
    }
  }
  return { classified, errors };
}

async function main(): Promise<void> {
  const classifyOnly = process.argv.includes("--classify-only");
  const config = loadConfig();
  configureLogger({ level: config.logLevel, dir: config.logDir });

  const db = openDatabase(config.dbPath);
  const posts = new PostRepository(db);
  const scans = new ScanRepository(db);
  const classifier = createClassifier(config);

  if (classifyOnly) {
    const result = await classifyPending(posts, classifier);
    log.info("Klassificering afsluttet", result);
    db.close();
    return;
  }

  let groups;
  try {
    const loaded = loadGroups(config.groupsFile);
    groups = loaded.groups;
    for (const g of loaded.skipped) {
      log.warn("Gruppe springes over - url er ikke udfyldt i config/groups.json", { groupId: g.id });
    }
  } catch (err) {
    if (err instanceof ConfigError) {
      log.error(err.message);
      process.exitCode = 1;
      db.close();
      return;
    }
    throw err;
  }
  if (groups.length === 0) {
    log.error("Ingen grupper at scanne. Udfyld url for mindst én gruppe i config/groups.json.");
    process.exitCode = 1;
    db.close();
    return;
  }

  const counters: ScanCounters = { groupsTotal: groups.length, postsFound: 0, postsNew: 0, parseErrors: 0, classifyErrors: 0 };
  const scanId = scans.start(groups.length);
  log.info("Scanning startet", { scanId, groups: groups.length, maxPostsPerGroup: config.maxPostsPerGroup });

  let status: "done" | "failed" = "done";
  let note: string | undefined;

  const browser = await launchBrowser({ profileDir: config.profileDir, headless: config.headless, executablePath: config.chromiumPath, channel: config.browserChannel });
  try {
    const page = await browser.newPage();
    for (const group of groups) {
      try {
        const summary = await scanGroup(page, group, {
          maxPosts: config.maxPostsPerGroup,
          diagnosticsDir: config.diagnosticsDir,
        });
        counters.postsFound += summary.found;
        counters.parseErrors += summary.parseErrors;

        let newCount = 0;
        for (const post of summary.posts) {
          const inserted = posts.insertIfNew({
            facebookPostId: postKey(group.id, post),
            groupId: group.id,
            groupName: group.name,
            postUrl: post.permalink,
            postText: post.text,
            postTimeText: post.timeText,
          });
          if (inserted) newCount++;
        }
        counters.postsNew += newCount;
        log.info("Antal nye opslag", { groupId: group.id, new: newCount, alreadyKnown: summary.found - newCount });
      } catch (err) {
        if (err instanceof AuthRequiredError) {
          log.error(err.message, { state: err.state });
          status = "failed";
          note = err.message;
          break;
        }
        log.error("Gruppe fejlede - fortsætter til næste", { groupId: group.id, ...errorMeta(err) });
        counters.parseErrors++;
      }
    }
  } finally {
    await browser.close();
  }

  const classification = await classifyPending(posts, classifier);
  counters.classifyErrors = classification.errors;

  scans.finish(scanId, counters, status, note);
  log.info("Scan afsluttet", { scanId, status, ...counters, classified: classification.classified });
  const stats = posts.stats();
  log.info("Status", { aiHits: stats.aiHits, pendingHits: stats.pendingHits, analyzed: stats.analyzed });
  console.log(`\nÅbn dashboardet med: npm run dashboard  (http://localhost:${config.dashboardPort})\n`);
  db.close();
  if (status === "failed") process.exitCode = 1;
}

main().catch((err) => {
  log.error("Scan crashede", errorMeta(err));
  process.exitCode = 1;
});
