/**
 * Small fixture builders shared by the game-logic tests: fake findings,
 * files and analyses, a deep-freeze helper (so any accidental mutation of an
 * input save throws), and a validator for the save invariants.
 */
import { emptyOutline } from "@/lib/analysis/outline";
import { expect } from "vitest";
import { ALL_ITEMS, MAX_CHARMS, MONSTERS, THEMES, getItem } from "@/lib/game/catalog";
import { MAX_SAVED_REPOS } from "@/lib/game/progress";
import { LOOK_OPTION_COUNTS, defaultSave } from "@/lib/game/store";
import type { AnalyzedFile, Finding, Grade, MonsterKind, RepoAnalysis, RepoRef, SaveData } from "@/lib/types";

export const REPO: RepoRef = { owner: "octocat", repo: "potions", ref: "main", sha: "abc123def4567890abc123def4567890abc123de" };

/** The repo key used by most tests (same shape as `repoKey()` in bridge.ts). */
export const KEY = "octocat/potions@abc123def456";

export const STARTER_IDS = ALL_ITEMS.filter((item) => item.starter).map((item) => item.id);

/** Owns a non-starter weapon and a charm, so the beginner's-luck chest rule is switched off. */
export const VETERAN_OWNED = [...STARTER_IDS, "bugNet", "hotCoffee"];

export function makeFinding(
  path: string,
  line: number,
  monster: MonsterKind = "dustBunny",
  overrides: Partial<Finding> = {},
): Finding {
  const code = overrides.code ?? "F401";
  return {
    id: `${path}:${line}:1:${code}`,
    path,
    code,
    title: "Unused import",
    message: "`os` imported but unused",
    line,
    col: 1,
    endLine: line,
    endCol: 10,
    severity: MONSTERS[monster].severity,
    category: "unused",
    monster,
    snippet: [{ n: line, text: "import os", hit: true }],
    tip: "Delete the import.",
    ...overrides,
  };
}

export function makeFile(
  path: string,
  options: {
    findings?: Finding[];
    grade?: Grade;
    overflow?: number;
    highlights?: string[];
    status?: AnalyzedFile["status"];
  } = {},
): AnalyzedFile {
  return {
    path,
    size: 1200,
    lineCount: 40,
    status: options.status ?? "ok",
    kind: "module",
    findings: options.findings ?? [],
    overflow: options.overflow ?? 0,
    quality: {
      score: 80,
      grade: options.grade ?? "B",
      highlights: options.highlights ?? [],
      metrics: { definitions: 3, docCoverage: 1, hintCoverage: 1, commentRatio: 0.1, probeHits: 0 },
    },
    outline: emptyOutline(),
  };
}

export function makeAnalysis(files: AnalyzedFile[], repo: Partial<RepoRef> = {}): RepoAnalysis {
  const findings = files.flatMap((file) => file.findings);
  return {
    repo: { ...REPO, ...repo },
    description: "A test kingdom",
    stars: 7,
    files,
    stats: {
      fileCount: files.length,
      lineCount: files.reduce((sum, file) => sum + file.lineCount, 0),
      findingCount: findings.length,
      bySeverity: {
        minion: findings.filter((f) => f.severity === "minion").length,
        elite: findings.filter((f) => f.severity === "elite").length,
        boss: findings.filter((f) => f.severity === "boss").length,
      },
      cleanFiles: files.filter((file) => file.findings.length === 0).length,
      buggyFiles: files.filter((file) => file.findings.length > 0).length,
    },
    warnings: [],
    demo: false,
  };
}

/** A default save with some fields replaced. */
export function saveWith(overrides: Partial<SaveData>): SaveData {
  return { ...defaultSave(), ...overrides };
}

/** Recursively freezes a value, so any mutation attempt throws (tests run in strict mode). */
export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Asserts every invariant a save must satisfy after `sanitizeSave`. */
export function expectValidSave(save: SaveData): void {
  expect(save.version).toBe(1);
  expect(typeof save.created).toBe("boolean");

  expect(typeof save.look.name).toBe("string");
  expect(save.look.name.length).toBeGreaterThan(0);
  const fields = Object.keys(LOOK_OPTION_COUNTS) as (keyof typeof LOOK_OPTION_COUNTS)[];
  for (const [index, size] of fields.map((field) => [save.look[field], LOOK_OPTION_COUNTS[field]])) {
    expect(Number.isInteger(index)).toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(size);
  }

  expect(THEMES.map((t) => t.id)).toContain(save.theme);
  for (const value of [save.coins, save.xp]) {
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  }

  expect(new Set(save.owned).size).toBe(save.owned.length);
  for (const id of save.owned) expect(getItem(id)).toBeDefined();
  for (const id of STARTER_IDS) expect(save.owned).toContain(id);

  const { weapon, hat, pet, trail, charms } = save.equipped;
  expect(save.owned).toContain(weapon);
  expect(getItem(weapon)?.slot).toBe("weapon");
  for (const [id, slot] of [
    [hat, "hat"],
    [pet, "pet"],
    [trail, "trail"],
  ] as const) {
    if (id !== null) {
      expect(save.owned).toContain(id);
      expect(getItem(id)?.slot).toBe(slot);
    }
  }
  expect(charms.length).toBeLessThanOrEqual(MAX_CHARMS);
  expect(new Set(charms).size).toBe(charms.length);
  for (const id of charms) {
    expect(save.owned).toContain(id);
    expect(getItem(id)?.slot).toBe("charm");
  }

  for (const value of [...Object.values(save.gacha), ...Object.values(save.stats)]) {
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  }
  expect(save.settings.sfx).toBeGreaterThanOrEqual(0);
  expect(save.settings.sfx).toBeLessThanOrEqual(1);
  expect(save.settings.music).toBeGreaterThanOrEqual(0);
  expect(save.settings.music).toBeLessThanOrEqual(1);
  expect(typeof save.settings.screenShake).toBe("boolean");

  expect(Object.keys(save.repos).length).toBeLessThanOrEqual(MAX_SAVED_REPOS);
  expect(Object.getPrototypeOf(save.repos)).toBe(Object.prototype);
  for (const progress of Object.values(save.repos)) {
    for (const list of [progress.defeated, progress.cleared, progress.opened]) {
      expect(list.every((entry) => typeof entry === "string")).toBe(true);
    }
    expect([25, 50, 75, 100]).toEqual(expect.arrayContaining(progress.milestones));
  }
}
