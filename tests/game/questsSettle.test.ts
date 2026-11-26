/**
 * settleQuests: the one reducer the game calls. It posts the board, pays
 * each completed quest once, keeps the forge streak, unlocks achievements,
 * and does nothing at all when called again with the same inputs.
 */
import { describe, expect, it } from "vitest";
import { analyzeFile } from "@/lib/analysis/analyzeSources";
import { analyzeDemoSources, DEMO_SOURCES } from "@/lib/analysis/demo";
import { getProgress, levelForXp } from "@/lib/game/progress";
import { ACHIEVEMENT_REWARD } from "@/lib/game/achievements";
import { QUEST_REWARDS } from "@/lib/game/quests";
import { settleQuests } from "@/lib/game/questsSettle";
import { STREAK_BONUS_CAP, emptyWorkshop, forgeVerdict, streakBonus } from "@/lib/game/questsStreak";
import type { AnalyzedFile, RepoAnalysis, SaveData } from "@/lib/types";
import type { ForgeReport } from "@/lib/workspace/contract";
import { createNodeLint } from "../analysis/nodeLint";
import { deepFreeze, KEY, makeFinding, saveWith } from "./helpers";

const lint = createNodeLint();
const demo = analyzeDemoSources(lint);

function forged(analysis: RepoAnalysis, path: string, from: string, to: string, realFixes = 0): RepoAnalysis {
  const source = DEMO_SOURCES.find((f) => f.path === path)!.source.replace(from, to);
  const file: AnalyzedFile = { ...analyzeFile({ path, size: source.length, source }, lint), realFixes };
  return { ...analysis, files: analysis.files.map((f) => (f.path === path ? file : f)) };
}

function report(path: string, change: Partial<ForgeReport> = {}): ForgeReport {
  return {
    path,
    linted: true,
    fixed: [],
    introduced: [],
    kept: [],
    before: { grade: "B", score: 60, findingCount: 1 },
    after: { grade: "B", score: 70, findingCount: 0 },
    purified: false,
    file: null,
    ...change,
  };
}

/** A clean forge fixing one made-up finding in `path` (each call gets a different one, like real forges). */
let nextLine = 1;
function cleanForge(path = "a.py"): ForgeReport {
  const finding = makeFinding(path, nextLine++);
  return report(path, { fixed: [finding], before: { grade: "B", score: 50 + nextLine, findingCount: 1 }, after: { grade: "B", score: 60 + nextLine, findingCount: 0 } });
}

/** A save whose board for the demo is already posted. */
function postedSave(save: SaveData = saveWith({})): SaveData {
  return settleQuests(save, KEY, demo, null).save;
}

describe("settleQuests", () => {
  it("posts the board on the first call, pays nothing, and then does nothing", () => {
    const save = deepFreeze(saveWith({}));
    const first = settleQuests(save, KEY, demo, null);
    expect(first.news).toEqual([]);
    expect(first.coins).toBe(0);
    expect(getProgress(first.save, KEY).quests?.active).toHaveLength(5);
    const second = settleQuests(first.save, KEY, demo, null);
    expect(second.save).toBe(first.save);
    expect(second.news).toEqual([]);
  });

  it("pays a completed quest once, announces it, and is idempotent", () => {
    const save = postedSave();
    const fixed = forged(demo, "bakery/recipes.py", "import os\n", "");
    const forge = report("bakery/recipes.py", { fixed: [demo.files.find((f) => f.path === "bakery/recipes.py")!.findings[0]] });
    const first = settleQuests(save, KEY, fixed, forge);

    const quests = first.news.filter((item) => item.type === "quest");
    expect(quests).toHaveLength(1);
    expect(quests[0]).toMatchObject({ quest: { kind: "fix", title: "Remove the unused import at line 3 of bakery/recipes.py", progress: { done: true } } });
    // ("First Real Fix" waits for applyForge's count of real fixes: see questsWorkspace.test.ts.)
    const achievements = first.news.filter((item) => item.type === "achievement").map((item) => item.type === "achievement" && item.achievement.id);
    expect(achievements).toEqual(["first-quest"]);
    const expectedCoins = QUEST_REWARDS.fix.coins + ACHIEVEMENT_REWARD.coins;
    expect(first.coins).toBe(expectedCoins);
    expect(first.save.coins).toBe(save.coins + expectedCoins);
    expect(first.save.xp).toBe(save.xp + first.xp);

    const again = settleQuests(first.save, KEY, fixed, forge);
    expect(again.save).toBe(first.save);
    expect(again.news).toEqual([]);
    expect(again.coins).toBe(0);
  });

  it("never mutates the save it is given", () => {
    const save = deepFreeze(postedSave());
    const fixed = forged(demo, "bakery/recipes.py", "import os\n", "");
    expect(() => settleQuests(save, KEY, fixed, cleanForge("bakery/recipes.py"))).not.toThrow();
  });

  it("announces a level-up when quest rewards push the player over a level", () => {
    const save = postedSave(saveWith({ xp: 39 }));
    const fixed = forged(demo, "bakery/recipes.py", "import os\n", "");
    const result = settleQuests(save, KEY, fixed, null);
    expect(result.news.at(-1)).toEqual({ type: "levelUp", level: 2, title: levelForXp(result.save.xp).title });
  });

  it("keeps other repos' boards apart", () => {
    const save = postedSave();
    const other = settleQuests(save, "someone/else@123456789012", demo, null).save;
    expect(getProgress(other, KEY).quests).toEqual(getProgress(save, KEY).quests);
  });
});

