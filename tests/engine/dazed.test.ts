/**
 * The dazed moment of the pick-the-fix finisher, headless: which monsters
 * get dazed, how long, what may end it, and that every way out ends in
 * exactly one death.
 */
import { describe, expect, it } from "vitest";
import type { HitSource } from "@/game/combat/hittable";
import { createBrain } from "@/game/entities/monsters/brains";
import { answerFinisher, declineUnanswered } from "@/game/entities/monsters/dazed";
import { applyContactDamage } from "@/game/entities/monsters/engagement";
import { DAZE_SEC, Monster } from "@/game/entities/monsters/monster";
import { generateDungeon } from "@/lib/worldgen";
import type { MonsterKind } from "@/lib/types";
import { fileWithEveryMonster, TestWorld } from "./monstersWorld";

const DT = 1 / 60;

function setup() {
  const file = fileWithEveryMonster();
  const dungeon = generateDungeon(file, 1);
  const world = new TestWorld(dungeon, 1);
  const findings = new Map(file.findings.map((f) => [f.id, f]));
  const monsters = dungeon.monsters.map((s) => new Monster(s, findings.get(s.findingId)!, createBrain(s.kind), world));
  const get = (kind: MonsterKind) => monsters.find((m) => m.species === kind)!;
  return { world, monsters, get };
}

function hit(m: Monster, damage: number, source: HitSource = "weapon"): void {
  m.takeHit({ damage, knockbackX: 0, knockbackY: 0, crit: false, source });
}

function run(m: Monster, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) if (m.alive) m.update(DT);
}

describe("dazed monsters", () => {
  it("minions die at once, elites and bosses are dazed at 0 HP instead", () => {
    const { get } = setup();
    const bunny = get("dustBunny");
    hit(bunny, bunny.hp);
    expect(bunny.alive).toBe(false);
    for (const kind of ["gremlin", "keyThief"] as const) {
      const m = get(kind);
      m.engaged = true;
      hit(m, m.hp);
      expect(m.alive).toBe(true);
      expect(m.dazed).toBe(true);
      expect(m.hp).toBe(0);
      expect(m.engaged).toBe(false);
      expect(m.dizzy).toBe(true);
    }
  });

  it("can't be hit during the grace period, then the hero's next hit finishes it", () => {
    const { get } = setup();
    const m = get("gremlin");
    hit(m, m.hp);
    expect(m.targetable).toBe(false);
    hit(m, 1);
    expect(m.alive).toBe(true);
    run(m, 0.6);
    expect(m.targetable).toBe(true);
    hit(m, 1, "pet");
    expect(m.alive).toBe(true); // the pet doesn't steal the finishing blow
    hit(m, 1);
    expect(m.alive).toBe(false);
    expect(m.criticalFix).toBe(false);
  });

  it(`goes down by itself after ${DAZE_SEC} s`, () => {
    const { get } = setup();
    const m = get("mimic");
    hit(m, m.hp);
    run(m, DAZE_SEC - 0.1);
    expect(m.dazed).toBe(true);
    run(m, 0.2);
    expect(m.alive).toBe(false);
  });

  it("never hurts the hero while dazed", () => {
    const { world, get } = setup();
    const m = get("gremlin");
    hit(m, m.hp);
    m.engaged = true;
    world.hero.x = m.x;
    world.hero.y = m.y;
    applyContactDamage([m], world);
    expect(world.heroHits).toBe(0);
  });

  it("the finisher's answer only reaches the monster it was opened for", () => {
    const { monsters, get } = setup();
    const a = get("gremlin");
    const b = get("phantom");
    hit(a, a.hp);
    hit(b, b.hp);
    a.finisherOpened = true;
    answerFinisher(monsters, b.finding.id, true);
    expect(b.alive).toBe(true);
    answerFinisher(monsters, a.finding.id, true);
    expect(a.alive).toBe(false);
    expect(a.criticalFix).toBe(true);
  });

  it("an opened but unanswered finisher counts as declining; other dazed monsters wait", () => {
    const { monsters, get } = setup();
    const a = get("swallowToad");
    const b = get("spaghetti");
    hit(a, a.hp);
    hit(b, b.hp);
    a.finisherOpened = true;
    declineUnanswered(monsters);
    expect(a.alive).toBe(false);
    expect(a.criticalFix).toBe(false);
    expect(b.dazed).toBe(true);
  });

  it("dies exactly once: a second collapse changes nothing", () => {
    const { get } = setup();
    const m = get("evalSerpent");
    hit(m, m.hp);
    m.collapse(true);
    m.updateDying(0.1);
    m.collapse(false);
    expect(m.criticalFix).toBe(true);
    expect(m.dyingFor).toBeCloseTo(0.1);
  });
});
