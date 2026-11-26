import { describe, expect, it } from "vitest";
import { BASE_MAX_HP, LEVEL_TITLES, LEVEL_XP } from "@/lib/game/catalog";
import {
  BASE_MAGNET_RADIUS,
  MAX_LEVEL,
  MAX_SAVED_REPOS,
  emptyProgress,
  getProgress,
  isDungeonCleared,
  levelForXp,
  playerStats,
  remainingFindings,
  repoHealth,
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
      defeated: 0,
      total: 0,
      dungeonsCleared: 0,
      dungeonsTotal: 0,
      chestsOpened: 0,
      chestsTotal: 1,
    });
    expect(repoHealth(makeAnalysis([]), emptyProgress()).ratio).toBe(1);
  });

  it("starts at 0 and counts dungeons and chests (failed files have none)", () => {
    expect(repoHealth(analysis, emptyProgress())).toEqual({
      ratio: 0,
      defeated: 0,
      total: 3,
      dungeonsCleared: 0,
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

  it("counts defeated findings, cleared dungeons and opened chests", () => {
    const progress = progressWith({ defeated: [bugA.id, bugB.id], opened: ["clean.py", "a.py"] });
    const health = repoHealth(analysis, progress);
    expect(health.defeated).toBe(2);
    expect(health.ratio).toBeCloseTo(2 / 3);
    expect(health.dungeonsCleared).toBe(1);
    expect(health.chestsOpened).toBe(2);
  });

  it("ignores stale ids that are not in this analysis", () => {
    const progress = progressWith({ defeated: ["ghost.py:1:1:F401", bugC.id], opened: ["ghost.py"] });
    const health = repoHealth(analysis, progress);
    expect(health.defeated).toBe(1);
    expect(health.chestsOpened).toBe(0);
    expect(health.ratio).toBeLessThanOrEqual(1);
  });
});

describe("isDungeonCleared / remainingFindings", () => {
  const bugA = makeFinding("a.py", 1);
  const bugB = makeFinding("a.py", 9);
  const file = makeFile("a.py", { findings: [bugA, bugB] });

  it("lists the monsters still alive", () => {
    expect(remainingFindings(file, emptyProgress())).toEqual([bugA, bugB]);
    expect(remainingFindings(file, progressWith({ defeated: [bugA.id] }))).toEqual([bugB]);
  });

  it("is cleared once every monster is defeated or the engine recorded it", () => {
    expect(isDungeonCleared(file, emptyProgress())).toBe(false);
    expect(isDungeonCleared(file, progressWith({ defeated: [bugA.id] }))).toBe(false);
    expect(isDungeonCleared(file, progressWith({ defeated: [bugA.id, bugB.id] }))).toBe(true);
    expect(isDungeonCleared(file, progressWith({ cleared: ["a.py"] }))).toBe(true);
  });

  it("is false for clean files, which are not dungeons", () => {
    expect(isDungeonCleared(makeFile("clean.py"), progressWith({ cleared: ["clean.py"] }))).toBe(false);
  });
});
