/**
 * applyForge (what saving code pays and how progress follows the code) and
 * Repo Health with real fixes. Fake reports, so every rule is checked on its own.
 */
import { describe, expect, it } from "vitest";
import { MONSTERS } from "@/lib/game/catalog";
import { applyForge, FIX_COIN_MULTIPLIER, fixCoins, fixXp } from "@/lib/game/forge";
import { getProgress, isDungeonCleared, repoHealth } from "@/lib/game/progress";
import { MAX_PAID_FIXES, sanitizeSave } from "@/lib/game/store";
import { allDungeonsCleared, buildingStatus } from "@/game/scenes/progressView";
import { MONSTER_KINDS, type AnalyzedFile, type Finding, type RepoProgress } from "@/lib/types";
import type { ForgeReport } from "@/lib/workspace";
import { deepFreeze, expectValidSave, KEY, makeAnalysis, makeFile, makeFinding, saveWith } from "./helpers";

const PATH = "potions/brew.py";

/** A report for PATH: `kept` as [before, after] pairs; the file shows `shown` and has fixed `realFixed` originals. */
function makeReport(options: { kept?: [Finding, Finding][]; fixed?: Finding[]; introduced?: Finding[]; shown?: Finding[]; realFixed?: Finding[] }): ForgeReport {
  const realFixed = options.realFixed ?? [];
  const file: AnalyzedFile = {
    ...makeFile(PATH, { findings: options.shown ?? [] }),
    ...(realFixed.length > 0 && { realFixes: realFixed.length, fixedFindings: realFixed }),
  };
  const kept = (options.kept ?? []).map(([before, after]) => ({ before, after }));
  const summary = { grade: "B" as const, score: 70, findingCount: 0 };
  return { path: PATH, linted: true, fixed: options.fixed ?? [], introduced: options.introduced ?? [], kept, before: summary, after: summary, purified: false, file };
}

const withProgress = (progress: Partial<RepoProgress>, coins = 0) =>
  deepFreeze(saveWith({ coins, repos: { [KEY]: { defeated: [], cleared: [], opened: [], milestones: [], ...progress } } }));

describe("applyForge: real fixes pay", () => {
  const bug = makeFinding(PATH, 5, "gremlin", { code: "F821" });

  it("pays clearly more than a fight, for every kind of monster", () => {
    for (const kind of MONSTER_KINDS) {
      expect(fixCoins({ monster: kind })).toBeGreaterThan(MONSTERS[kind].coins[1]);
      expect(fixXp({ monster: kind })).toBeGreaterThan(MONSTERS[kind].xp);
    }
    expect(fixCoins(bug)).toBe(FIX_COIN_MULTIPLIER * MONSTERS.gremlin.coins[1]);
  });

  it("pays once for each original finding fixed, and counts it in the lifetime stats", () => {
    const save = withProgress({}, 10);
    const { save: paidSave, paid } = applyForge(save, KEY, makeReport({ fixed: [bug], realFixed: [bug] }));
    expect(paid.coins).toBe(fixCoins(bug));
    expect(paid.xp).toBe(fixXp(bug));
    expect(paid.fixes).toEqual([bug]);
    expect(paidSave.coins).toBe(10 + fixCoins(bug));
    expect(paidSave.xp).toBe(fixXp(bug));
    expect(paidSave.stats.realFixes).toBe(1);
    expect(getProgress(paidSave, KEY).fixes).toEqual([bug.id]);
    expectValidSave(paidSave);

    // The same state again (e.g. a later forge that changed something else): nothing more.
    const again = applyForge(paidSave, KEY, makeReport({ realFixed: [bug] }));
    expect(again.save).toBe(paidSave);
    expect(again.paid.coins).toBe(0);
  });

  it("does not pay again when a fix is reverted and redone", () => {
    const first = applyForge(withProgress({}), KEY, makeReport({ fixed: [bug], realFixed: [bug] })).save;
    const reverted = applyForge(first, KEY, makeReport({ introduced: [bug], shown: [bug] })).save;
    const redone = applyForge(reverted, KEY, makeReport({ fixed: [bug], realFixed: [bug] }));
    expect(redone.paid.coins).toBe(0);
    expect(redone.save.coins).toBe(first.coins);
    expect(redone.save.stats.realFixes).toBe(1);
  });

  it("pays nothing for removing a bug the player wrote themselves", () => {
    const ownBug = makeFinding(PATH, 9, "dustBunny");
    const { save, paid } = applyForge(withProgress({}), KEY, makeReport({ fixed: [ownBug] }));
    expect(paid.coins).toBe(0);
    expect(save.coins).toBe(0);
  });

  it("reports a level-up", () => {
    const boss = makeFinding(PATH, 2, "keyThief", { code: "S105" });
    const { paid } = applyForge(withProgress({}), KEY, makeReport({ realFixed: [boss] }));
    expect(paid.leveledUp?.level).toBeGreaterThan(1);
  });

  it("remembers at most MAX_PAID_FIXES paid fixes", () => {
    const many = Array.from({ length: MAX_PAID_FIXES + 5 }, (_, i) => makeFinding(PATH, i + 1));
    const { save } = applyForge(withProgress({}), KEY, makeReport({ realFixed: many }));
    expect(getProgress(save, KEY).fixes).toHaveLength(MAX_PAID_FIXES);
  });

  it("ignores reports of files that weren't linted", () => {
    const save = withProgress({ defeated: [bug.id] });
    const report: ForgeReport = { ...makeReport({}), linted: false, file: null };
    expect(applyForge(save, KEY, report).save).toBe(save);
  });
});

