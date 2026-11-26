import { describe, expect, it } from "vitest";
import { BASE_MAX_HP, LEVEL_TITLES, LEVEL_XP } from "@/lib/game/catalog";
import {
  BASE_MAGNET_RADIUS,
  MAX_LEVEL,
  MAX_SAVED_REPOS,
  aliveFindings,
  emptyProgress,
  fileTally,
  findingState,
  getProgress,
  isDungeon,
  isDungeonPurified,
  isDungeonQuiet,
  isRepoPurified,
  levelForXp,
  playerStats,
  repoHealth,
  subduedFindings,
  withRepoProgress,
} from "@/lib/game/progress";
import { defaultSave } from "@/lib/game/store";
import type { RepoProgress, SaveData } from "@/lib/types";
import { KEY, deepFreeze, makeAnalysis, makeFile, makeFinding, saveWith } from "./helpers";

function progressWith(overrides: Partial<RepoProgress>): RepoProgress {
  return { ...emptyProgress(), ...overrides };
}

/** A save that owns and wears the given charms (and optionally a pet / weapon). */
function wearing(charms: string[], extra: { pet?: string; weapon?: string; xp?: number } = {}): SaveData {
  const base = defaultSave();
  const owned = [...base.owned, ...charms, ...(extra.pet ? [extra.pet] : []), ...(extra.weapon ? [extra.weapon] : [])];
  return {
    ...base,
    xp: extra.xp ?? 0,
    owned,
    equipped: { ...base.equipped, charms, pet: extra.pet ?? null, weapon: extra.weapon ?? "twig" },
  };
}

describe("levelForXp", () => {
  it("starts at level 1 with an empty bar", () => {
    expect(levelForXp(0)).toEqual({ level: 1, title: LEVEL_TITLES[0], intoLevel: 0, forNext: 40, ratio: 0, isMax: false });
  });

  it("reports progress inside a level", () => {
    const info = levelForXp(39);
    expect(info.level).toBe(1);
    expect(info.intoLevel).toBe(39);
    expect(info.ratio).toBeCloseTo(39 / 40);
  });

  it("levels up exactly at each threshold", () => {
    LEVEL_XP.forEach((xp, index) => {
      expect(levelForXp(xp).level).toBe(index + 1);
      expect(levelForXp(xp).title).toBe(LEVEL_TITLES[index]);
      if (index > 0) expect(levelForXp(xp - 1).level).toBe(index);
    });
  });

  it("stays at the max level with a full bar", () => {
    for (const xp of [LEVEL_XP[MAX_LEVEL - 1], 99_999]) {
      const info = levelForXp(xp);
      expect(info.level).toBe(MAX_LEVEL);
      expect(info.isMax).toBe(true);
      expect(info.ratio).toBe(1);
      expect(info.forNext).toBe(0);
    }
  });

  it("treats negative or NaN xp as 0", () => {
    expect(levelForXp(-10).level).toBe(1);
    expect(levelForXp(Number.NaN).intoLevel).toBe(0);
  });
});

describe("playerStats", () => {
  it("has the plain base stats on a new save", () => {
    const stats = playerStats(defaultSave());
    expect(stats).toMatchObject({
      maxHp: BASE_MAX_HP,
      speedMult: 1,
      magnetRadius: BASE_MAGNET_RADIUS,
      coinMult: 1,
      dashCooldownMult: 1,
      regenEverySec: null,
      critChance: 0,
      thorns: 0,
      petPerk: null,
    });
    expect(stats.weapon.id).toBe("twig");
  });

  it("adds a heart at levels 3, 6 and 9", () => {
    expect(playerStats(saveWith({ xp: LEVEL_XP[1] })).maxHp).toBe(BASE_MAX_HP);
    expect(playerStats(saveWith({ xp: LEVEL_XP[2] })).maxHp).toBe(BASE_MAX_HP + 2);
    expect(playerStats(saveWith({ xp: LEVEL_XP[5] })).maxHp).toBe(BASE_MAX_HP + 4);
    expect(playerStats(saveWith({ xp: LEVEL_XP[8] })).maxHp).toBe(BASE_MAX_HP + 6);
    expect(playerStats(saveWith({ xp: LEVEL_XP[9] })).maxHp).toBe(BASE_MAX_HP + 6);
  });

  it("folds each charm effect", () => {
    expect(playerStats(wearing(["hotCoffee"])).speedMult).toBeCloseTo(1.15);
    expect(playerStats(wearing(["coinMagnet"])).magnetRadius).toBe(BASE_MAGNET_RADIUS + 40);
    expect(playerStats(wearing(["heartCookie"])).maxHp).toBe(BASE_MAX_HP + 2);
    expect(playerStats(wearing(["luckyClover"])).coinMult).toBeCloseTo(1.5);
    expect(playerStats(wearing(["springBoots"])).dashCooldownMult).toBeCloseTo(0.5);
    expect(playerStats(wearing(["docScarf"])).regenEverySec).toBe(8);
    expect(playerStats(wearing(["greenCheck"])).critChance).toBeCloseTo(0.3);
    expect(playerStats(wearing(["cactusBuddy"])).thorns).toBe(2);
  });

  it("combines two charms and level hearts", () => {
    const stats = playerStats(wearing(["heartCookie", "hotCoffee"], { xp: LEVEL_XP[5] }));
    expect(stats.maxHp).toBe(BASE_MAX_HP + 4 + 2);
    expect(stats.speedMult).toBeCloseTo(1.15);
  });

  it("reports the weapon and pet perk", () => {
    const stats = playerStats(wearing([], { pet: "snek", weapon: "rubberDuck" }));
    expect(stats.weapon.id).toBe("rubberDuck");
    expect(stats.petPerk).toBe("fighter");
  });

  it("ignores equipped items the player does not own (tampered save)", () => {
    const base = defaultSave();
    const save = { ...base, equipped: { ...base.equipped, weapon: "mergeSaber", charms: ["greenCheck"], pet: "starSprite" } };
    const stats = playerStats(save);
    expect(stats.weapon.id).toBe("twig");
    expect(stats.critChance).toBe(0);
    expect(stats.petPerk).toBeNull();
  });
});

