/**
 * Things that fly: the hero's projectiles (ducks, arrows, sparks, the
 * boomerang, the Merge Saber's wave) and HOSTILE projectiles (monster
 * spit, orbs...) which the monster code fires with `fireHostile`.
 *
 * Positions are on the GROUND (like everything else); projectiles are drawn
 * FLY_HEIGHT px higher with a small shadow underneath, so they read as
 * flying and y-sort correctly with walls and monsters.
 */
import { drawSprite, type Sprite } from "@/game/art";
import { uiSprite } from "@/game/art/ui";
import { projectileSprite, type ProjectileName } from "@/game/art/weapons";
import type { SceneContext } from "../scenes/context";
import type { Drawable } from "../scenes/scene";
import type { Hittable } from "./hittable";
import { strike } from "./strike";

/** Projectiles are drawn this many px above their ground position. */
const FLY_HEIGHT = 8;
/** Collision radius of the hero's projectiles. */
const SHOT_RADIUS = 5;
/** Homing shots look for monsters this far away... */
const HOMING_RANGE_PX = 100;
/** ...and turn toward them at most this fast (radians per second). */
const HOMING_TURN_RATE = 6;
/** A returning boomerang is caught when this close to the hero. */
const CATCH_RADIUS_PX = 10;
/** Animation frames per second for spinning projectile sprites. */
const SPIN_FPS = 14;
/** Hostile shots disappear after this many seconds if they hit nothing. */
const DEFAULT_HOSTILE_LIFE = 4;
/** Sprites that are drawn rotated to their flight direction (others spin or flip). */
const ROTATED = new Set<string>(["arrow", "wave", "spark"]);

export interface PlayerShotSpec {
  x: number;
  y: number;
  angle: number;
  speed: number;
  /** Flight distance in px (the weapon's range). */
  maxDist: number;
  damage: number;
  knockback: number;
  pierce?: boolean;
  homing?: boolean;
  /** Flies out to maxDist, then comes back to the hero (hitting things both ways). */
  boomerang?: boolean;
  sprite: ProjectileName;
  /** Hits play a quack. */
  quack?: boolean;
}

interface PlayerShot extends Required<PlayerShotSpec> {
  vx: number;
  vy: number;
  traveled: number;
  returning: boolean;
  age: number;
  alive: boolean;
  hit: Set<Hittable>;
}

/** What the monster code passes to `fireHostile`. */
export interface HostileShotSpec {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Half-hearts dealt to the hero. */
  damage: number;
  sprite: Sprite;
  /** Collision radius (default 4). */
  radius?: number;
  /** Seconds before it fizzles (default 4). */
  life?: number;
  /** Flies over walls instead of popping on them. */
  passWalls?: boolean;
  /** Who fired it (gets thorns damage back if it hits). */
  owner?: Hittable;
}

interface HostileShot extends HostileShotSpec {
  age: number;
  alive: boolean;
}

export class Projectiles {
  private shots: PlayerShot[] = [];
  private hostile: HostileShot[] = [];

  constructor(private readonly ctx: SceneContext) {}

  firePlayer(spec: PlayerShotSpec): void {
    this.shots.push({
      pierce: false,
      homing: false,
      boomerang: false,
      quack: false,
      ...spec,
      vx: Math.cos(spec.angle) * spec.speed,
      vy: Math.sin(spec.angle) * spec.speed,
      traveled: 0,
      returning: false,
      age: 0,
      alive: true,
      hit: new Set(),
    });
  }

  fireHostile(spec: HostileShotSpec): void {
    this.hostile.push({ ...spec, age: 0, alive: true });
  }

  /** True while one of the hero's boomerangs is still in the air. */
  boomerangOut(): boolean {
    return this.shots.some((s) => s.alive && s.boomerang);
  }

  update(dt: number): void {
    for (const s of this.shots) this.updateShot(s, dt);
    for (const h of this.hostile) this.updateHostile(h, dt);
    this.shots = this.shots.filter((s) => s.alive);
    this.hostile = this.hostile.filter((h) => h.alive);
  }

