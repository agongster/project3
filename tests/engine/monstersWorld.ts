/**
 * Test helper: a headless MonsterWorld over a real generated dungeon, with a
 * hero that wanders around at random. No canvas, no sound — effects are
 * no-ops — so monster brains can be simulated for thousands of steps.
 */
import { emptyOutline } from "@/lib/analysis/outline";
import { ruleInfo } from "@/lib/analysis/rules";
import type { HostileShot, MonsterFx, MonsterWorld } from "@/game/entities/monsters/brain";
import { applyContactDamage, separate, updateEngagement } from "@/game/entities/monsters/engagement";
import type { TraitSetup } from "@/game/entities/monsters/traits";
import { dungeonSpotMap, FloorSpots } from "@/game/entities/monsters/traits/floorSpots";
import { layoutCarvings } from "@/game/scenes/floorCodeLayout";
import { Hazards } from "@/game/entities/monsters/hazards";
import type { Monster } from "@/game/entities/monsters/monster";
import { hasLineOfSight } from "@/game/entities/monsters/steering";
import { MONSTERS } from "@/lib/game/catalog";
import { championOf } from "@/lib/game/champions";
import { mulberry32 } from "@/lib/rng";
import { MONSTER_KINDS, type AnalyzedFile, type Dungeon, type Finding, type MonsterKind } from "@/lib/types";

const TILE = 16;
const HERO_SPEED = 80;
/** One simulation step (s). */
export const DT = 1 / 60;
/** Steps the hero spends with each monster (≈ 7 s) before defeating it. */
const VISIT_STEPS = 420;
/** The hero swings at monsters this close… */
const SWING_REACH_PX = 26;
/** …this often per step (a frantic button-masher). */
const SWING_CHANCE = 0.08;
/** Monsters within this distance always count as woken up by the hero (see CLOSE_WAKE_PX). */
export const CLOSE_PX = 28;

const noFx: MonsterFx = { sfx() {}, dust() {}, sparkles() {}, poof() {}, bits() {}, noodles() {}, shake() {}, floatText() {}, flash() {}, bubbles() {}, spitOut() {}, ring() {} };

/** A file with one finding per monster kind (bosses included), in line order. */
export function fileWithEveryMonster(path = "every/monster.py"): AnalyzedFile {
  const findings: Finding[] = MONSTER_KINDS.map((kind: MonsterKind, i) => ({
    id: `${path}:${i + 1}:1:T${i}`,
    path,
    code: `T${i}`,
    title: `Test ${kind}`,
    message: "",
    line: (i + 1) * 10,
    col: 1,
    endLine: (i + 1) * 10,
    endCol: 2,
    severity: MONSTERS[kind].severity,
    category: "bug",
    monster: kind,
    snippet: [],
    tip: "",
  }));
  const quality = { score: 50, grade: "C" as const, highlights: [], metrics: { definitions: 0, docCoverage: 0, hintCoverage: 0, commentRatio: 0, probeHits: 0 } };
  return { path, size: 1000, lineCount: 200, status: "ok", kind: "module", findings, overflow: 0, quality, outline: emptyOutline() };
}

/** One finding per trait (and the plain gremlin), with real rule codes and Ruff-style messages and snippets. */
const TRAIT_FINDINGS: { code: string; message: string; code_line: string }[] = [
  { code: "F401", message: "`os` imported but unused", code_line: "import os" },
  { code: "FIX002", message: "Line contains TODO, consider resolving the issue", code_line: "# TODO: ask Granny" },
  { code: "SIM118", message: "Use `key in dict` instead of `key in dict.keys()`", code_line: "if k in d.keys():" },
  { code: "F632", message: "Use `==` to compare constant literals", code_line: 'if x is "a":' },
  { code: "F821", message: "Undefined name `PRICES`", code_line: "return PRICES[p]" },
  { code: "B006", message: "Do not use mutable data structures for argument defaults", code_line: "def add(item, basket=[]):" },
  { code: "A001", message: "Variable `list` is shadowing a Python builtin", code_line: "list = sorted(x)" },
  { code: "E722", message: "Do not use bare `except`", code_line: "except:" },
  { code: "C901", message: "`price_of` is too complex (13 > 10)", code_line: "def price_of(a, b):" },
  { code: "S105", message: 'Possible hardcoded password assigned to: "ADMIN_PASSWORD"', code_line: 'ADMIN_PASSWORD = "x"' },
  { code: "S307", message: "Use of possibly insecure function", code_line: "eval(text)" },
  { code: "SYNTAX", message: "Expected `)`, found newline", code_line: "f(" },
];

