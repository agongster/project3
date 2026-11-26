import { describe, expect, it } from "vitest";
import {
  addCoins,
  awardItem,
  claimMilestones,
  equipItem,
  grantItem,
  isEquipped,
  markCreated,
  recordDefeat,
  recordDungeonQuiet,
  resetAll,
  resetRepo,
  setLook,
  setSettings,
  setTheme,
  spendCoins,
  unequip,
} from "@/lib/game/actions";
import { LEVEL_XP, MAX_CHARMS, MONSTERS, RARITY_INFO, SKIN_TONES, getItem } from "@/lib/game/catalog";
import { HEALTH_MILESTONES, getProgress } from "@/lib/game/progress";
import { MAX_COINS, defaultSave } from "@/lib/game/store";
import type { SaveData } from "@/lib/types";
import { KEY, deepFreeze, makeFinding, saveWith } from "./helpers";

/** A frozen save that owns a few extra items, so equip tests have something to work with. */
function collector(): SaveData {
  const base = defaultSave();
  return deepFreeze({
    ...base,
    coins: 100,
    owned: [...base.owned, "bugNet", "rubberDuck", "hotCoffee", "coinMagnet", "heartCookie", "catEars", "snek", "petalTrail"],
  });
}

describe("coins", () => {
  it("adds and removes coins, never below 0 or above the cap", () => {
    const save = deepFreeze(saveWith({ coins: 10 }));
    expect(addCoins(save, 5).coins).toBe(15);
    expect(addCoins(save, -4).coins).toBe(6);
    expect(addCoins(save, -50).coins).toBe(0);
    expect(addCoins(save, 1e12).coins).toBe(MAX_COINS);
  });

  it("rounds fractional amounts and ignores non-numbers", () => {
    const save = deepFreeze(saveWith({ coins: 10 }));
    expect(addCoins(save, 4.5).coins).toBe(15);
    expect(addCoins(save, Number.NaN)).toBe(save);
    expect(addCoins(save, 0)).toBe(save);
  });

  it("spendCoins returns null when the player is too poor", () => {
    const save = deepFreeze(saveWith({ coins: 30 }));
    expect(spendCoins(save, 31)).toBeNull();
    expect(spendCoins(save, -5)).toBeNull();
    expect(spendCoins(save, 30)?.coins).toBe(0);
    expect(spendCoins(save, 0)).toBe(save);
  });
});

describe("items", () => {
  it("grantItem adds new known items only", () => {
    const save = collector();
    expect(grantItem(save, "laserCannon")).toBe(save);
    expect(grantItem(save, "bugNet")).toBe(save);
    expect(grantItem(save, "halo").owned.at(-1)).toBe("halo");
  });

  it("awardItem refunds duplicates by rarity", () => {
    const save = collector();
    const fresh = awardItem(save, getItem("halo")!);
    expect(fresh).toMatchObject({ isNew: true, refund: 0 });
    expect(fresh.save.owned).toContain("halo");

    const dupe = awardItem(save, getItem("rubberDuck")!);
    expect(dupe).toMatchObject({ isNew: false, refund: RARITY_INFO.rare.dupeRefund });
    expect(dupe.save.coins).toBe(save.coins + RARITY_INFO.rare.dupeRefund);
    expect(dupe.save.owned).toEqual(save.owned);
  });
});

describe("equipItem / unequip", () => {
  it("rejects unknown and unowned items", () => {
    const save = collector();
    expect(equipItem(save, "mergeSaber")).toBe(save);
    expect(equipItem(save, "nope")).toBe(save);
  });

  it("routes items to their slot", () => {
    let save: SaveData = collector();
    save = equipItem(save, "rubberDuck");
    save = equipItem(save, "catEars");
    save = equipItem(save, "snek");
    save = equipItem(save, "petalTrail");
    expect(save.equipped).toMatchObject({ weapon: "rubberDuck", hat: "catEars", pet: "snek", trail: "petalTrail" });
    expect(isEquipped(save, "snek")).toBe(true);
    expect(equipItem(save, "rubberDuck")).toBe(save); // already wielded
  });

  it("toggles charms and drops the oldest past the cap", () => {
    const save = collector();
    const one = equipItem(save, "hotCoffee");
    expect(one.equipped.charms).toEqual(["hotCoffee"]);
    expect(equipItem(one, "hotCoffee").equipped.charms).toEqual([]);

    const full = equipItem(equipItem(one, "coinMagnet"), "heartCookie");
    expect(full.equipped.charms).toHaveLength(MAX_CHARMS);
    expect(full.equipped.charms).toEqual(["coinMagnet", "heartCookie"]);
  });

  it("never leaves the weapon slot empty", () => {
    const save = equipItem(collector(), "bugNet");
    const bare = unequip(save, "weapon");
    expect(bare.equipped.weapon).toBe("twig");
    expect(unequip(bare, "weapon")).toBe(bare);
    expect(unequip(save, "weapon", "rubberDuck")).toBe(save); // not the one wielded
  });

  it("unequips hats, pets, trails and charms", () => {
    let save: SaveData = collector();
    for (const id of ["catEars", "snek", "petalTrail", "hotCoffee", "coinMagnet"]) save = equipItem(save, id);
    expect(unequip(save, "hat").equipped.hat).toBeNull();
    expect(unequip(save, "pet", "snek").equipped.pet).toBeNull();
    expect(unequip(save, "pet", "duckling")).toBe(save);
    expect(unequip(save, "trail").equipped.trail).toBeNull();
    expect(unequip(save, "charm", "hotCoffee").equipped.charms).toEqual(["coinMagnet"]);
    expect(unequip(save, "charm").equipped.charms).toEqual([]);

    const bare = collector();
    expect(unequip(bare, "hat")).toBe(bare);
    expect(unequip(bare, "charm")).toBe(bare);
  });
});

