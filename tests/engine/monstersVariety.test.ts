/**
 * Champions and modifiers in the engine, headless: the dungeon's champion
 * gets its body plan, every modifier and every champion lives in a real
 * dungeon without ever entering a wall, the fair-fight rules still hold,
 * and a hero who only attacks still beats every one of them.
 */
import { describe, expect, it } from "vitest";
import { createBrain } from "@/game/entities/monsters/brains";
import { MAX_PURSUERS } from "@/game/entities/monsters/engagement";
import { Monster } from "@/game/entities/monsters/monster";
import { createBodies } from "@/game/entities/monsters/traits";
import { championPlan, modifiedPlan, type BodyPlan } from "@/game/entities/monsters/variety";
import { CHAMPION_STATS, championHp, championOf } from "@/lib/game/champions";
import { MONSTERS } from "@/lib/game/catalog";
import { allowedModifiers, MODIFIER_IDS, modifierOf, type ModifierId } from "@/lib/game/monsterModifiers";
import { generateDungeon } from "@/lib/worldgen";
import type { AnalyzedFile, Finding, MonsterSpawn } from "@/lib/types";
import { CLOSE_PX, DT, fileWithEveryMonster, fileWithEveryTrait, runTour, TestWorld, traitSetup } from "./monstersWorld";

const SEEDS = [1, 2, 3];
/** Seconds a hero who only attacks may need against one monster, at most. */
const WIN_WITHIN_SEC = 60;
/** The starter weapon's rhythm, a little slower than its cooldown (a casual player). */
const ATTACK_EVERY_SEC = 0.35;

/** The trait file without its bosses: its toughest monster becomes the champion. */
function championFile(): AnalyzedFile {
  const file = fileWithEveryTrait("champ/trait.py");
  return { ...file, findings: file.findings.filter((f) => f.severity !== "boss") };
}

/** Plain bodies (no traits) for every finding of `file`, each with the plan `planFor` picks. */
function plainBodies(file: AnalyzedFile, seed: number, planFor: (finding: Finding, i: number) => BodyPlan) {
  const dungeon = generateDungeon(file, seed);
  const world = new TestWorld(dungeon, seed);
  const byId = new Map(file.findings.map((f) => [f.id, f]));
  const monsters = dungeon.monsters.map((spawn: MonsterSpawn, i) => {
    const finding = byId.get(spawn.findingId)!;
    const plan = planFor(finding, i);
    return new Monster(spawn, finding, createBrain(spawn.kind, plan.champion), world, { plan });
  });
  return { world, monsters };
}

/** Every ordinary monster with a modifier it may have, cycling through all of them; bosses plain; one champion. */
function everyVariety(seed: number) {
  const file = fileWithEveryMonster("variety/every.py");
  const championId = file.findings.find((f) => f.monster === "gremlin")!.id;
  return plainBodies(file, seed, (finding, i) => {
    if (finding.id === championId) return championPlan(finding);
    const allowed = allowedModifiers(finding, false);
    return modifiedPlan(finding, allowed.length > 0 ? allowed[(seed + i) % allowed.length] : null);
  });
}

describe("building champions and modifiers", () => {
  it("crowns exactly the dungeon's champion, with its health and size", () => {
    const file = championFile();
    const dungeon = generateDungeon(file, 1);
    const world = new TestWorld(dungeon, 1);
    const byId = new Map(file.findings.map((f) => [f.id, f]));
    const monsters = dungeon.monsters.flatMap((s) => createBodies(s, byId.get(s.findingId)!, world, traitSetup(dungeon, file)));
    const champions = monsters.filter((m) => m.champion);
    expect(champions.length).toBe(1);
    const champion = champions[0];
    expect(champion.finding.id).toBe(championOf(file)!.id);
    expect(champion.maxHp).toBe(championHp(MONSTERS[champion.species].hp));
    expect(champion.sizeScale).toBe(CHAMPION_STATS.sizeScale);
    expect(champion.modifier).toBeNull();
    for (const m of monsters.filter((x) => !x.champion)) expect(m.modifier?.id ?? null).toBe(modifierOf(m.finding));
  });

  it("never gives a dungeon with a true boss a champion", () => {
    const file = fileWithEveryTrait();
    const dungeon = generateDungeon(file, 2);
    const world = new TestWorld(dungeon, 2);
    const byId = new Map(file.findings.map((f) => [f.id, f]));
    const monsters = dungeon.monsters.flatMap((s) => createBodies(s, byId.get(s.findingId)!, world, traitSetup(dungeon, file)));
    expect(monsters.some((m) => m.champion)).toBe(false);
  });

  it("applies a modifier's numbers to the body", () => {
    const finding = fileWithEveryMonster().findings.find((f) => f.monster === "gremlin")!;
    const swift = modifiedPlan(finding, "swift");
    expect(swift.def.speed).toBeCloseTo(MONSTERS.gremlin.speed * 1.3);
    expect(swift.hp).toBeLessThan(MONSTERS.gremlin.hp);
    const giant = modifiedPlan(finding, "giant");
    expect(giant.sizeScale).toBeGreaterThan(1);
    expect(giant.hp).toBeLessThan(MONSTERS.gremlin.hp);
    expect(MONSTERS.gremlin.speed).toBe(36); // the catalog itself is never changed
  });
});

