/**
 * Monster traits, headless: where runes and echoes are put, what each trait
 * does, that it respects the dazed state and fainting, and that a finding
 * with two bodies is still defeated exactly once.
 */
import { describe, expect, it } from "vitest";
import type { HitSource } from "@/game/combat/hittable";
import { applyContactDamage } from "@/game/entities/monsters/engagement";
import type { Monster } from "@/game/entities/monsters/monster";
import { createBodies, ECHO_RANGE, RUNE_RANGE } from "@/game/entities/monsters/traits";
import { ECHO_BONUS_MULT, ECHO_WINDOW_SEC, EchoTrait } from "@/game/entities/monsters/traits/echo";
import { MAX_GROWTH_HITS, targetScale } from "@/game/entities/monsters/traits/growth";
import { LeavesNameTrait } from "@/game/entities/monsters/traits/leftovers";
import { NoodlesTrait } from "@/game/entities/monsters/traits/noodles";
import { DefeatLedger } from "@/game/entities/monsters/traits/oneDefeat";
import { BURP_DELAY_SEC, BURP_STUN_SEC, SWALLOWS_BEFORE_BURP, SwallowTrait } from "@/game/entities/monsters/traits/swallow";
import { UndefinedNameTrait } from "@/game/entities/monsters/traits/undefinedName";
import { generateDungeon } from "@/lib/worldgen";
import { fileWithEveryTrait, TestWorld, traitSetup } from "./monstersWorld";

const DT = 1 / 60;
const TILE = 16;

function setup(seed = 1) {
  const file = fileWithEveryTrait();
  const dungeon = generateDungeon(file, seed);
  const world = new TestWorld(dungeon, seed);
  const traits = traitSetup(dungeon, file);
  const byId = new Map(file.findings.map((f) => [f.id, f]));
  const monsters = dungeon.monsters.flatMap((s) => createBodies(s, byId.get(s.findingId)!, world, traits));
  const byCode = (code: string) => monsters.filter((m) => m.finding.code === code);
  return { file, dungeon, world, monsters, byCode, one: (code: string) => byCode(code)[0] };
}

function hit(m: Monster, damage = 1, source: HitSource = "weapon"): void {
  m.takeHit({ damage, knockbackX: 0, knockbackY: 0, crit: false, source });
}

function run(m: Monster, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) if (m.alive) m.update(DT);
}

const shot = (vx: number, vy: number) => ({ x: 0, y: 0, vx, vy, sprite: "duck" as const });

describe("floor spots for runes and echoes", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`puts them on open, reachable floor near their monster, never on reserved tiles (seed ${seed})`, () => {
      const { dungeon, monsters } = setup(seed);
      const solidProp = new Set(dungeon.props.map((p) => p.y * dungeon.width + p.x));
      const starts = new Set(dungeon.monsters.map((s) => s.y * dungeon.width + s.x));
      const checkSpot = (tile: { x: number; y: number }, near: { x: number; y: number }, max: number) => {
        const i = tile.y * dungeon.width + tile.x;
        expect(dungeon.solid[i]).toBe(0);
        expect(solidProp.has(i)).toBe(false);
        expect(starts.has(i)).toBe(false);
        expect(Math.max(Math.abs(tile.x - dungeon.entrance.x), Math.abs(tile.y - dungeon.entrance.y))).toBeGreaterThan(1);
        expect(tile).not.toEqual(dungeon.exit);
        expect(tile.x === dungeon.chest.x && (tile.y === dungeon.chest.y || tile.y === dungeon.chest.y - 1)).toBe(false);
        expect(Math.hypot(tile.x - near.x, tile.y - near.y)).toBeLessThanOrEqual(max);
      };
      for (const m of monsters) {
        const home = { x: Math.floor(m.homeX / TILE), y: Math.floor(m.homeY / TILE) };
        if (m.trait instanceof UndefinedNameTrait && m.trait.runeTile) checkSpot(m.trait.runeTile, home, RUNE_RANGE.max);
      }
      const [voice, echo] = monsters.filter((m) => m.trait instanceof EchoTrait);
      if (echo) checkSpot({ x: Math.floor(echo.homeX / TILE), y: Math.floor(echo.homeY / TILE) }, { x: Math.floor(voice.homeX / TILE), y: Math.floor(voice.homeY / TILE) }, ECHO_RANGE.max);
    });
  }
});