describe("repo progress helpers", () => {
  it("getProgress returns a shared empty record for unknown repos", () => {
    const save = defaultSave();
    expect(getProgress(save, KEY)).toEqual(emptyProgress());
    expect(getProgress(save, KEY)).toBe(getProgress(save, "other/repo@x"));
    expect(getProgress(save, "constructor")).toEqual(emptyProgress());
  });

  it("withRepoProgress stores progress without touching the input save", () => {
    const save = deepFreeze(defaultSave());
    const next = withRepoProgress(save, KEY, progressWith({ defeated: ["a"] }));
    expect(getProgress(next, KEY).defeated).toEqual(["a"]);
    expect(save.repos).toEqual({});
  });

  it(`remembers only the ${MAX_SAVED_REPOS} most recently touched repos`, () => {
    let save = defaultSave();
    for (let i = 0; i < MAX_SAVED_REPOS; i++) save = withRepoProgress(save, `o/r${i}@x`, emptyProgress());
    // Touch the oldest repo again so it becomes the newest…
    save = withRepoProgress(save, "o/r0@x", progressWith({ opened: ["a.py"] }));
    // …then add a new one: the least recently touched (r1) is forgotten instead.
    save = withRepoProgress(save, "o/new@x", emptyProgress());

    const keys = Object.keys(save.repos);
    expect(keys).toHaveLength(MAX_SAVED_REPOS);
    expect(keys).not.toContain("o/r1@x");
    expect(keys.slice(-2)).toEqual(["o/r0@x", "o/new@x"]);
  });
});

describe("finding states (alive, subdued, fixed, sealed)", () => {
  const bugA = makeFinding("a.py", 1);
  const bugB = makeFinding("a.py", 9, "gremlin", { code: "B006" });
  const fixedBug = makeFinding("a.py", 4, "dustBunny", { code: "F841" });
  const sealedBug = makeFinding("a.py", 6, "keyThief", { code: "S105" });
  const file = { ...makeFile("a.py", { findings: [bugA, bugB] }), realFixes: 2, fixedFindings: [fixedBug, sealedBug] };
  const progress = progressWith({ defeated: [bugA.id], sealed: [sealedBug.id] });

  it("derives each finding's state from the code and the save", () => {
    expect(findingState(file, bugA, progress)).toBe("subdued");
    expect(findingState(file, bugB, progress)).toBe("alive");
    expect(findingState(file, fixedBug, progress)).toBe("fixed");
    expect(findingState(file, sealedBug, progress)).toBe("sealed");
    expect(fileTally(file, progress)).toEqual({ alive: 1, subdued: 1, fixed: 1, sealed: 1 });
  });

  it("lists the monsters still fighting and the ones subdued", () => {
    expect(aliveFindings(file, emptyProgress())).toEqual([bugA, bugB]);
    expect(aliveFindings(file, progress)).toEqual([bugB]);
    expect(subduedFindings(file, progress)).toEqual([bugA]);
  });
});

describe("quiet and purified dungeons", () => {
  const bugA = makeFinding("a.py", 1);
  const bugB = makeFinding("a.py", 9);
  const file = makeFile("a.py", { findings: [bugA, bugB] });

  it("is quiet once every monster still in the code is subdued (a fight is enough)", () => {
    expect(isDungeonQuiet(file, emptyProgress())).toBe(false);
    expect(isDungeonQuiet(file, progressWith({ defeated: [bugA.id] }))).toBe(false);
    expect(isDungeonQuiet(file, progressWith({ defeated: [bugA.id, bugB.id] }))).toBe(true);
  });

  it("is purified only when the code has no finding left (a fight is not enough)", () => {
    expect(isDungeonPurified(file)).toBe(false);
    const fixedAll = { ...makeFile("a.py"), realFixes: 2, fixedFindings: [bugA, bugB] };
    expect(isDungeonPurified(fixedAll)).toBe(true);
    expect(isDungeonQuiet(fixedAll, emptyProgress())).toBe(true);
  });

  it("does not take the old `cleared` list as proof of anything", () => {
    expect(isDungeonQuiet(file, progressWith({ cleared: ["a.py"] }))).toBe(false);
  });

  it("knows a clean file is not a dungeon at all", () => {
    expect(isDungeon(makeFile("clean.py"))).toBe(false);
    expect(isDungeonPurified(makeFile("clean.py"))).toBe(false);
    expect(isDungeon(makeFile("broken.py", { status: "failed", findings: [bugA] }))).toBe(false);
  });

  it("calls the repo purified (the victory) only when no file has a finding left", () => {
    expect(isRepoPurified(makeAnalysis([file, makeFile("clean.py")]))).toBe(false);
    expect(isRepoPurified(makeAnalysis([{ ...makeFile("a.py"), fixedFindings: [bugA, bugB] }, makeFile("clean.py")]))).toBe(true);
  });
});

