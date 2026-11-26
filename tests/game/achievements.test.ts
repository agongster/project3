/**
 * Achievements: every badge has a rule, each rule fires exactly at its
 * threshold, and earned badges are stored per player and pay once.
 */
import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_GOALS,
  ACHIEVEMENT_REWARD,
  ACHIEVEMENT_RULES,
  isRestoredByHand,
  newAchievements,
  unlockAchievements,
} from "@/lib/game/achievements";
import type { AchievementFacts, AchievementId } from "@/lib/game/achievements";
import { emptyProgress } from "@/lib/game/progress";
import { settleQuests } from "@/lib/game/questsSettle";
import { emptyWorkshop } from "@/lib/game/questsStreak";
import type { WorkshopCounts } from "@/lib/game/questsTypes";
import { defaultSave } from "@/lib/game/store";
import { KEY, makeAnalysis, makeFile, makeFinding, saveWith } from "./helpers";

function facts(change: { counts?: Partial<WorkshopCounts>; bestStreak?: number; stats?: Partial<AchievementFacts["stats"]>; questsDoneHere?: number; restoredByHand?: boolean } = {}): AchievementFacts {
  const workshop = emptyWorkshop();
  return {
    stats: { ...defaultSave().stats, ...change.stats },
    workshop: { ...workshop, bestStreak: change.bestStreak ?? 0, counts: { ...workshop.counts, ...change.counts } },
    questsDoneHere: change.questsDoneHere ?? 0,
    restoredByHand: change.restoredByHand ?? false,
  };
}

const earned = (f: AchievementFacts): AchievementId[] => newAchievements(f).map((achievement) => achievement.id);

describe("the achievement list", () => {
  it("has a dozen or so badges with unique ids, a title, a hint and an icon", () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.title.length).toBeGreaterThan(0);
      expect(achievement.how).toMatch(/\.$/);
      expect(ACHIEVEMENT_RULES[achievement.id]).toBeTypeOf("function");
    }
  });

  it("a brand-new player has earned nothing", () => {
    expect(earned(facts())).toEqual([]);
  });
});

describe("each achievement's condition", () => {
  // [badge, the facts that just miss it, the facts that just earn it]
  const cases: [AchievementId, Parameters<typeof facts>[0], Parameters<typeof facts>[0]][] = [
    ["first-fix", { stats: { realFixes: 0 } }, { stats: { realFixes: 1 } }],
    ["many-fixes", { stats: { realFixes: ACHIEVEMENT_GOALS.manyFixes - 1 } }, { stats: { realFixes: ACHIEVEMENT_GOALS.manyFixes } }],
    ["hand-purified", { counts: { handPurified: 0 } }, { counts: { handPurified: 1 } }],
    ["boss-mended", { counts: { bossesMended: 0 } }, { counts: { bossesMended: 1 } }],
    ["top-marks", { counts: { raisedToS: 0 } }, { counts: { raisedToS: 1 } }],
    ["short-streak", { bestStreak: ACHIEVEMENT_GOALS.shortStreak - 1 }, { bestStreak: ACHIEVEMENT_GOALS.shortStreak }],
    ["long-streak", { bestStreak: ACHIEVEMENT_GOALS.longStreak - 1 }, { bestStreak: ACHIEVEMENT_GOALS.longStreak }],
    ["first-quest", { counts: { questsDone: 0 } }, { counts: { questsDone: 1 } }],
    ["board-cleared", { questsDoneHere: ACHIEVEMENT_GOALS.boardQuests - 1 }, { questsDoneHere: ACHIEVEMENT_GOALS.boardQuests }],
    ["lamplighter", { counts: { lanternsLit: ACHIEVEMENT_GOALS.lanterns - 1 } }, { counts: { lanternsLit: ACHIEVEMENT_GOALS.lanterns } }],
    ["restored", { restoredByHand: false }, { restoredByHand: true }],
    ["first-squash", { stats: { bugsSquashed: 0 } }, { stats: { bugsSquashed: 1 } }],
    ["monster-hunter", { stats: { bugsSquashed: ACHIEVEMENT_GOALS.monsters - 1 } }, { stats: { bugsSquashed: ACHIEVEMENT_GOALS.monsters } }],
    ["first-dungeon", { stats: { dungeonsCleared: 0 } }, { stats: { dungeonsCleared: 1 } }],
    ["sharp-eye", { stats: { fixesPicked: ACHIEVEMENT_GOALS.fixesPicked - 1 } }, { stats: { fixesPicked: ACHIEVEMENT_GOALS.fixesPicked } }],
    ["well-wisher", { stats: { wishes: ACHIEVEMENT_GOALS.wishes - 1 } }, { stats: { wishes: ACHIEVEMENT_GOALS.wishes } }],
  ];

  it("covers every achievement", () => {
    expect(cases.map(([id]) => id).sort()).toEqual(ACHIEVEMENTS.map((a) => a.id).sort());
  });

  it.each(cases)("%s: not one short of it, but exactly at it", (id, almost, enough) => {
    expect(ACHIEVEMENT_RULES[id](facts(almost))).toBe(false);
    expect(ACHIEVEMENT_RULES[id](facts(enough))).toBe(true);
  });

  it("an already earned badge is not earned again", () => {
    const f = facts({ stats: { realFixes: 1 } });
    expect(earned({ ...f, workshop: { ...f.workshop, achievements: ["first-fix"] } })).toEqual([]);
  });
});

