import { describe, expect, it, beforeEach } from "vitest";
import { openDatabase } from "../src/database/db.js";
import { PostRepository, ScanRepository, type NewPost } from "../src/database/repositories.js";

function makePost(overrides: Partial<NewPost> = {}): NewPost {
  return {
    facebookPostId: "123",
    groupId: "group1",
    groupName: "Gruppe 1",
    postUrl: "https://www.facebook.com/groups/1/posts/123/",
    postText: "Hvad er den værd?",
    postTimeText: "3 t",
    ...overrides,
  };
}

describe("PostRepository", () => {
  let posts: PostRepository;

  beforeEach(() => {
    const db = openDatabase(":memory:");
    posts = new PostRepository(db);
  });

  it("indsætter et opslag og ignorerer dubletter (unique på facebook_post_id)", () => {
    expect(posts.insertIfNew(makePost())).toBe(true);
    expect(posts.insertIfNew(makePost({ postText: "anden tekst" }))).toBe(false);
    expect(posts.exists("123")).toBe(true);
    expect(posts.listUnclassified()).toHaveLength(1);
    expect(posts.listUnclassified()[0]?.post_text).toBe("Hvad er den værd?");
  });

  it("gemmer klassificering og gør opslaget synligt i relevante-visningen", () => {
    posts.insertIfNew(makePost());
    const [row] = posts.listUnclassified();
    posts.saveClassification(row!.id, { classification: "VALUATION_HELP", relevant: true, confidence: 0.9, reason: "test" }, "rules");
    expect(posts.listUnclassified()).toHaveLength(0);
    const relevant = posts.list("relevant");
    expect(relevant).toHaveLength(1);
    expect(relevant[0]?.classification).toBe("VALUATION_HELP");
    expect(relevant[0]?.classifier).toBe("rules");
    expect(posts.list("irrelevant")).toHaveLength(0);
  });

  it("sorterer: ikke gennemgået først, derefter confidence faldende, derefter nyeste", () => {
    posts.insertIfNew(makePost({ facebookPostId: "a", postText: "a" }), new Date("2026-01-01T10:00:00Z"));
    posts.insertIfNew(makePost({ facebookPostId: "b", postText: "b" }), new Date("2026-01-02T10:00:00Z"));
    posts.insertIfNew(makePost({ facebookPostId: "c", postText: "c" }), new Date("2026-01-03T10:00:00Z"));
    posts.insertIfNew(makePost({ facebookPostId: "d", postText: "d" }), new Date("2026-01-04T10:00:00Z"));
    const rows = posts.list("all");
    const byKey = Object.fromEntries(rows.map((r) => [r.facebook_post_id, r.id]));
    const cls = (id: number, confidence: number) =>
      posts.saveClassification(id, { classification: "PRICE_HELP", relevant: true, confidence, reason: "r" }, "rules");
    cls(byKey.a!, 0.95);
    cls(byKey.b!, 0.7);
    cls(byKey.c!, 0.7);
    cls(byKey.d!, 0.99);
    posts.setReview(byKey.d!, "correct_hit");

    const order = posts.list("relevant").map((r) => r.facebook_post_id);
    // d er reviewed -> sidst. a har højest confidence. b og c er lige -> nyeste (c) først.
    expect(order).toEqual(["a", "c", "b", "d"]);
  });

  it("gemmer menneskets vurdering separat fra AI'ens og beregner precision", () => {
    for (const id of ["1", "2", "3", "4"]) posts.insertIfNew(makePost({ facebookPostId: id, postText: `t${id}` }));
    const rows = posts.list("all");
    const ids = rows.map((r) => r.id);
    const hit = (id: number) => posts.saveClassification(id, { classification: "PRICE_HELP", relevant: true, confidence: 0.9, reason: "r" }, "rules");
    const miss = (id: number) => posts.saveClassification(id, { classification: "SALE_ONLY", relevant: false, confidence: 0.9, reason: "r" }, "rules");
    hit(ids[0]!);
    hit(ids[1]!);
    hit(ids[2]!);
    miss(ids[3]!);

    posts.setReview(ids[0]!, "correct_hit");
    posts.setReview(ids[1]!, "wrong_hit");
    posts.setReview(ids[2]!, "handled");

    const stats = posts.stats();
    expect(stats.analyzed).toBe(4);
    expect(stats.aiHits).toBe(3);
    expect(stats.truePositives).toBe(1);
    expect(stats.falsePositives).toBe(1);
    expect(stats.precision).toBeCloseTo(0.5);
    expect(stats.pendingHits).toBe(0);

    // AI-vurderingen er uændret selvom mennesket afviste
    const wrong = posts.getById(ids[1]!)!;
    expect(wrong.relevant).toBe(1);
    expect(wrong.human_relevant).toBe(0);
    expect(wrong.review_status).toBe("wrong_hit");
    expect(posts.list("wrong").map((r) => r.id)).toEqual([ids[1]]);

    // "Behandlet" rører ikke human_relevant
    expect(posts.getById(ids[2]!)!.human_relevant).toBeNull();

    // Nulstil
    posts.setReview(ids[1]!, "pending");
    expect(posts.getById(ids[1]!)!.human_relevant).toBeNull();
    expect(posts.stats().falsePositives).toBe(0);
  });

  it("returnerer null precision uden reviewede hits", () => {
    expect(posts.stats().precision).toBeNull();
  });

  it("gemmer classification-fejl uden at klassificere", () => {
    posts.insertIfNew(makePost());
    const [row] = posts.listUnclassified();
    posts.saveClassificationError(row!.id, "API nede");
    expect(posts.listUnclassified()).toHaveLength(1);
    expect(posts.stats().classificationErrors).toBe(1);
  });
});

describe("ScanRepository", () => {
  it("registrerer start og afslutning af en scanning", () => {
    const db = openDatabase(":memory:");
    const scans = new ScanRepository(db);
    const id = scans.start(4);
    scans.finish(id, { groupsTotal: 4, postsFound: 120, postsNew: 12, parseErrors: 1, classifyErrors: 0 }, "done");
    const latest = scans.latest()!;
    expect(latest.posts_found).toBe(120);
    expect(latest.posts_new).toBe(12);
    expect(latest.status).toBe("done");
    expect(latest.finished_at).not.toBeNull();
  });

  it("migrationer er idempotente", () => {
    const db = openDatabase(":memory:");
    const count = (db.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get() as { n: number }).n;
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
