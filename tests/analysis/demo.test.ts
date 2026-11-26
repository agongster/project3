/**
 * The demo kingdom must always show off every part of the game. These tests
 * run the real linter on it, so editing a demo file can't silently remove a
 * monster type.
 */
import { describe, expect, it } from "vitest";
import { analyzeDemo, analyzeDemoSources, DEMO_OTHER_FILES, DEMO_README, DEMO_REPO, DEMO_SOURCES } from "@/lib/analysis/demo";
import { nodeLintClient } from "./nodeLint";
import type { MonsterKind } from "@/lib/types";
import { createNodeLint } from "./nodeLint";

const analysis = analyzeDemoSources(createNodeLint());
const fileAt = (path: string) => analysis.files.find((f) => f.path === path)!;

describe("demo kingdom", () => {
  it("is a believable little repo", () => {
    expect(DEMO_REPO.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(analysis.demo).toBe(true);
    expect(DEMO_SOURCES.length).toBeGreaterThanOrEqual(14);
    const topLevelDirs = new Set(DEMO_SOURCES.map((f) => f.path.split("/")).filter((parts) => parts.length > 1).map((parts) => parts[0]));
    expect(topLevelDirs.size).toBeGreaterThanOrEqual(3);
    expect(analysis.files.every((f) => f.status === "ok")).toBe(true);
  });

  it("has every elite monster and at least one boss", () => {
    const kinds = new Set(analysis.files.flatMap((f) => f.findings.map((finding) => finding.monster)));
    const elites: MonsterKind[] = ["gremlin", "phantom", "mimic", "swallowToad", "spaghetti"];
    for (const elite of elites) expect(kinds).toContain(elite);
    expect(kinds).toContain("keyThief");
    expect(kinds).toContain("evalSerpent");
    expect(kinds).toContain("glitchKing");
    expect(analysis.stats.bySeverity.boss).toBeGreaterThanOrEqual(1);
  });

  it("has clean treasure houses of different quality, including an S", () => {
    const cleanGrades = analysis.files.filter((f) => f.findings.length === 0).map((f) => f.quality.grade);
    expect(cleanGrades).toContain("S");
    expect(cleanGrades).toContain("A");
    expect(cleanGrades).toContain("B");
    expect(fileAt("bakery/oven.py").quality.grade).toBe("S");
  });

  it("classifies file kinds", () => {
    expect(fileAt("bakery/__init__.py").kind).toBe("init");
    expect(fileAt("tests/test_oven.py").kind).toBe("test");
    expect(fileAt("main.py").kind).toBe("script");
    expect(fileAt("bakery/orders.py").kind).toBe("module");
  });

  it("has sane stats", () => {
    const { stats } = analysis;
    expect(stats.fileCount).toBe(DEMO_SOURCES.length);
    expect(stats.cleanFiles + stats.buggyFiles).toBe(stats.fileCount);
    expect(stats.findingCount).toBe(stats.bySeverity.minion + stats.bySeverity.elite + stats.bySeverity.boss);
    expect(stats.findingCount).toBe(analysis.files.reduce((sum, f) => sum + f.findings.length, 0));
    expect(stats.lineCount).toBeGreaterThan(200);
    for (const file of analysis.files) expect(file.findings.length).toBeLessThanOrEqual(10);
  });

  it("gives every finding a unique id and a snippet that contains its line", () => {
    const ids = analysis.files.flatMap((f) => f.findings.map((finding) => finding.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const finding of analysis.files.flatMap((f) => f.findings)) {
      expect(finding.snippet.some((line) => line.hit && line.n === finding.line)).toBe(true);
    }
  });

  it("has a few non-Python files for the Workshop, the README being the one the town quotes", () => {
    const paths = DEMO_OTHER_FILES.map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(["README.md", "requirements.txt", "pyproject.toml"]));
    expect(DEMO_OTHER_FILES.find((f) => f.path === "README.md")?.text).toBe(DEMO_README);
    expect(paths.some((path) => path.endsWith(".py"))).toBe(false);
  });

  it("analyzeDemo (the developer pages' analysis) matches the Node-linted demo", async () => {
    const viaWorker = await analyzeDemo(() => undefined, undefined, { createLintClient: nodeLintClient, sleep: async () => undefined });
    expect(viaWorker).toEqual(analysis);
  });
});