describe("phantom: the undefined name", () => {
  it("starts as a harmless shimmer that hits only pass through", () => {
    const { world, one } = setup();
    const m = one("F821");
    const trait = m.trait as UndefinedNameTrait;
    expect(trait.runeTile).not.toBeNull();
    expect(m.kind).toBe("object"); // no damage numbers, no pet pecks
    const hp = m.hp;
    hit(m, 5);
    expect(m.hp).toBe(hp);
    m.engaged = true;
    world.hero.x = m.x;
    world.hero.y = m.y;
    applyContactDamage([m], world);
    expect(world.heroHits).toBe(0);
  });

  it("is defined by a few hits even if the rune is ignored, without losing HP", () => {
    const { one } = setup();
    const m = one("F821");
    const hp = m.hp;
    for (let i = 0; i < 3; i++) hit(m);
    expect((m.trait as UndefinedNameTrait).isDefined).toBe(true);
    expect(m.kind).toBe("monster");
    expect(m.hp).toBe(hp);
    run(m, 1);
    hit(m, 2);
    expect(m.hp).toBe(hp - 2);
  });

  it("is defined (and stunned) when the hero steps on its rune", () => {
    const { world, one } = setup();
    const m = one("F821");
    const rune = (m.trait as UndefinedNameTrait).runeTile!;
    world.hero.x = rune.x * TILE + 8;
    world.hero.y = rune.y * TILE + 10;
    m.update(DT);
    expect((m.trait as UndefinedNameTrait).isDefined).toBe(true);
    expect(m.dizzy).toBe(true);
    expect(m.trait?.holdsBrain?.(m)).toBe(true);
    run(m, 2);
    expect(m.dizzy).toBe(false);
    expect(m.alpha).toBeGreaterThan(0.9);
  });

  it("defines itself after a while near the hero, so it never blocks a dungeon", () => {
    const { one } = setup();
    const m = one("F821");
    m.engaged = true;
    run(m, 9);
    expect((m.trait as UndefinedNameTrait).isDefined).toBe(true);
  });

  it("keeps what it was through a faint: a shimmer stays a shimmer, a defined name stays defined", () => {
    const { one } = setup();
    const m = one("F821");
    m.resetForRetry();
    expect(m.kind).toBe("object");
    for (let i = 0; i < 3; i++) hit(m);
    m.resetForRetry();
    expect(m.kind).toBe("monster");
    expect(m.alpha).toBe(1);
  });
});

describe("growth: the mutable default", () => {
  it("grows and slows with every hit, keeps its HP rules and contact reach, and stops at the cap", () => {
    const { one } = setup();
    const m = one("B006");
    const hp = m.hp;
    for (let i = 0; i < MAX_GROWTH_HITS + 2; i++) {
      hit(m);
      run(m, 0.5);
    }
    expect(m.hp).toBe(hp - (MAX_GROWTH_HITS + 2));
    expect(m.scale).toBeCloseTo(targetScale(MAX_GROWTH_HITS), 2);
    expect(m.speedScale).toBeLessThan(1);
    expect(m.radius).toBeGreaterThan(m.bodyRadius); // easier to hit
  });

  it("does not grow from the killing blow or while dazed", () => {
    const { one } = setup();
    const m = one("B006");
    hit(m, m.hp);
    expect(m.dazed).toBe(true);
    const scale = m.scale;
    run(m, 0.6);
    hit(m);
    expect(m.scale).toBe(scale);
    expect(m.alive).toBe(false);
  });
});

describe("swallow toad", () => {
  it("swallows shots flying into its mouth, but not from above, below or behind", () => {
    const { one } = setup();
    const m = one("E722");
    m.facingLeft = true;
    expect(m.catchShot(shot(0, 100))).toBe(false); // from above
    expect(m.catchShot(shot(-100, 0))).toBe(false); // from behind
    expect(m.catchShot(shot(100, 10))).toBe(true); // into its face
    expect((m.trait as SwallowTrait).belly).toBe(1);
  });

  it(`burps after ${SWALLOWS_BEFORE_BURP} gulps and sits dazed, letting every shot land`, () => {
    const { one } = setup();
    const m = one("E722");
    m.facingLeft = true;
    for (let i = 0; i < SWALLOWS_BEFORE_BURP; i++) expect(m.catchShot(shot(100, 0))).toBe(true);
    expect(m.catchShot(shot(100, 0))).toBe(false); // full
    run(m, BURP_DELAY_SEC + 0.05);
    expect((m.trait as SwallowTrait).belly).toBe(0);
    expect(m.dizzy).toBe(true);
    expect(m.catchShot(shot(100, 0))).toBe(false);
    run(m, BURP_STUN_SEC);
    expect(m.dizzy).toBe(false);
  });

  it("never swallows while dazed, and forgets its belly when the hero faints", () => {
    const { one } = setup();
    const m = one("E722");
    m.facingLeft = true;
    m.catchShot(shot(100, 0));
    m.resetForRetry();
    expect((m.trait as SwallowTrait).belly).toBe(0);
    hit(m, m.hp);
    expect(m.dazed).toBe(true);
    m.facingLeft = true;
    expect(m.catchShot(shot(100, 0))).toBe(false);
  });
});