describe("the forge streak", () => {
  const streakOf = (save: SaveData) => save.workshop?.streak ?? 0;

  it("grows with clean forges and pays a small growing bonus from ×2 on, up to a cap", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 20].map(streakBonus)).toEqual([0, 5, 10, 15, 20, 25, 25, 25]);
    expect(streakBonus(50)).toBe(STREAK_BONUS_CAP);

    let save = postedSave();
    const bonuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      const result = settleQuests(save, KEY, demo, cleanForge());
      const streakNews = result.news.find((item) => item.type === "streak");
      bonuses.push(streakNews?.type === "streak" ? streakNews.reward.coins : -1);
      save = result.save;
    }
    expect(streakOf(save)).toBe(3);
    expect(bonuses).toEqual([0, 5, 10]);
    expect(save.workshop?.bestStreak).toBe(3);
  });

  it("starts over (and says so) when a forge introduces a bug, without any other penalty", () => {
    let save = postedSave();
    save = settleQuests(save, KEY, demo, cleanForge()).save;
    save = settleQuests(save, KEY, demo, cleanForge()).save;
    const coins = save.coins;
    const broken = report("a.py", { fixed: [makeFinding("a.py", 900)], introduced: [makeFinding("a.py", 901)] });
    const result = settleQuests(save, KEY, demo, broken);
    expect(result.news).toContainEqual({ type: "streakLost", streak: 2 });
    expect(streakOf(result.save)).toBe(0);
    expect(result.save.workshop?.bestStreak).toBe(2);
    expect(result.save.coins).toBeGreaterThanOrEqual(coins);
  });

  it("is untouched by forges that change no finding, or by files that are not Python", () => {
    let save = postedSave();
    save = settleQuests(save, KEY, demo, cleanForge()).save;
    const docstringOnly = report("a.py", { before: { grade: "B", score: 60, findingCount: 0 }, after: { grade: "A", score: 72, findingCount: 0 } });
    expect(forgeVerdict(docstringOnly)).toBe("neutral");
    expect(streakOf(settleQuests(save, KEY, demo, docstringOnly).save)).toBe(1);
    const readme = report("README.md", { linted: false, introduced: [makeFinding("README.md", 1)] });
    const afterReadme = settleQuests(save, KEY, demo, readme);
    expect(afterReadme.save).toBe(save);
  });

  it("counts the same report only once", () => {
    const save = postedSave();
    const forge = cleanForge();
    const once = settleQuests(save, KEY, demo, forge).save;
    const twice = settleQuests(once, KEY, demo, forge).save;
    expect(twice).toBe(once);
    expect(streakOf(twice)).toBe(1);
    expect(twice.workshop?.bestStreak).toBe(1);
  });

  it("counts real fixes, hand-purified files, files raised to S, and bosses mended before they were fought", () => {
    const boss = makeFinding("config.py", 7, "keyThief");
    const fought = makeFinding("config.py", 8, "evalSerpent");
    let save = postedSave();
    const forge = report("config.py", {
      fixed: [boss, fought],
      purified: true,
      before: { grade: "A", score: 80, findingCount: 2 },
      after: { grade: "S", score: 95, findingCount: 0 },
    });
    // applyForge has already forgotten both ids; the caller hands in who was fought before the forge.
    save = settleQuests(save, KEY, demo, forge, [fought.id]).save;
    expect(save.workshop?.counts).toMatchObject({ handPurified: 1, raisedToS: 1, bossesMended: 1 });
  });

  it("starts from an empty record for a save from before the Workshop", () => {
    expect(saveWith({}).workshop).toBeUndefined();
    expect(emptyWorkshop()).toMatchObject({ streak: 0, bestStreak: 0, achievements: [] });
  });
});
