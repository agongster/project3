/** Unit tests for the pure helpers behind the app shell and HUD. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { heartStates } from "@/components/hud/Hearts";
import { createFeed, MAX_TOASTS, TOAST_LIFETIME_MS, BANNER_LIFETIME_MS } from "@/components/hud/feed";
import { recentTargets } from "@/components/screens/title/recentRepos";
import { overallProgress } from "@/components/screens/loading/useWorldLoader";
import { gameScale } from "@/components/app/useGameScale";
import { overlayForEvent, announceEvent } from "@/components/app/gameEvents";
import { worldTeaser } from "@/components/screens/loading/WorldReadyCard";
import { analyzeDemoSources } from "@/lib/analysis/demo";

describe("heartStates", () => {
  it("splits half-hearts into containers", () => {
    expect(heartStates(7, 10)).toEqual(["heartFull", "heartFull", "heartFull", "heartHalf", "heartEmpty"]);
    expect(heartStates(0, 6)).toEqual(["heartEmpty", "heartEmpty", "heartEmpty"]);
    expect(heartStates(12, 12)).toHaveLength(6);
    expect(heartStates(5, 11)).toHaveLength(6);
  });
});

describe("feed", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("keeps at most MAX_TOASTS, newest last, and expires them", () => {
    const feed = createFeed();
    for (let i = 0; i < 6; i++) feed.toast({ text: `t${i}`, tone: "info" });
    expect(feed.store.get().toasts.map((t) => t.text)).toEqual(["t2", "t3", "t4", "t5"].slice(-MAX_TOASTS));
    vi.advanceTimersByTime(TOAST_LIFETIME_MS - 100);
    expect(feed.store.get().toasts.every((t) => t.leaving)).toBe(true);
    vi.advanceTimersByTime(200);
    expect(feed.store.get().toasts).toEqual([]);
  });
  it("queues banners one after another", () => {
    const feed = createFeed();
    feed.banner({ title: "A", tone: "purify" });
    feed.banner({ title: "B", tone: "level" });
    expect(feed.store.get().banners[0].title).toBe("A");
    vi.advanceTimersByTime(BANNER_LIFETIME_MS + 1);
    expect(feed.store.get().banners[0].title).toBe("B");
    vi.advanceTimersByTime(BANNER_LIFETIME_MS + 1);
    expect(feed.store.get().banners).toEqual([]);
  });
});

describe("recentTargets", () => {
  it("newest first, no demo, no repeats, max 3", () => {
    const keys = ["a/x@1", "lintlands/demo-kingdom@2", "b/y@3", "a/x@4", "c/z@5", "d/w@6"];
    expect(recentTargets(keys).map((t) => (t.kind === "repo" ? `${t.owner}/${t.repo}` : "demo"))).toEqual(["d/w", "c/z", "a/x"]);
    expect(recentTargets(["garbage"])).toEqual([]);
  });
});

describe("overallProgress", () => {
  it("is monotonic across stages and ends at 1", () => {
    const seq = [
      overallProgress(null),
      overallProgress({ stage: "listing", done: 0, total: 0, label: "" }),
      overallProgress({ stage: "downloading", done: 5, total: 10, label: "" }),
      overallProgress({ stage: "downloading", done: 10, total: 10, label: "" }),
      overallProgress({ stage: "linting", done: 3, total: 10, label: "" }),
      overallProgress({ stage: "building", done: 0, total: 0, label: "" }),
      overallProgress({ stage: "done", done: 0, total: 0, label: "" }),
    ];
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
    expect(seq.at(-1)).toBe(1);
  });
});

describe("gameScale", () => {
  it("picks the biggest whole zoom that fits, at least 1", () => {
    expect(gameScale(1440, 900)).toBe(3);
    expect(gameScale(1024, 640)).toBe(2);
    expect(gameScale(300, 200)).toBe(1);
    expect(gameScale(1600, 900)).toBe(4);
  });
});

describe("game events", () => {
  it("maps pausing events to overlays and news to the feed", () => {
    expect(overlayForEvent({ type: "menu" })).toEqual({ kind: "pause" });
    expect(overlayForEvent({ type: "dialog", speaker: "Sign", lines: ["hi"] })).toEqual({ kind: "dialog", speaker: "Sign", lines: ["hi"] });
    expect(overlayForEvent({ type: "toast", text: "x", tone: "info" })).toBeNull();
    vi.useFakeTimers();
    const feed = createFeed();
    const played: string[] = [];
    const audio = { unlock() {}, sfx: (n: string) => played.push(n), music() {}, setTheme() {}, setVolumes() {} };
    announceEvent({ type: "purified", path: "pkg/mod.py" }, feed, audio as never);
    expect(feed.store.get().banners[0]).toMatchObject({ title: "DUNGEON PURIFIED!", subtitle: "mod.py" });
    expect(played).toEqual(["purify"]);
    vi.useRealTimers();
  });
});

describe("worldTeaser", () => {
  // A linter that finds nothing, so every demo file is clean.
  const analysis = analyzeDemoSources(() => []);
  const isMarker = (file: (typeof analysis.files)[number]) => file.kind === "init" && file.lineCount <= 5;
  const markers = analysis.files.filter(isMarker);
  const houses = analysis.files.filter((file) => !isMarker(file));

  it("pluralises properly", () => {
    const stats = { ...analysis.stats, fileCount: 1, findingCount: 2, bySeverity: { minion: 0, elite: 0, boss: 1 } };
    expect(worldTeaser({ ...analysis, files: houses.slice(0, 3), stats })).toBe("1 file · 2 bugs · 1 boss · 3 treasure houses");
    expect(worldTeaser({ ...analysis, files: houses.slice(0, 1), stats })).toContain("1 treasure house");
  });

  it("does not count a near-empty __init__.py as a treasure house (it is only a lantern)", () => {
    expect(markers.length).toBeGreaterThan(0);
    expect(worldTeaser({ ...analysis, files: [...houses.slice(0, 2), ...markers] })).toContain("2 treasure houses");
  });
});
