import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, isPlaceholderUrl, loadConfig, loadGroups } from "../src/config/config.js";

function writeTemp(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "radar-config-"));
  const file = path.join(dir, "groups.json");
  fs.writeFileSync(file, content);
  return file;
}

describe("loadGroups", () => {
  it("læser grupper og springer pladsholdere over", () => {
    const file = writeTemp(
      JSON.stringify([
        { id: "a", name: "A", url: "https://www.facebook.com/groups/123" },
        { id: "b", name: "B", url: "GROUP_URL" },
      ]),
    );
    const { groups, skipped } = loadGroups(file);
    expect(groups.map((g) => g.id)).toEqual(["a"]);
    expect(skipped.map((g) => g.id)).toEqual(["b"]);
  });

  it("afviser dublerede id'er og ugyldigt format", () => {
    expect(() => loadGroups(writeTemp(JSON.stringify([{ id: "a", name: "A", url: "https://x" }, { id: "a", name: "B", url: "https://y" }])))).toThrow(ConfigError);
    expect(() => loadGroups(writeTemp(JSON.stringify({ not: "an array" })))).toThrow(ConfigError);
    expect(() => loadGroups(writeTemp("{ broken"))).toThrow(ConfigError);
    expect(() => loadGroups(path.join(os.tmpdir(), "findes-ikke.json"))).toThrow(ConfigError);
  });

  it("isPlaceholderUrl", () => {
    expect(isPlaceholderUrl("GROUP_URL")).toBe(true);
    expect(isPlaceholderUrl("")).toBe(true);
    expect(isPlaceholderUrl("facebook.com/groups/1")).toBe(true);
    expect(isPlaceholderUrl("https://www.facebook.com/groups/1")).toBe(false);
  });
});

describe("loadConfig", () => {
  it("vælger regelbaseret classifier uden API-nøgle og Anthropic med", () => {
    expect(loadConfig({}).classifier).toBe("rules");
    expect(loadConfig({ ANTHROPIC_API_KEY: "sk-test" }).classifier).toBe("anthropic");
    expect(loadConfig({ ANTHROPIC_API_KEY: "sk-test", RADAR_CLASSIFIER: "rules" }).classifier).toBe("rules");
  });

  it("bruger fornuftige defaults og parser miljøvariabler", () => {
    const c = loadConfig({});
    expect(c.maxPostsPerGroup).toBe(50);
    expect(c.dashboardPort).toBe(3742);
    expect(c.headless).toBe(false);
    expect(c.llmModel).toBe("claude-opus-5");
    expect(path.basename(c.dbPath)).toBe("radar.db");
    expect(path.basename(c.profileDir)).toBe("playwright-profile");

    const custom = loadConfig({ RADAR_MAX_POSTS_PER_GROUP: "20", RADAR_HEADLESS: "true", RADAR_PORT: "4000", RADAR_LOG_LEVEL: "debug" });
    expect(custom.maxPostsPerGroup).toBe(20);
    expect(custom.headless).toBe(true);
    expect(custom.dashboardPort).toBe(4000);
    expect(custom.logLevel).toBe("debug");
    expect(loadConfig({ RADAR_MAX_POSTS_PER_GROUP: "abc" }).maxPostsPerGroup).toBe(50);
  });

  it("accepterer kun kendte browser-kanaler", () => {
    expect(loadConfig({}).browserChannel).toBeUndefined();
    expect(loadConfig({ RADAR_BROWSER_CHANNEL: "chrome" }).browserChannel).toBe("chrome");
    expect(loadConfig({ RADAR_BROWSER_CHANNEL: "MSEdge" }).browserChannel).toBe("msedge");
    expect(loadConfig({ RADAR_BROWSER_CHANNEL: "firefox" }).browserChannel).toBeUndefined();
  });
});
