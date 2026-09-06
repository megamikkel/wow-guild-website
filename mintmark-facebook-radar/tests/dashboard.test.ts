import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDatabase } from "../src/database/db.js";
import { PostRepository } from "../src/database/repositories.js";
import { startDashboard } from "../src/dashboard/server.js";
import { escapeHtml } from "../src/dashboard/views.js";

describe("dashboard", () => {
  const db = openDatabase(":memory:");
  const posts = new PostRepository(db);
  let baseUrl: string;
  let server: ReturnType<typeof startDashboard>;

  beforeAll(async () => {
    posts.insertIfNew({
      facebookPostId: "1",
      groupId: "g1",
      groupName: "Pokémon DK",
      postUrl: "https://www.facebook.com/groups/1/posts/1/",
      postText: "<script>alert(1)</script> Hvad er den værd?",
      postTimeText: "2 t",
    });
    const [row] = posts.listUnclassified();
    posts.saveClassification(row!.id, { classification: "VALUATION_HELP", relevant: true, confidence: 0.93, reason: "test" }, "rules");

    server = startDashboard(db, 0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
    db.close();
  });

  it("viser relevante opslag på forsiden med escaped tekst", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("VALUATION_HELP");
    expect(html).toContain("Pokémon DK");
    expect(html).toContain("Åbn på Facebook");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("93 %");
  });

  it("understøtter de fire visninger", async () => {
    for (const view of ["relevant", "irrelevant", "all", "wrong"]) {
      const res = await fetch(`${baseUrl}/?view=${view}`);
      expect(res.status).toBe(200);
    }
    const irrelevant = await (await fetch(`${baseUrl}/api/posts?view=irrelevant`)).json();
    expect(irrelevant).toEqual([]);
  });

  it("gemmer review-feedback og opdaterer statistik", async () => {
    const [post] = posts.list("relevant");
    const res = await fetch(`${baseUrl}/api/posts/${post!.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "correct_hit" }),
    });
    expect(res.status).toBe(200);
    const stats = (await (await fetch(`${baseUrl}/api/stats`)).json()) as { truePositives: number; precision: number };
    expect(stats.truePositives).toBe(1);
    expect(stats.precision).toBe(1);

    const bad = await fetch(`${baseUrl}/api/posts/${post!.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "nonsense" }),
    });
    expect(bad.status).toBe(400);

    const missing = await fetch(`${baseUrl}/api/posts/999999/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "handled" }),
    });
    expect(missing.status).toBe(404);
  });

  it("escapeHtml escaper alle specialtegn", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});