describe("echo bat: two bodies, one finding", () => {
  it("splits the finding's HP between a bat and a harmless echo", () => {
    const { byCode } = setup();
    const bodies = byCode("SIM118");
    expect(bodies).toHaveLength(2);
    expect(bodies[0].hp + bodies[1].hp).toBe(bodies[0].def.hp);
    expect(bodies.map((b) => b.touchDamage).sort()).toEqual([0, bodies[0].def.touchDamage]);
  });

  it("only the last body's death pays, and only once even when both fall in the same step", () => {
    const { world, byCode, monsters } = setup();
    const [a, b] = byCode("SIM118");
    const ledger = new DefeatLedger();
    hit(a, a.hp);
    expect(ledger.claim(a, monsters)).toBe(false);
    world.time = 1;
    expect(a.trait?.onDefeat?.(a, world, false)).toBe(1);
    hit(b, b.hp);
    expect(ledger.claim(b, monsters)).toBe(true);
    world.time = 1 + ECHO_WINDOW_SEC / 2;
    expect(b.trait?.onDefeat?.(b, world, true)).toBe(ECHO_BONUS_MULT);

    const again = setup();
    const [c, d] = again.byCode("SIM118");
    const sameStep = new DefeatLedger();
    hit(c, c.hp);
    hit(d, d.hp);
    const paid = [sameStep.claim(c, again.monsters), sameStep.claim(d, again.monsters)];
    expect(paid.filter(Boolean)).toHaveLength(1);
  });

  it("taking longer than the window costs nothing but the bonus", () => {
    const { world, byCode } = setup();
    const [a, b] = byCode("SIM118");
    world.time = 0;
    a.trait?.onDefeat?.(a, world, false);
    world.time = ECHO_WINDOW_SEC + 1;
    expect(b.trait?.onDefeat?.(b, world, true)).toBe(1);
  });
});

describe("the smaller touches", () => {
  it("dust bunnies and key thieves leave the right name behind", () => {
    const { one } = setup();
    expect((one("F401").trait as LeavesNameTrait).leftover().text).toBe("import os");
    expect((one("S105").trait as LeavesNameTrait).leftover().text).toBe('ADMIN_PASSWORD = "…"');
  });

  it("the spaghetti beast gets a clamped number of noodles, plain monsters get no trait", () => {
    const { one } = setup();
    expect((one("C901").trait as NoodlesTrait).count).toBe(12); // "(13 > 10)", clamped to MAX_NOODLES
    expect(one("F632").trait).toBeNull();
    expect(new NoodlesTrait(99).count).toBe(12);
    expect(new NoodlesTrait(0).count).toBe(3);
  });
});

describe("a hero who ignores every trait still wins", () => {
  for (const source of ["weapon", "projectile"] as const) {
    it(`clears every finding by just attacking (${source}), each defeated once`, () => {
      const { world, monsters } = setup(7);
      const ledger = new DefeatLedger();
      const paid = new Map<string, number>();
      const ATTACK_EVERY_SEC = 0.35;
      let t = 0;
      for (const m of monsters) {
        let swing = 0;
        for (let step = 0; step < 60 / DT && m.alive; step++) {
          t += DT;
          world.time = t;
          world.hero.x = m.x - 20; // always to its left: the toad faces it and gulps every projectile
          world.hero.y = m.y;
          m.engaged = true;
          m.update(DT);
          swing += DT;
          if (swing < ATTACK_EVERY_SEC || !m.targetable) continue;
          swing = 0;
          if (source === "projectile" && m.catchShot({ x: m.x, y: m.y, vx: 150, vy: 0, sprite: "duck" })) continue;
          hit(m, 1, source);
        }
        expect(m.alive, `${m.finding.code} still alive after 60 s`).toBe(false);
      }
      for (const m of monsters) if (ledger.claim(m, monsters)) paid.set(m.finding.id, (paid.get(m.finding.id) ?? 0) + 1);
      expect([...paid.values()].every((n) => n === 1)).toBe(true);
      expect(paid.size).toBe(new Set(monsters.map((m) => m.finding.id)).size);
    });
  }
});
