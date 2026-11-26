/**
 * Headless simulation: one monster of every kind lives in a real generated
 * dungeon for thousands of steps. The hero visits them one after another
 * (wandering around each, swinging wildly with random knockback, then
 * defeating it), so every archetype gets to run its whole act — while the
 * others keep pottering about. No monster may ever end up inside a wall, a
 * solid prop (walkers) or the entrance safe zone, or leave the map.
 */
import { describe, expect, it } from "vitest";
import { createBrain } from "@/game/entities/monsters/brains";
import { MAX_PURSUERS, updateEngagement } from "@/game/entities/monsters/engagement";
import { Monster } from "@/game/entities/monsters/monster";
import { createBodies } from "@/game/entities/monsters/traits";
import { generateDungeon } from "@/lib/worldgen";
import { MONSTER_KINDS } from "@/lib/types";
import { CLOSE_PX, DT, fileWithEveryMonster, fileWithEveryTrait, runTour, TestWorld, traitSetup } from "./monstersWorld";

const SEEDS = [1, 2, 3];

/** Every monster kind; with `traits`, built like the director does (runes, an echo, growth…). */
function setup(seed: number, traits = false) {
  const file = traits ? fileWithEveryTrait() : fileWithEveryMonster();
  const dungeon = generateDungeon(file, seed);
  const world = new TestWorld(dungeon, seed);
  const findings = new Map(file.findings.map((f) => [f.id, f]));
  const plan = traitSetup(dungeon, file);
  const monsters = dungeon.monsters.flatMap((s) =>
    traits ? createBodies(s, findings.get(s.findingId)!, world, plan) : [new Monster(s, findings.get(s.findingId)!, createBrain(s.kind), world)],
  );
  return { world, monsters };
}

/** Runs the whole visit-everyone tour (see runTour), calling `check` after every step. */
function tour(seed: number, check: (world: TestWorld, monsters: Monster[], step: number) => void, traits = false): void {
  const { world, monsters } = setup(seed, traits);
  runTour(world, monsters, check);
}

describe("monster simulation", () => {
  it("spawns one monster of every kind", () => {
    const { monsters } = setup(1);
    expect(monsters.map((m) => m.species).sort()).toEqual([...MONSTER_KINDS].sort());
  });

  for (const seed of SEEDS) {
    it(`never puts a monster inside a wall (seed ${seed})`, () => {
      const problems: string[] = [];
      const engaged = new Set<string>();
      tour(seed, (world, monsters, step) => {
        if (problems.length > 0) return;
        for (const m of monsters) {
          if (m.engaged) engaged.add(m.species);
          if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) problems.push(`${m.species} has a broken position at step ${step}`);
          else if (world.isStuckInWall(m)) problems.push(`${m.species} inside a wall at (${m.x.toFixed(1)}, ${m.y.toFixed(1)}), step ${step}`);
        }
      });
      expect(problems).toEqual([]);
      // The test is only worth something if every monster actually got to fight.
      expect([...engaged].sort()).toEqual([...MONSTER_KINDS].sort());
    });
  }

  for (const seed of SEEDS) {
    it(`never puts a monster (an echo included) inside a wall when traits are on (seed ${seed})`, () => {
      const problems: string[] = [];
      tour(
        seed,
        (world, monsters, step) => {
          for (const m of monsters) if (problems.length === 0 && world.isStuckInWall(m)) problems.push(`${m.finding.code} inside a wall, step ${step}`);
        },
        true,
      );
      expect(problems).toEqual([]);
    });
  }

  it("lets at most MAX_PURSUERS monsters chase the hero at once (unless it walks right up to more)", () => {
    let most = 0;
    tour(4, (_world, monsters) => {
      const chasing = monsters.filter((m) => m.alive && m.engaged && m.brain.pursues && m.heroDistance() > CLOSE_PX);
      most = Math.max(most, chasing.length);
    });
    expect(most).toBeLessThanOrEqual(MAX_PURSUERS);
  });

  it("only lets one boss fight at a time", () => {
    tour(5, (_world, monsters) => {
      expect(monsters.filter((m) => m.alive && m.isBoss && m.engaged).length).toBeLessThanOrEqual(1);
    });
  });

  it("calms every monster down and sends it home when the hero faints", () => {
    const { world, monsters } = setup(6);
    world.visit(monsters[0]);
    for (let step = 0; step < 600; step++) {
      world.moveHero(DT);
      updateEngagement(monsters, world, true, DT);
      for (const m of monsters) m.update(DT);
    }
    for (const m of monsters) {
      m.hp = Math.max(1, m.hp - 1);
      const hpBefore = m.hp;
      m.resetForRetry();
      expect(m.engaged).toBe(false);
      expect(m.x).toBe(m.homeX);
      expect(m.y).toBe(m.homeY);
      expect(m.hp).toBe(hpBefore); // the bugs didn't move — and didn't heal
      expect(m.targetable).toBe(true);
    }
  });
});
