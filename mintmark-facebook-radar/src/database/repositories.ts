import type Database from "better-sqlite3";
import type { Classification, ClassificationResult } from "../classifier/types.js";

export type ReviewStatus = "pending" | "correct_hit" | "wrong_hit" | "handled";
export const REVIEW_STATUSES: readonly ReviewStatus[] = ["pending", "correct_hit", "wrong_hit", "handled"];

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === "string" && (REVIEW_STATUSES as readonly string[]).includes(value);
}

export interface PostRow {
  id: number;
  facebook_post_id: string;
  group_id: string;
  group_name: string;
  post_url: string | null;
  post_text: string;
  post_time_text: string | null;
  first_seen_at: string;
  classified_at: string | null;
  classification: Classification | null;
  relevant: number | null;
  confidence: number | null;
  reason: string | null;
  classifier: string | null;
  classification_error: string | null;
  review_status: ReviewStatus;
  human_relevant: number | null;
  reviewed_at: string | null;
}

export interface NewPost {
  facebookPostId: string;
  groupId: string;
  groupName: string;
  postUrl: string | null;
  postText: string;
  postTimeText: string | null;
}

export type PostView = "relevant" | "irrelevant" | "all" | "wrong";

export interface Stats {
  totalPosts: number;
  analyzed: number;
  aiHits: number;
  truePositives: number;
  falsePositives: number;
  /** null når der ikke er reviewede hits endnu */
  precision: number | null;
  pendingHits: number;
  classificationErrors: number;
}