describe("Kingdom Restored", () => {
  const bug = (line: number) => makeFinding("a.py", line);

  it("needs Repo Health at 100% and at least half of the bugs fixed by hand", () => {
    const file = { ...makeFile("a.py", { findings: [bug(1), bug(2)] }), realFixes: 2 };
    const analysis = makeAnalysis([file]);
    expect(isRestoredByHand(analysis, emptyProgress())).toBe(false);
    expect(isRestoredByHand(analysis, { ...emptyProgress(), defeated: [bug(1).id] })).toBe(false);
    expect(isRestoredByHand(analysis, { ...emptyProgress(), defeated: [bug(1).id, bug(2).id] })).toBe(true);
    const mostlyFought = makeAnalysis([{ ...file, realFixes: 1 }]);
    expect(isRestoredByHand(mostlyFought, { ...emptyProgress(), defeated: [bug(1).id, bug(2).id] })).toBe(false);
  });

  it("is not handed out for a repo that was spotless from the start", () => {
    expect(isRestoredByHand(makeAnalysis([makeFile("clean.py")]), emptyProgress())).toBe(false);
    expect(isRestoredByHand(makeAnalysis([{ ...makeFile("clean.py"), realFixes: 3 }]), emptyProgress())).toBe(true);
  });
});

describe("unlocking", () => {
  it("records new badges per player, in gallery order, and returns the same save when there are none", () => {
    const veteran = saveWith({ stats: { ...defaultSave().stats, bugsSquashed: 120, dungeonsCleared: 4, wishes: 10, fixesPicked: 5 } });
    const analysis = makeAnalysis([makeFile("a.py")]);
    const { save, unlocked } = unlockAchievements(veteran, KEY, analysis);
    expect(unlocked.map((a) => a.id)).toEqual(["first-squash", "monster-hunter", "first-dungeon", "sharp-eye", "well-wisher"]);
    expect(save.workshop?.achievements).toEqual(unlocked.map((a) => a.id));
    expect(save.repos).toBe(veteran.repos);
    expect(unlockAchievements(save, KEY, analysis).save).toBe(save);
  });

  it("pays ACHIEVEMENT_REWARD once per badge through settleQuests", () => {
    const save = saveWith({ stats: { ...defaultSave().stats, bugsSquashed: 1 } });
    const analysis = makeAnalysis([makeFile("a.py")]);
    const first = settleQuests(save, KEY, analysis, null);
    expect(first.news).toContainEqual({ type: "achievement", achievement: ACHIEVEMENTS.find((a) => a.id === "first-squash"), reward: ACHIEVEMENT_REWARD });
    expect(first.save.coins).toBe(ACHIEVEMENT_REWARD.coins);
    expect(settleQuests(first.save, KEY, analysis, null).save).toBe(first.save);
  });
});