  drawables(out: Drawable[]): void {
    for (const s of this.shots) {
      const frame = Math.floor(s.age * SPIN_FPS);
      const sprite = projectileSprite(s.sprite, frame);
      const angle = Math.atan2(s.vy, s.vx);
      out.push({
        y: s.y,
        shadow: (g) => drawSprite(g, uiSprite("shadowSmall"), s.x, s.y),
        draw: (g) => {
          if (ROTATED.has(s.sprite)) drawSprite(g, sprite, s.x, s.y - FLY_HEIGHT, { rotation: angle });
          else drawSprite(g, sprite, s.x, s.y - FLY_HEIGHT, { flipX: s.vx < 0 });
        },
      });
    }
    for (const h of this.hostile) {
      out.push({
        y: h.y,
        shadow: (g) => drawSprite(g, uiSprite("shadowSmall"), h.x, h.y),
        draw: (g) => drawSprite(g, h.sprite, h.x, h.y - FLY_HEIGHT),
      });
    }
  }

  private updateShot(s: PlayerShot, dt: number): void {
    const ctx = this.ctx;
    const player = ctx.game.player;
    s.age += dt;
    if (s.returning) {
      // Fly home (through walls, so a boomerang can never get stuck).
      const dx = player.x - s.x;
      const dy = player.y - 4 - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist < CATCH_RADIUS_PX) {
        s.alive = false;
        ctx.audio.sfx("catch", { volume: 0.5 });
        return;
      }
      s.vx = (dx / dist) * s.speed;
      s.vy = (dy / dist) * s.speed;
    } else if (s.homing) {
      this.steerTowardMonster(s, dt);
    }

    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.traveled += s.speed * dt;

    if (!s.returning && (ctx.isSolid(s.x, s.y) || s.traveled >= s.maxDist)) {
      if (s.boomerang) this.turnBack(s);
      else return this.pop(s);
    }

    for (const target of ctx.hittables) {
      if (!target.alive || s.hit.has(target)) continue;
      if (Math.hypot(target.x - s.x, target.y - s.y) > target.radius + SHOT_RADIUS) continue;
      s.hit.add(target);
      strike(ctx, target, { damage: s.damage, fromX: s.x - s.vx, fromY: s.y - s.vy, knockback: s.knockback, source: "projectile", quack: s.quack });
      if (!s.pierce && !s.boomerang) return this.pop(s);
    }
  }

  private turnBack(s: PlayerShot): void {
    s.returning = true;
    s.hit.clear(); // it may hit the same monster again on the way back
  }

  private pop(s: PlayerShot): void {
    s.alive = false;
    this.ctx.particles.emit({ x: s.x, y: s.y - FLY_HEIGHT, life: 0.25, sprite: uiSprite("poof", 0) });
  }

  private steerTowardMonster(s: PlayerShot, dt: number): void {
    let best: Hittable | null = null;
    let bestDist = HOMING_RANGE_PX;
    for (const t of this.ctx.hittables) {
      if (!t.alive || t.kind !== "monster" || s.hit.has(t)) continue;
      const d = Math.hypot(t.x - s.x, t.y - s.y);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    if (!best) return;
    const current = Math.atan2(s.vy, s.vx);
    const wanted = Math.atan2(best.y - s.y, best.x - s.x);
    let diff = wanted - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = Math.max(-HOMING_TURN_RATE * dt, Math.min(HOMING_TURN_RATE * dt, diff));
    s.vx = Math.cos(current + turn) * s.speed;
    s.vy = Math.sin(current + turn) * s.speed;
  }

  private updateHostile(h: HostileShot, dt: number): void {
    const ctx = this.ctx;
    const player = ctx.game.player;
    h.age += dt;
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    if (h.age > (h.life ?? DEFAULT_HOSTILE_LIFE) || (!h.passWalls && ctx.isSolid(h.x, h.y))) {
      h.alive = false;
      ctx.particles.emit({ x: h.x, y: h.y - FLY_HEIGHT, life: 0.25, sprite: uiSprite("poof", 0) });
      return;
    }
    const radius = h.radius ?? 4;
    if (Math.hypot(player.x - h.x, player.y - 4 - h.y) < radius + 5 && player.hurt(h.damage, h.x, h.y, ctx, h.owner)) {
      h.alive = false;
    }
  }
}
