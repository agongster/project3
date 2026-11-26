/**
 * The real `MonsterWorld`: an adapter that lets monster brains see and poke
 * the dungeon scene (hero, map, particles, sounds, hostile projectiles)
 * through the small interface in brain.ts.
 *
 * It also owns two fairness rules that every brain gets for free:
 *  - the SAFE ZONE: the 3×3 tiles around the entrance are closed to
 *    monsters, and a hero standing there cannot be hurt;
 *  - `mayAttack`: false during the grace second after entering/respawning,
 *    while the hero is in the safe zone, and while they lie fainted.
 */
import { uiSprite } from "@/game/art/ui";
import { projectileSprite } from "@/game/art/weapons";
import type { Point } from "@/lib/types";
import { TILE_PX } from "../../engine/collision";
import type { SceneContext } from "../../scenes/context";
import { emitDust } from "../playerFx";
import type { HostileShot, MonsterFx, MonsterWorld } from "./brain";
import { Hazards } from "./hazards";
import type { Monster } from "./monster";
import { hasLineOfSight } from "./steering";

/** The safe zone reaches this many tiles from the entrance in every direction (1 → 3×3). */
const SAFE_ZONE_REACH_TILES = 1;
/** The hero's tile is read this far above their feet (same as the exit check in dungeon.ts). */
const HERO_TILE_DY = 3;
const POOF_FRAMES = 4;
const POOF_FRAME_SEC = 0.07;

export class SceneMonsterWorld implements MonsterWorld {
  time = 0;
  readonly hero = { x: 0, y: 0 };
  mayAttack = false;
  readonly random = Math.random;
  readonly fx: MonsterFx;
  readonly hazards = new Hazards();

  constructor(
    private readonly ctx: SceneContext,
    private readonly entrance: Point,
  ) {
    this.fx = sceneFx(ctx);
  }

  /** Copies the hero's position and decides whether monsters may attack this step. */
  refresh(graceLeft: number): void {
    const player = this.ctx.game.player;
    this.time = this.ctx.time;
    this.hero.x = player.x;
    this.hero.y = player.y;
    this.mayAttack = graceLeft <= 0 && !player.fainted && !this.heroIsSafe();
  }

  private inSafeZone(tx: number, ty: number): boolean {
    return Math.abs(tx - this.entrance.x) <= SAFE_ZONE_REACH_TILES && Math.abs(ty - this.entrance.y) <= SAFE_ZONE_REACH_TILES;
  }

  private heroIsSafe(): boolean {
    const p = this.ctx.game.player;
    return this.inSafeZone(Math.floor(p.x / TILE_PX), Math.floor((p.y - HERO_TILE_DY) / TILE_PX));
  }

  blockedTile(tx: number, ty: number, flying: boolean): boolean {
    if (this.inSafeZone(tx, ty)) return true;
    return flying ? this.isWall(tx, ty) : this.ctx.isSolidTile(tx, ty);
  }

  canSee(ax: number, ay: number, bx: number, by: number): boolean {
    return hasLineOfSight(ax, ay, bx, by, (px, py) => !this.isWall(Math.floor(px / TILE_PX), Math.floor(py / TILE_PX)));
  }

  hurtHero(damage: number, fromX: number, fromY: number, attacker: Monster): boolean {
    if (this.heroIsSafe()) return false;
    return this.ctx.game.player.hurt(damage, fromX, fromY, this.ctx, attacker);
  }

  fireHostile(shot: HostileShot, owner: Monster): void {
    this.ctx.projectiles.fireHostile({ ...shot, sprite: projectileSprite(shot.sprite, 0), owner });
  }

  /** Terrain only (walls, void): what flyers and eyes care about. Outside the map counts as wall. */
  private isWall(tx: number, ty: number): boolean {
    const map = this.ctx.map;
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
    return map.solid[ty * map.width + tx] === 1;
  }
}

/** A smoke poof that plays all its animation frames. */
export function playPoof(ctx: SceneContext, x: number, y: number): void {
  for (let f = 0; f < POOF_FRAMES; f++) {
    ctx.particles.emit({ x, y, life: POOF_FRAME_SEC, delay: f * POOF_FRAME_SEC, sprite: uiSprite("poof", f), fade: false });
  }
}

/** Little coloured squares that jump up and fall back down. */
export function emitBits(ctx: SceneContext, x: number, y: number, count: number, colors: readonly string[]): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 15 + Math.random() * 35;
    ctx.particles.emit({
      x,
      y,
      z: 4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.6,
      vz: 30 + Math.random() * 40,
      gravity: 220,
      life: 0.5 + Math.random() * 0.3,
      color: colors[i % colors.length],
      size: 2,
      drag: 1.5,
    });
  }
}

function sceneFx(ctx: SceneContext): MonsterFx {
  return {
    sfx: (name, opts) => ctx.audio.sfx(name, opts),
    dust: (x, y, count) => emitDust(ctx, x, y, count),
    sparkles: (x, y, count) => ctx.particles.burst(count, x, y, 18, { life: 0.6, sprite: uiSprite("sparkle", 0), drag: 3 }),
    poof: (x, y) => playPoof(ctx, x, y - 6),
    bits: (x, y, count, colors) => emitBits(ctx, x, y, count, colors),
    noodles: (x, y, count) => {
      for (let i = 0; i < count; i++) {
        const vx = (Math.random() - 0.5) * 70;
        ctx.particles.emit({ x, y, z: 8, vx, vy: (Math.random() - 0.5) * 30, vz: 50 + Math.random() * 30, gravity: 200, life: 0.8, sprite: projectileSprite("noodle", i), drag: 1 });
      }
    },
    shake: (amount) => ctx.shake(amount),
  };
}