describe("look, theme, settings", () => {
  it("setLook merges and clamps", () => {
    const save = deepFreeze(defaultSave());
    const next = setLook(save, { name: "  Ada  ", skin: 99, hairStyle: -1 });
    expect(next.look).toMatchObject({ name: "Ada", skin: SKIN_TONES.length - 1, hairStyle: 0 });
    expect(setLook(save, { name: "Hero" })).toBe(save);
  });

  it("setTheme ignores unknown themes", () => {
    const save = deepFreeze(defaultSave());
    expect(setTheme(save, "night").theme).toBe("night");
    expect(setTheme(save, "lava" as never)).toBe(save);
    expect(setTheme(save, "meadow")).toBe(save);
  });

  it("setSettings clamps volumes", () => {
    const save = deepFreeze(defaultSave());
    expect(setSettings(save, { sfx: 2, music: -1 }).settings).toEqual({ sfx: 1, music: 0, screenShake: true });
    expect(setSettings(save, { screenShake: true })).toBe(save);
  });

  it("markCreated flips once", () => {
    const save = deepFreeze(defaultSave());
    const created = markCreated(save);
    expect(created.created).toBe(true);
    expect(markCreated(created)).toBe(created);
  });
});

describe("recordDefeat", () => {
  const bunny = makeFinding("a.py", 1, "dustBunny");
  const boss = makeFinding("a.py", 9, "glitchKing", { code: "SYNTAX" });

  it("records a defeat once: id, squash count and monster XP", () => {
    const save = deepFreeze(defaultSave());
    const first = recordDefeat(save, KEY, bunny);
    expect(getProgress(first.save, KEY).defeated).toEqual([bunny.id]);
    expect(first.save.xp).toBe(MONSTERS.dustBunny.xp);
    expect(first.save.stats.bugsSquashed).toBe(1);

    const again = recordDefeat(first.save, KEY, bunny);
    expect(again.save).toBe(first.save);
    expect(again.leveledUp).toBeNull();
  });

  it("reports level-ups with the new title", () => {
    const save = saveWith({ xp: LEVEL_XP[1] - 1 });
    expect(recordDefeat(save, KEY, bunny).leveledUp).toEqual({ level: 2, title: "Bug Spotter" });
    expect(recordDefeat(saveWith({ xp: 0 }), KEY, bunny).leveledUp).toBeNull();
    expect(recordDefeat(saveWith({ xp: 0 }), KEY, boss).leveledUp).toEqual({ level: 2, title: "Bug Spotter" });
    expect(recordDefeat(saveWith({ xp: 90 }), KEY, boss).leveledUp).toEqual({ level: 3, title: "Junior Debugger" });
  });

  it("keeps repos separate", () => {
    const save = recordDefeat(defaultSave(), KEY, bunny).save;
    expect(getProgress(save, "other/repo@1").defeated).toEqual([]);
    expect(recordDefeat(save, "other/repo@1", bunny).save.stats.bugsSquashed).toBe(2);
  });
});

describe("recordDungeonQuiet", () => {
  it("counts each dungeon once", () => {
    const save = deepFreeze(defaultSave());
    const once = recordDungeonQuiet(save, KEY, "a.py");
    expect(getProgress(once, KEY).cleared).toEqual(["a.py"]);
    expect(once.stats.dungeonsCleared).toBe(1);
    expect(recordDungeonQuiet(once, KEY, "a.py")).toBe(once);
  });
});

describe("claimMilestones", () => {
  it("pays each milestone once", () => {
    const save = deepFreeze(defaultSave());
    const quarter = claimMilestones(save, KEY, 0.3);
    expect(quarter.rewards).toEqual([{ milestone: 25, coins: 25 }]);
    expect(quarter.save.coins).toBe(25);

    const repeat = claimMilestones(quarter.save, KEY, 0.3);
    expect(repeat.rewards).toEqual([]);
    expect(repeat.save).toBe(quarter.save);

    const done = claimMilestones(quarter.save, KEY, 1);
    expect(done.rewards.map((r) => r.milestone)).toEqual([50, 75, 100]);
    expect(done.save.coins).toBe(HEALTH_MILESTONES.reduce((sum, m) => sum + m.coins, 0));
    expect(getProgress(done.save, KEY).milestones).toEqual([25, 50, 75, 100]);
  });

  it("hits exact thresholds despite floating point", () => {
    expect(claimMilestones(defaultSave(), KEY, 3 / 4).rewards).toHaveLength(3);
    expect(claimMilestones(defaultSave(), KEY, 0.7499999999999999).rewards).toHaveLength(3);
    expect(claimMilestones(defaultSave(), KEY, 0.24).rewards).toEqual([]);
    expect(claimMilestones(defaultSave(), KEY, Number.NaN).rewards).toEqual([]);
  });
});

describe("resets", () => {
  it("resetRepo forgets one repo but keeps coins, items and stats", () => {
    const played = recordDefeat(addCoins(defaultSave(), 50), KEY, makeFinding("a.py", 1)).save;
    const reset = resetRepo(played, KEY);
    expect(reset.repos).toEqual({});
    expect(reset.coins).toBe(50);
    expect(reset.stats.bugsSquashed).toBe(1);
    expect(resetRepo(reset, KEY)).toBe(reset);
  });

  it("resetAll returns a brand-new save", () => {
    expect(resetAll()).toEqual(defaultSave());
  });
});