describe("champions and modifiers in a real dungeon", () => {
  for (const seed of SEEDS) {
    it(`never puts a champion or a modified monster inside a wall (seed ${seed})`, () => {
      const { world, monsters } = everyVariety(seed);
      const problems: string[] = [];
      runTour(world, monsters, (w, all, step) => {
        for (const m of all) if (problems.length === 0 && w.isStuckInWall(m)) problems.push(`${m.species} (${m.champion ? "champion" : m.modifier?.id ?? "plain"}) inside a wall, step ${step}`);
      });
      expect(problems).toEqual([]);
    });

    it(`never puts the champion of a trait dungeon inside a wall (seed ${seed})`, () => {
      const file = championFile();
      const dungeon = generateDungeon(file, seed);
      const world = new TestWorld(dungeon, seed);
      const byId = new Map(file.findings.map((f) => [f.id, f]));
      const monsters = dungeon.monsters.flatMap((s) => createBodies(s, byId.get(s.findingId)!, world, traitSetup(dungeon, file)));
      const problems: string[] = [];
      runTour(world, monsters, (w, all, step) => {
        for (const m of all) if (problems.length === 0 && w.isStuckInWall(m)) problems.push(`${m.finding.code} inside a wall, step ${step}`);
      });
      expect(problems).toEqual([]);
    });
  }

  it("keeps the pursuer cap and one boss at a time", () => {
    const { world, monsters } = everyVariety(4);
    let most = 0;
    runTour(world, monsters, (_w, all) => {
      most = Math.max(most, all.filter((m) => m.alive && m.engaged && m.brain.pursues && m.heroDistance() > CLOSE_PX).length);
      expect(all.filter((m) => m.alive && m.isBoss && m.engaged).length).toBeLessThanOrEqual(1);
    });
    expect(most).toBeLessThanOrEqual(MAX_PURSUERS);
  });
});

describe("a hero who only attacks beats every champion and every modifier", () => {
  /** One body per (species, champion or modifier), bosses left out (they are tuned and tested on their own). */
  function contenders(): { world: TestWorld; monsters: Monster[] } {
    const file = fileWithEveryMonster("win/every.py");
    const ordinary = file.findings.filter((f) => f.severity !== "boss");
    const plans: { finding: Finding; plan: BodyPlan }[] = [];
    for (const finding of ordinary) {
      plans.push({ finding, plan: championPlan(finding) });
      for (const id of MODIFIER_IDS as ModifierId[]) if (allowedModifiers(finding, false).includes(id)) plans.push({ finding, plan: modifiedPlan(finding, id) });
    }
    const dungeon = generateDungeon(file, 9);
    const world = new TestWorld(dungeon, 9);
    const spawnOf = new Map(dungeon.monsters.map((s) => [s.findingId, s]));
    const monsters = plans.map(({ finding, plan }) => new Monster(spawnOf.get(finding.id)!, finding, createBrain(finding.monster, plan.champion), world, { plan }));
    return { world, monsters };
  }

  it("clears each one within a minute by just attacking", () => {
    const { world, monsters } = contenders();
    for (const m of monsters) {
      let swing = 0;
      let t = 0;
      for (let step = 0; step < WIN_WITHIN_SEC / DT && m.alive; step++) {
        t += DT;
        world.time = t;
        world.hero.x = m.x - 20;
        world.hero.y = m.y;
        m.engaged = true;
        m.update(DT);
        swing += DT;
        if (swing < ATTACK_EVERY_SEC || !m.targetable) continue;
        swing = 0;
        m.takeHit({ damage: 1, knockbackX: 0, knockbackY: 0, crit: false, source: "weapon" });
      }
      expect(m.alive, `${m.species} (${m.champion ? "champion" : m.modifier?.id}) still alive after ${WIN_WITHIN_SEC} s`).toBe(false);
    }
  });
});