describe("applyForge: progress follows the code", () => {
  const moved = (finding: Finding, by: number) => makeFinding(finding.path, finding.line + by, finding.monster, { code: finding.code });
  const a = makeFinding(PATH, 4, "dustBunny");
  const b = makeFinding(PATH, 8, "gremlin", { code: "F821" });

  it("renames defeated and bounty ids of findings that only moved", () => {
    const save = withProgress({ defeated: [a.id, "other.py:1:1:F401"], bounties: [b.id] });
    const report = makeReport({ kept: [[a, moved(a, 2)], [b, moved(b, 2)]], shown: [moved(a, 2), moved(b, 2)] });
    const progress = getProgress(applyForge(save, KEY, report).save, KEY);
    expect(progress.defeated).toEqual([moved(a, 2).id, "other.py:1:1:F401"]);
    expect(progress.bounties).toEqual([moved(b, 2).id]);
  });

  it("drops the ids of fixed findings, so a different bug landing there later isn't already beaten", () => {
    const save = withProgress({ defeated: [a.id] });
    const progress = getProgress(applyForge(save, KEY, makeReport({ fixed: [a], realFixed: [a] })).save, KEY);
    expect(progress.defeated).toEqual([]);
  });

  it("swaps ids correctly when findings trade places", () => {
    const first = makeFinding(PATH, 3, "dustBunny");
    const second = makeFinding(PATH, 4, "dustBunny");
    const save = withProgress({ defeated: [first.id] });
    // `first` moved down to line 4, `second` up to line 3.
    const report = makeReport({ kept: [[first, second], [second, first]], shown: [first, second] });
    expect(getProgress(applyForge(save, KEY, report).save, KEY).defeated).toEqual([second.id]);
  });

  it("makes a cleared dungeon live again when new bugs appear, without refilling its chest", () => {
    const fresh = makeFinding(PATH, 12, "phantom", { code: "F821" });
    const save = withProgress({ defeated: [a.id], cleared: [PATH], opened: [PATH] });
    const report = makeReport({ kept: [[a, a]], introduced: [fresh], shown: [a, fresh] });
    const next = applyForge(save, KEY, report).save;
    const progress = getProgress(next, KEY);
    expect(progress.cleared).toEqual([]);
    expect(progress.opened).toEqual([PATH]);
    expect(buildingStatus(next, KEY, report.file!)).toBe("cursed");
  });

  it("keeps a dungeon cleared while every monster in it is still defeated", () => {
    const save = withProgress({ defeated: [a.id], cleared: [PATH] });
    const report = makeReport({ kept: [[a, moved(a, 1)]], shown: [moved(a, 1)] });
    const next = applyForge(save, KEY, report).save;
    expect(getProgress(next, KEY).cleared).toEqual([PATH]);
    expect(isDungeonCleared(report.file!, getProgress(next, KEY))).toBe(true);
  });

  it("turns a file purified by editing into a treasure house (its chest still closed) or leaves it done", () => {
    const purified = makeReport({ fixed: [a], realFixed: [a], shown: [] });
    expect(buildingStatus(applyForge(withProgress({}), KEY, purified).save, KEY, purified.file!)).toBe("treasure");
    expect(buildingStatus(applyForge(withProgress({ opened: [PATH] }), KEY, purified).save, KEY, purified.file!)).toBe("done");
  });

  it("never changes the input save and returns the same save when nothing changes", () => {
    const save = withProgress({ defeated: [a.id] });
    expect(applyForge(save, KEY, makeReport({ kept: [[a, a]], shown: [a] })).save).toBe(save);
  });
});