describe("repoHealth", () => {
  const bugA = makeFinding("a.py", 1);
  const bugB = makeFinding("a.py", 2, "gremlin", { code: "B006" });
  const bugC = makeFinding("b.py", 5, "keyThief", { code: "S105" });
  const analysis = makeAnalysis([
    makeFile("a.py", { findings: [bugA, bugB] }),
    makeFile("b.py", { findings: [bugC] }),
    makeFile("clean.py", { grade: "A" }),
    makeFile("broken.py", { status: "failed" }),
  ]);

  it("is perfectly healthy (1) for a repo without findings", () => {
    const health = repoHealth(makeAnalysis([makeFile("clean.py")]), emptyProgress());
    expect(health).toEqual({
      ratio: 1,
      subduedRatio: 0,
      alive: 0,
      subdued: 0,
      fixed: 0,
      sealed: 0,
      total: 0,
      dungeonsQuiet: 0,
      dungeonsPurified: 0,
      dungeonsTotal: 0,
      chestsOpened: 0,
      chestsTotal: 1,
    });
    expect(repoHealth(makeAnalysis([]), emptyProgress()).ratio).toBe(1);
  });

  it("starts at 0 and counts dungeons and chests (failed files have none)", () => {
    expect(repoHealth(analysis, emptyProgress())).toEqual({
      ratio: 0,
      subduedRatio: 0,
      alive: 3,
      subdued: 0,
      fixed: 0,
      sealed: 0,
      total: 3,
      dungeonsQuiet: 0,
      dungeonsPurified: 0,
      dungeonsTotal: 2,
      chestsOpened: 0,
      chestsTotal: 3,
    });
  });

  it("does not expect a chest from a near-empty __init__.py (it is only a lantern on the map)", () => {
    const marker = { ...makeFile("pkg/__init__.py"), kind: "init" as const, lineCount: 1 };
    const health = repoHealth(makeAnalysis([makeFile("pkg/core.py"), marker]), emptyProgress());
    expect(health.chestsTotal).toBe(1);
  });

  it("does not fill the bar with fights: subdued bugs are its lighter part", () => {
    const progress = progressWith({ defeated: [bugA.id, bugB.id], opened: ["clean.py"] });
    const health = repoHealth(analysis, progress);
    expect(health.ratio).toBe(0);
    expect(health.subdued).toBe(2);
    expect(health.subduedRatio).toBeCloseTo(2 / 3);
    expect(health.dungeonsQuiet).toBe(1);
    expect(health.dungeonsPurified).toBe(0);
    expect(health.chestsOpened).toBe(1);
  });

  it("fills the bar with fixed and sealed bugs alike, counting them apart", () => {
    const edited = makeAnalysis([
      { ...makeFile("a.py"), realFixes: 2, fixedFindings: [bugA, bugB] },
      makeFile("b.py", { findings: [bugC] }),
      makeFile("clean.py"),
    ]);
    const health = repoHealth(edited, progressWith({ sealed: [bugB.id], defeated: [bugC.id] }));
    expect(health).toMatchObject({ fixed: 1, sealed: 1, subdued: 1, alive: 0, total: 3, dungeonsPurified: 1, dungeonsQuiet: 2, dungeonsTotal: 2 });
    expect(health.ratio).toBeCloseTo(2 / 3);
    expect(health.subduedRatio).toBeCloseTo(1 / 3);
  });

  it("ignores stale ids that are not in this analysis", () => {
    const progress = progressWith({ defeated: ["ghost.py:1:1:F401", bugC.id], opened: ["ghost.py"], sealed: ["ghost.py:2:1:S105"] });
    const health = repoHealth(analysis, progress);
    expect(health.subdued).toBe(1);
    expect(health.sealed).toBe(0);
    expect(health.chestsOpened).toBe(0);
    expect(health.ratio).toBeLessThanOrEqual(1);
  });

  it("loads an old save whose dungeons were cleared by fighting as quiet dungeons, nothing purified", () => {
    const oldSave = progressWith({ defeated: [bugA.id, bugB.id, bugC.id], cleared: ["a.py", "b.py"], opened: ["a.py", "b.py"], milestones: [25, 50, 75, 100] });
    const health = repoHealth(analysis, oldSave);
    expect(health).toMatchObject({ ratio: 0, subdued: 3, dungeonsQuiet: 2, dungeonsPurified: 0, chestsOpened: 2 });
  });
});
