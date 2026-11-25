/**
 * `strike`: what happens when ANY hit lands on a Hittable — weapon swings,
 * projectiles, the fighter pet's peck, thorns. One place for all the juice:
 *
 *   crit roll → target.takeHit → hit-stop → damage number → hit sparks →
 *   camera shake → hit / crit sound → combo +1
 *
 * Objects (bushes, pots) handle their own break effects, so they only get
 * the combo and a light shake from here.
 */
import { uiSprite } from "@/game/art/ui";
import type { SceneContext } from "../scenes/context";
import type { HitSource, Hittable } from "./hittable";

/** Freeze frames when a hit lands on a monster. */
const HIT_STOP_MS = 50;
const CRIT_HIT_STOP_MS = 80;
const HIT_SHAKE = 0.14;
const CRIT_SHAKE = 0.28;
const OBJECT_SHAKE = 0.08;
const SPARK_COUNT = 5;

export interface StrikeOptions {
  /** Half-hearts before the crit roll. */
  damage: number;
  /** Where the blow comes from (knockback points away from here). */
  fromX: number;
  fromY: number;
  /** Knockback distance in pixels. */
  knockback: number;
  source: HitSource;
  /** Play a quack instead of the usual hit sound (Rubber Duck, Golden Duck). */
  quack?: boolean;
  /** Pet pecks and thorns never crit. */
  canCrit?: boolean;
}

export function strike(ctx: SceneContext, target: Hittable, opts: StrikeOptions): void {
  if (!target.alive) return;
  const canCrit = opts.canCrit ?? (opts.source === "weapon" || opts.source === "projectile");
  const crit = canCrit && Math.random() < ctx.stats.critChance;
  const damage = crit ? opts.damage * 2 : opts.damage;
  const angle = Math.atan2(target.y - opts.fromY, target.x - opts.fromX);

  target.takeHit({
    damage,
    knockbackX: Math.cos(angle) * opts.knockback,
    knockbackY: Math.sin(angle) * opts.knockback,
    crit,
    source: opts.source,
  });
  ctx.game.combo.hit();

  if (target.kind === "object") {
    ctx.shake(OBJECT_SHAKE);
    ctx.hitStop(HIT_STOP_MS / 2);
    return;
  }

  ctx.hitStop(crit ? CRIT_HIT_STOP_MS : HIT_STOP_MS);
  ctx.shake(crit ? CRIT_SHAKE : HIT_SHAKE);
  ctx.floatText(target.x, target.y - target.radius - 8, crit ? `${damage}!` : `${damage}`, crit ? "crit" : "damage");
  ctx.audio.sfx(opts.quack ? "quack" : crit ? "crit" : "hit", { pitch: 0.95 + Math.random() * 0.15 });
  emitHitSparks(ctx, target.x, target.y - target.radius, angle, crit);
}

/** A star-shaped spark at the impact plus a few flying chips, thrown away from the blow. */
export function emitHitSparks(ctx: SceneContext, x: number, y: number, angle: number, crit: boolean): void {
  ctx.particles.emit({ x, y, life: 0.12, sprite: uiSprite("hitSpark", 0), fade: false });
  ctx.particles.emit({ x, y, life: 0.12, delay: 0.06, sprite: uiSprite("hitSpark", 1) });
  const count = crit ? SPARK_COUNT * 2 : SPARK_COUNT;
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * 1.6;
    const speed = 50 + Math.random() * 70;
    ctx.particles.emit({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0.25 + Math.random() * 0.15,
      color: crit ? "#ffb23f" : i % 2 ? "#ffffff" : "#ffe066",
      size: 2,
      drag: 6,
      shrink: true,
    });
  }
}