describe("repoHealth with real fixes", () => {
  const bug1 = makeFinding("a.py", 1);
  const bug2 = makeFinding("a.py", 2);
  const boss = makeFinding("b.py", 3, "keyThief", { code: "S105" });
  const progress = (defeated: string[] = []): RepoProgress => ({ defeated, cleared: [], opened: [], milestones: [] });

  it("counts a fixed finding as dealt with, so fixing moves the bar forward", () => {
    const original = makeAnalysis([makeFile("a.py", { findings: [bug1, bug2] }), makeFile("b.py", { findings: [boss] })]);
    expect(repoHealth(original, progress()).ratio).toBe(0);
    const edited = makeAnalysis([{ ...makeFile("a.py", { findings: [bug2] }), realFixes: 1, fixedFindings: [bug1] }, makeFile("b.py", { findings: [boss] })]);
    const health = repoHealth(edited, progress());
    expect(health).toMatchObject({ defeated: 0, fixed: 1, total: 3 });
    expect(health.ratio).toBeCloseTo(1 / 3);
  });

  it("reaches 100% once everything is beaten or fixed, agreeing with the victory check", () => {
    const edited = makeAnalysis([{ ...makeFile("a.py"), realFixes: 2, fixedFindings: [bug1, bug2] }, makeFile("b.py", { findings: [boss] })]);
    const notYet = progress();
    expect(repoHealth(edited, notYet).ratio).toBeLessThan(1);
    expect(allDungeonsCleared(saveWith({ repos: { [KEY]: notYet } }), KEY, edited)).toBe(false);

    const done = progress([boss.id]);
    const health = repoHealth(edited, done);
    expect(health.ratio).toBe(1);
    expect(health).toMatchObject({ dungeonsCleared: 2, dungeonsTotal: 2 });
    expect(allDungeonsCleared(saveWith({ repos: { [KEY]: done } }), KEY, edited)).toBe(true);
  });

  it("does not count a defeated monster twice when its code is then fixed", () => {
    const edited = makeAnalysis([{ ...makeFile("a.py", { findings: [bug2] }), realFixes: 1, fixedFindings: [bug1] }]);
    const health = repoHealth(edited, progress([bug1.id]));
    expect(health).toMatchObject({ defeated: 0, fixed: 1, total: 2 });
  });
});

describe("saving Workshop progress", () => {
  it("loads an old save unchanged and keeps new fields only when used", () => {
    const old = sanitizeSave({ repos: { [KEY]: { defeated: ["x"], cleared: [], opened: [], milestones: [] } } });
    expect(old.stats.realFixes).toBeUndefined();
    expect(getProgress(old, KEY).fixes).toBeUndefined();
    expect(sanitizeSave(old)).toEqual(old);
  });

  it("bounds and cleans what it loads", () => {
    const loaded = sanitizeSave({
      stats: { realFixes: 3.7 },
      repos: { [KEY]: { fixes: ["a.py:1:1:F401", 7, "", "x".repeat(501), "a.py:1:1:F401", ...Array.from({ length: MAX_PAID_FIXES + 3 }, (_, i) => `b.py:${i}:1:F401`)] } },
    });
    expect(loaded.stats.realFixes).toBe(3);
    const fixes = getProgress(loaded, KEY).fixes!;
    expect(fixes).toHaveLength(MAX_PAID_FIXES);
    expect(fixes.every((id) => typeof id === "string" && id.length > 0 && id.length <= 500)).toBe(true);
    expect(sanitizeSave({ stats: { realFixes: -4 } }).stats.realFixes).toBeUndefined();
    expectValidSave(loaded);
  });
});