export class PostRepository {
  private readonly insertStmt;
  private readonly existsStmt;
  private readonly byIdStmt;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT OR IGNORE INTO posts
        (facebook_post_id, group_id, group_name, post_url, post_text, post_time_text, first_seen_at)
      VALUES
        (@facebookPostId, @groupId, @groupName, @postUrl, @postText, @postTimeText, @firstSeenAt)
    `);
    this.existsStmt = db.prepare("SELECT 1 FROM posts WHERE facebook_post_id = ?");
    this.byIdStmt = db.prepare("SELECT * FROM posts WHERE id = ?");
  }

  exists(facebookPostId: string): boolean {
    return this.existsStmt.get(facebookPostId) !== undefined;
  }

  /** Returnerer true hvis opslaget var nyt (blev indsat). */
  insertIfNew(post: NewPost, now: Date = new Date()): boolean {
    const info = this.insertStmt.run({ ...post, firstSeenAt: now.toISOString() });
    return info.changes > 0;
  }

  getById(id: number): PostRow | undefined {
    return this.byIdStmt.get(id) as PostRow | undefined;
  }

  listUnclassified(limit = 500): PostRow[] {
    return this.db
      .prepare("SELECT * FROM posts WHERE classified_at IS NULL ORDER BY id ASC LIMIT ?")
      .all(limit) as PostRow[];
  }

  saveClassification(id: number, result: ClassificationResult, classifierName: string, now: Date = new Date()): void {
    this.db
      .prepare(
        `UPDATE posts
           SET classified_at = @classifiedAt,
               classification = @classification,
               relevant = @relevant,
               confidence = @confidence,
               reason = @reason,
               classifier = @classifier,
               classification_error = NULL
         WHERE id = @id`,
      )
      .run({
        id,
        classifiedAt: now.toISOString(),
        classification: result.classification,
        relevant: result.relevant ? 1 : 0,
        confidence: result.confidence,
        reason: result.reason,
        classifier: classifierName,
      });
  }

  saveClassificationError(id: number, message: string): void {
    this.db.prepare("UPDATE posts SET classification_error = ? WHERE id = ?").run(message.slice(0, 500), id);
  }

  /**
   * Opslag til dashboardet, sorteret: ikke gennemgået først, derefter
   * confidence faldende, derefter nyeste først.
   */
  list(view: PostView, limit = 200): PostRow[] {
    let where: string;
    switch (view) {
      case "relevant":
        where = "relevant = 1";
        break;
      case "irrelevant":
        where = "classified_at IS NOT NULL AND relevant = 0";
        break;
      case "wrong":
        where = "review_status = 'wrong_hit' OR (relevant = 0 AND human_relevant = 1)";
        break;
      case "all":
      default:
        where = "1 = 1";
    }
    return this.db
      .prepare(
        `SELECT * FROM posts
          WHERE ${where}
          ORDER BY CASE WHEN review_status = 'pending' THEN 0 ELSE 1 END ASC,
                   COALESCE(confidence, -1) DESC,
                   first_seen_at DESC,
                   id DESC
          LIMIT ?`,
      )
      .all(limit) as PostRow[];
  }

  /**
   * Gemmer menneskets vurdering adskilt fra AI-vurderingen.
   * - correct_hit: mennesket bekræfter at opslaget er relevant
   * - wrong_hit:   mennesket afviser
   * - handled:     opslaget er behandlet (human_relevant røres ikke)
   * - pending:     nulstil
   */
  setReview(id: number, status: ReviewStatus, now: Date = new Date()): PostRow | undefined {
    const post = this.getById(id);
    if (!post) return undefined;

    let humanRelevant: number | null = post.human_relevant;
    if (status === "correct_hit") humanRelevant = 1;
    else if (status === "wrong_hit") humanRelevant = 0;
    else if (status === "pending") humanRelevant = null;

    this.db
      .prepare("UPDATE posts SET review_status = ?, human_relevant = ?, reviewed_at = ? WHERE id = ?")
      .run(status, humanRelevant, status === "pending" ? null : now.toISOString(), id);
    return this.getById(id);
  }

  stats(): Stats {
    const row = this.db
      .prepare(
        `SELECT
           COUNT(*)                                                        AS totalPosts,
           SUM(CASE WHEN classified_at IS NOT NULL THEN 1 ELSE 0 END)      AS analyzed,
           SUM(CASE WHEN relevant = 1 THEN 1 ELSE 0 END)                   AS aiHits,
           SUM(CASE WHEN relevant = 1 AND human_relevant = 1 THEN 1 ELSE 0 END) AS truePositives,
           SUM(CASE WHEN relevant = 1 AND human_relevant = 0 THEN 1 ELSE 0 END) AS falsePositives,
           SUM(CASE WHEN relevant = 1 AND review_status = 'pending' THEN 1 ELSE 0 END) AS pendingHits,
           SUM(CASE WHEN classification_error IS NOT NULL THEN 1 ELSE 0 END) AS classificationErrors
         FROM posts`,
      )
      .get() as Record<string, number | null>;

    const tp = row.truePositives ?? 0;
    const fp = row.falsePositives ?? 0;
    return {
      totalPosts: row.totalPosts ?? 0,
      analyzed: row.analyzed ?? 0,
      aiHits: row.aiHits ?? 0,
      truePositives: tp,
      falsePositives: fp,
      precision: tp + fp > 0 ? tp / (tp + fp) : null,
      pendingHits: row.pendingHits ?? 0,
      classificationErrors: row.classificationErrors ?? 0,
    };
  }
}

export interface ScanCounters {
  groupsTotal: number;
  postsFound: number;
  postsNew: number;
  parseErrors: number;
  classifyErrors: number;
}

export class ScanRepository {
  constructor(private readonly db: Database.Database) {}

  start(groupsTotal: number, now: Date = new Date()): number {
    const info = this.db
      .prepare("INSERT INTO scans (started_at, groups_total) VALUES (?, ?)")
      .run(now.toISOString(), groupsTotal);
    return Number(info.lastInsertRowid);
  }

  finish(id: number, counters: ScanCounters, status: "done" | "failed", note?: string, now: Date = new Date()): void {
    this.db
      .prepare(
        `UPDATE scans
            SET finished_at = ?, groups_total = ?, posts_found = ?, posts_new = ?,
                parse_errors = ?, classify_errors = ?, status = ?, note = ?
          WHERE id = ?`,
      )
      .run(
        now.toISOString(),
        counters.groupsTotal,
        counters.postsFound,
        counters.postsNew,
        counters.parseErrors,
        counters.classifyErrors,
        status,
        note ?? null,
        id,
      );
  }

  latest(): { started_at: string; finished_at: string | null; posts_found: number; posts_new: number; status: string } | undefined {
    return this.db.prepare("SELECT * FROM scans ORDER BY id DESC LIMIT 1").get() as
      | { started_at: string; finished_at: string | null; posts_found: number; posts_new: number; status: string }
      | undefined;
  }
}