/** A file whose findings carry every monster trait (codes from the real rule table). */
export function fileWithEveryTrait(path = "every/trait.py"): AnalyzedFile {
  const base = fileWithEveryMonster(path);
  const findings: Finding[] = TRAIT_FINDINGS.map((t, i) => {
    const info = ruleInfo(t.code);
    const line = (i + 1) * 10;
    return {
      ...base.findings[0],
      id: `${path}:${line}:1:${t.code}`,
      code: t.code,
      title: info.title,
      message: t.message,
      line,
      endLine: line,
      severity: info.severity,
      category: info.category,
      monster: info.monster,
      snippet: [{ n: line, text: t.code_line, hit: true }],
    };
  });
  return { ...base, findings };
}

/** What the director gives body building, made from the dungeon data alone (every pot still unbroken). */
export function traitSetup(dungeon: Dungeon, file: AnalyzedFile): TraitSetup {
  const solidProps = new Set(dungeon.props.filter((p) => p.solid).map((p) => p.y * dungeon.width + p.x));
  const isOpen = (tx: number, ty: number) =>
    tx >= 0 && ty >= 0 && tx < dungeon.width && ty < dungeon.height && dungeon.solid[ty * dungeon.width + tx] === 0 && !solidProps.has(ty * dungeon.width + tx);
  return { spots: new FloorSpots(dungeonSpotMap(dungeon, isOpen, layoutCarvings(dungeon, file.findings))), outline: file.outline, championId: championOf(file)?.id ?? null };
}

export class TestWorld implements MonsterWorld {
  time = 0;
  readonly hero: { x: number; y: number };
  mayAttack = true;
  readonly random: () => number;
  readonly fx = noFx;
  readonly hazards = new Hazards();
  shots: HostileShot[] = [];
  heroHits = 0;
  private readonly solidProps = new Set<number>();
  private heroAngle = 0;
  private heroTurnIn = 0;

  constructor(
    readonly dungeon: Dungeon,
    seed: number,
  ) {
    this.random = mulberry32(seed);
    for (const p of dungeon.props) if (p.solid) this.solidProps.add(p.y * dungeon.width + p.x);
    this.hero = { x: dungeon.entrance.x * TILE + 8, y: dungeon.entrance.y * TILE + 13 };
  }

  isWall(tx: number, ty: number): boolean {
    const d = this.dungeon;
    if (tx < 0 || ty < 0 || tx >= d.width || ty >= d.height) return true;
    return d.solid[ty * d.width + tx] === 1;
  }

  inSafeZone(tx: number, ty: number): boolean {
    return Math.abs(tx - this.dungeon.entrance.x) <= 1 && Math.abs(ty - this.dungeon.entrance.y) <= 1;
  }

  blockedTile(tx: number, ty: number, flying: boolean): boolean {
    if (this.inSafeZone(tx, ty) || this.isWall(tx, ty)) return true;
    return !flying && this.solidProps.has(ty * this.dungeon.width + tx);
  }

  canSee(ax: number, ay: number, bx: number, by: number): boolean {
    return hasLineOfSight(ax, ay, bx, by, (px, py) => !this.isWall(Math.floor(px / TILE), Math.floor(py / TILE)));
  }

  hurtHero(): boolean {
    this.heroHits++;
    return true;
  }

  fireHostile(shot: HostileShot): void {
    this.shots.push(shot);
  }

