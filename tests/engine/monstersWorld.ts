/**
 * Test helper: a headless MonsterWorld over a real generated dungeon, with a
 * hero that wanders around at random. No canvas, no sound — effects are
 * no-ops — so monster brains can be simulated for thousands of steps.
 */
import { emptyOutline } from "@/lib/analysis/outline";
import type { HostileShot, MonsterFx, MonsterWorld } from "@/game/entities/monsters/brain";
import { Hazards } from "@/game/entities/monsters/hazards";
import type { Monster } from "@/game/entities/monsters/monster";
import { hasLineOfSight } from "@/game/entities/monsters/steering";
import { MONSTERS } from "@/lib/game/catalog";
import { mulberry32 } from "@/lib/rng";
import { MONSTER_KINDS, type AnalyzedFile, type Dungeon, type Finding, type MonsterKind } from "@/lib/types";

const TILE = 16;
const HERO_SPEED = 80;

const noFx: MonsterFx = { sfx() {}, dust() {}, sparkles() {}, poof() {}, bits() {}, noodles() {}, shake() {} };

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

  /** The hero strolls around the dungeon in random directions (never through walls). */
  moveHero(dt: number): void {
    this.time += dt;
    this.heroTurnIn -= dt;
    if (this.heroTurnIn <= 0) {
      this.heroAngle = this.random() * Math.PI * 2;
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

  /** Puts the hero on a free tile 2–3 tiles from a monster, so every monster gets a turn to fight. */
  visit(m: Monster): void {
    for (let tries = 0; tries < 50; tries++) {
      const a = this.random() * Math.PI * 2;
      const r = (2 + this.random()) * TILE;
      const tx = Math.floor((m.x + Math.cos(a) * r) / TILE);
      const ty = Math.floor((m.y + Math.sin(a) * r) / TILE);
      if (this.blockedTile(tx, ty, false)) continue;
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
