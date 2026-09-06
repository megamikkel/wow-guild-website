import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanPermalink, extractPostId, extractRawCandidates, normalizePostText, PostParseError, toScrapedPost } from "../src/facebook/parser.js";
import { detectAuthState } from "../src/facebook/auth.js";
import { postKey } from "../src/facebook/scanner.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("extractPostId", () => {
  it("finder id'er i de kendte permalink-formater", () => {
    expect(extractPostId("https://www.facebook.com/groups/111/posts/9876543210/?__cft__[0]=x")).toBe("9876543210");
    expect(extractPostId("https://www.facebook.com/groups/111/permalink/1122334455/")).toBe("1122334455");
    expect(extractPostId("https://www.facebook.com/groups/111/posts/pfbid02AbCdEfGh123/")).toBe("pfbid02AbCdEfGh123");
    expect(extractPostId("https://www.facebook.com/permalink.php?story_fbid=555&id=111")).toBe("555");
    expect(extractPostId("https://www.facebook.com/groups/111/?multi_permalinks=777")).toBe("777");
    expect(extractPostId("https://www.facebook.com/groups/111/")).toBeNull();
    expect(extractPostId(null)).toBeNull();
  });
});

describe("cleanPermalink", () => {
  it("fjerner tracking-parametre men beholder identificerende parametre", () => {
    expect(cleanPermalink("https://www.facebook.com/groups/111/posts/987/?__cft__[0]=abc&__tn__=R")).toBe(
      "https://www.facebook.com/groups/111/posts/987/",
    );
    expect(cleanPermalink("https://www.facebook.com/permalink.php?story_fbid=555&id=111&__cft__[0]=x")).toBe(
      "https://www.facebook.com/permalink.php?story_fbid=555&id=111",
    );
    expect(cleanPermalink("not a url at all ::")).toBeNull();
  });
});

describe("toScrapedPost", () => {
  it("normaliserer tekst og udtrækker id", () => {
    const post = toScrapedPost({
      index: 0,
      permalink: "https://www.facebook.com/groups/1/posts/42/?__cft__[0]=x",
      timeText: "3 t",
      text: "  Linje 1 \r\n\r\n\r\n Linje 2  ",
      hasNestedArticles: false,
    });
    expect(post.facebookPostId).toBe("42");
    expect(post.permalink).toBe("https://www.facebook.com/groups/1/posts/42/");
    expect(post.text).toBe("Linje 1\n\nLinje 2");
    expect(post.timeText).toBe("3 t");
  });

  it("afviser opslag uden tekst", () => {
    expect(() => toScrapedPost({ index: 3, permalink: null, timeText: null, text: "   ", hasNestedArticles: false })).toThrow(PostParseError);
  });

  it("normalizePostText fjerner gentagne tomme linjer", () => {
    expect(normalizePostText("a\n\n\n\nb")).toBe("a\n\nb");
  });
});

describe("postKey", () => {
  it("bruger Facebook-id når det findes, ellers en stabil hash", () => {
    expect(postKey("g1", { facebookPostId: "42", permalink: null, text: "x", timeText: null })).toBe("42");
    const a = postKey("g1", { facebookPostId: null, permalink: null, text: "samme tekst", timeText: null });
    const b = postKey("g1", { facebookPostId: null, permalink: null, text: "samme tekst", timeText: null });
    const c = postKey("g2", { facebookPostId: null, permalink: null, text: "samme tekst", timeText: null });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith("hash:g1:")).toBe(true);
  });
});

describe("DOM-udtræk i Chromium (fixture der efterligner et gruppe-feed)", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    const executablePath = process.env.RADAR_CHROMIUM_PATH || undefined;
    browser = await chromium.launch(executablePath ? { executablePath } : {});
    page = await browser.newPage();
    const html = fs.readFileSync(path.join(here, "fixtures", "group-feed.html"), "utf8");
    await page.setContent(html);
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("finder kun top-niveau opslag og ignorerer kommentarer", async () => {
    const candidates = await extractRawCandidates(page);
    expect(candidates).toHaveLength(4);

    const first = candidates[0]!;
    expect(first.permalink).toContain("/posts/9876543210/");
    expect(first.timeText).toBe("3 t");
    expect(first.text).toContain("Har fået budt 500 kr.");
    expect(first.text).not.toContain("Kommentar:");
    expect(first.hasNestedArticles).toBe(true);
  });

  it("falder tilbage til tekstblokke når message-markeringen mangler", async () => {
    const candidates = await extractRawCandidates(page);
    const second = candidates[1]!;
    expect(second.permalink).toContain("/permalink/1122334455/");
    expect(second.text).toContain("Sælges: 151 ETB");
    expect(second.text).not.toContain("Bente Bentsen");
  });

  it("håndterer opslag uden permalink og opslag uden tekst uden at vælte", async () => {
    const candidates = await extractRawCandidates(page);
    const third = toScrapedPost(candidates[2]!);
    expect(third.facebookPostId).toBeNull();
    expect(third.text).toContain("Evolving Skies");

    expect(() => toScrapedPost(candidates[3]!)).toThrow(PostParseError);
    expect(candidates[3]!.permalink).toContain("pfbid02AbCdEfGh123");
  });

  it("registrerer logget-ind-tilstand ud fra DOM'en", async () => {
    expect(await detectAuthState(page)).toBe("logged_in");
    await page.setContent('<form action="/login/device-based/"><input name="email"></form>');
    expect(await detectAuthState(page)).toBe("logged_out");
  });
});