  /**
   * The hero strolls around the dungeon in random directions (never through
   * walls); given a `toward` point, about half of the turns head for it, so
   * rooms with interior walls don't keep the hero from every monster.
   */
  moveHero(dt: number, toward?: { x: number; y: number }): void {
    this.time += dt;
    this.heroTurnIn -= dt;
    if (this.heroTurnIn <= 0) {
      const homing = toward && this.random() < 0.5;
      this.heroAngle = homing ? Math.atan2(toward.y - this.hero.y, toward.x - this.hero.x) : this.random() * Math.PI * 2;
      this.heroTurnIn = 0.3 + this.random() * 0.8;
    }
    const nx = this.hero.x + Math.cos(this.heroAngle) * HERO_SPEED * dt;
    const ny = this.hero.y + Math.sin(this.heroAngle) * HERO_SPEED * dt;
    if (this.isWall(Math.floor(nx / TILE), Math.floor(ny / TILE))) this.heroTurnIn = 0;
    else {
      this.hero.x = nx;
      this.hero.y = ny;
    }
  }

  /** Puts the hero on a free tile 1.5–3 tiles from a monster, in its sight, so every monster gets a turn to fight. */
  visit(m: Monster): void {
    for (let tries = 0; tries < 80; tries++) {
      const a = this.random() * Math.PI * 2;
      const r = (1.5 + this.random() * 1.5) * TILE;
      const tx = Math.floor((m.x + Math.cos(a) * r) / TILE);
      const ty = Math.floor((m.y + Math.sin(a) * r) / TILE);
      if (this.blockedTile(tx, ty, false) || !this.canSee(m.x, m.y - 4, tx * TILE + 8, ty * TILE + 9)) continue;
      this.hero.x = tx * TILE + 8;
      this.hero.y = ty * TILE + 13;
      return;
    }
  }

  /** True when the monster's feet box overlaps a tile it may not enter. */
  isStuckInWall(m: Monster): boolean {
    const b = m.feetBox();
    for (let ty = Math.floor(b.y / TILE); ty <= Math.floor((b.y + b.h - 1e-6) / TILE); ty++) {
      for (let tx = Math.floor(b.x / TILE); tx <= Math.floor((b.x + b.w - 1e-6) / TILE); tx++) {
        if (this.blockedTile(tx, ty, m.flying)) return true;
      }
    }
    return false;
  }
}

/** A random swing: no damage (so the monster keeps being tested), random knockback. */
function swingAt(m: Monster, world: TestWorld): void {
  const a = world.random() * Math.PI * 2;
  const push = 4 + world.random() * 12;
  m.takeHit({ damage: 0, knockbackX: Math.cos(a) * push, knockbackY: Math.sin(a) * push, crit: false, source: "weapon" });
}

/**
 * The headless tour: the hero visits the monsters one after another
 * (wandering around each, swinging wildly with random knockback, then
 * defeating it), while the others keep pottering about; `check` runs after
 * every step.
 */
export function runTour(world: TestWorld, monsters: Monster[], check: (world: TestWorld, monsters: Monster[], step: number) => void): void {
  const steps = monsters.length * VISIT_STEPS;
  for (let step = 0; step < steps; step++) {
    const visiting = monsters[Math.floor(step / VISIT_STEPS)];
    if (step % VISIT_STEPS === 0) world.visit(visiting);
    world.moveHero(DT, visiting);
    updateEngagement(monsters, world, true, DT);
    for (const m of monsters) {
      if (!m.alive) continue;
      m.update(DT);
      const near = Math.hypot(m.x - world.hero.x, m.y - world.hero.y) < SWING_REACH_PX;
      if (m.targetable && near && world.random() < SWING_CHANCE) swingAt(m, world);
    }
    separate(monsters);
    applyContactDamage(monsters, world);
    world.hazards.update(DT, world);
    check(world, monsters, step);
    // End of the visit: the hero wins, the next boss may take its turn.
    if (step % VISIT_STEPS === VISIT_STEPS - 1) visiting.takeHit({ damage: visiting.hp, knockbackX: 0, knockbackY: 0, crit: false, source: "weapon" });
  }
}
