/**
 * The hero's attacks: turns "attack pressed" into one of the six attack
 * styles from catalog.ts (swing, thrust, projectile, boomerang, slam, nova).
 *
 * Life of an attack:
 *   1. START  – pick a target with auto-aim, face it, lunge 2 px, play the
 *               sound, launch projectiles (projectile / boomerang / wave).
 *   2. ACTIVE – each step, test the style's hit shape (geometry.ts) against
 *               every Hittable; each target can be hit once per attack.
 *   3. DONE   – after the style's duration; the next attack may start when
 *               the weapon's cooldown has passed. Holding the button keeps
 *               attacking, so the game never asks for button mashing.
 *
 * Drawing the weapon and the slash / ring effects lives in weaponFx.ts.
 */
import type { WeaponDef } from "@/lib/game/catalog";
import { uiSprite } from "@/game/art/ui";
import type { ProjectileName } from "@/game/art/weapons";
import type { SceneContext } from "../scenes/context";
import type { Player } from "../entities/player";
import { facingAngle, facingFromVector } from "../entities/facing";
import { STYLE_TIMING, type ActiveAttack } from "./attackState";
import { chooseAimTarget, meleeShape, shapeHits, type HitShape } from "./geometry";
import { strike } from "./strike";
import { drawAttackFx, drawHeldWeapon } from "./weaponFx";

/** Pixels the hero steps into each attack. */
const LUNGE_PX = 2;

/** Projectile looks and speeds per weapon (sprite names from art/weapons.ts). */
const PROJECTILES: Record<string, { sprite: ProjectileName; speed: number }> = {
  rubberDuck: { sprite: "duck", speed: 190 },
  typeBow: { sprite: "arrow", speed: 260 },
  debugWand: { sprite: "spark", speed: 170 },
  gitBoomerang: { sprite: "boomerang", speed: 200 },
  goldenDuck: { sprite: "goldenDuck", speed: 200 },
};
const DEFAULT_PROJECTILE: { sprite: ProjectileName; speed: number } = { sprite: "spark", speed: 200 };
/** The Merge Saber's crescent wave. */
const WAVE_RANGE_PX = 72;
const WAVE_SPEED = 190;
const QUACK_WEAPONS = new Set(["rubberDuck", "goldenDuck"]);

export class AttackController {
  active: ActiveAttack | null = null;
  private cooldown = 0;
  private sweep = 1;

  /** True while an attack animation is playing (movement is slowed). */
  get isBusy(): boolean {
    return this.active !== null;
  }

  cancel(): void {
    this.active = null;
  }

  update(dt: number, ctx: SceneContext, player: Player): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.active) this.advance(dt, ctx, player);

    const input = ctx.game.input;
    const wants = input.pressed("attack") || input.held("attack");
    if (wants && !this.active && this.cooldown <= 0 && !player.isDashing && !player.fainted) {
      const weapon = ctx.stats.weapon;
      // A boomerang must come home before it can be thrown again.
      if (weapon.style === "boomerang" && ctx.projectiles.boomerangOut()) return;
      this.start(ctx, player, weapon);
    }
  }

  drawWeapon(g: CanvasRenderingContext2D, player: Player, ctx: SceneContext): void {
    const weapon = ctx.stats.weapon;
    const inFlight = weapon.style === "boomerang" && ctx.projectiles.boomerangOut();
    if (!inFlight) drawHeldWeapon(g, player, weapon, this.active);
  }

  /** Slash arcs, slam rings and nova rings (drawn above the world). */
  drawFx(g: CanvasRenderingContext2D, player: Player): void {
    if (this.active) drawAttackFx(g, player, this.active);
  }

  private start(ctx: SceneContext, player: Player, weapon: WeaponDef): void {
    const facing = facingAngle(player.facing);
    const target = chooseAimTarget(player.x, player.y - 4, facing, ctx.hittables, weapon.range);
    const aim = target ? Math.atan2(target.y - (player.y - 4), target.x - player.x) : facing;
    player.aim = aim;
    player.facing = facingFromVector(Math.cos(aim), Math.sin(aim), player.facing);
    player.moveBy(Math.cos(aim) * LUNGE_PX, Math.sin(aim) * LUNGE_PX, ctx);

    this.sweep = -this.sweep;
    const timing = STYLE_TIMING[weapon.style];
    this.cooldown = weapon.cooldownMs / 1000;
    this.active = {
      weapon,
      aim,
      age: 0,
      duration: Math.min(timing.duration, this.cooldown * 0.95),
      sweep: this.sweep,
      hit: new Set(),
      impactDone: false,
    };
    this.launch(ctx, player, weapon, aim);
  }

  /** Sounds and projectiles that happen the moment an attack starts. */
  private launch(ctx: SceneContext, player: Player, weapon: WeaponDef, aim: number): void {
    const quack = QUACK_WEAPONS.has(weapon.id);
    const sx = player.x + Math.cos(aim) * 6;
    const sy = player.y - 4 + Math.sin(aim) * 6;
    switch (weapon.style) {
      case "swing":
      case "thrust":
        ctx.audio.sfx("swing", { pitch: weapon.style === "thrust" ? 1.2 : 0.9 + Math.random() * 0.2 });
        if (weapon.wave) {
          ctx.projectiles.firePlayer({ x: sx, y: sy, angle: aim, speed: WAVE_SPEED, maxDist: WAVE_RANGE_PX, damage: weapon.damage, knockback: weapon.knockback, pierce: true, sprite: "wave" });
        }
        break;
      case "projectile":
      case "boomerang": {
        const look = PROJECTILES[weapon.id] ?? DEFAULT_PROJECTILE;
        ctx.audio.sfx(quack ? "quack" : "shoot", { pitch: 0.95 + Math.random() * 0.1 });
        ctx.projectiles.firePlayer({
          x: sx,
          y: sy,
          angle: aim,
          speed: look.speed,
          maxDist: weapon.range,
          damage: weapon.damage,
          knockback: weapon.knockback,
          pierce: weapon.pierce ?? false,
          homing: weapon.homing ?? false,
          boomerang: weapon.style === "boomerang",
          sprite: look.sprite,
          quack,
        });
        break;
      }
      case "slam":
        ctx.audio.sfx("swing", { pitch: 0.7 });
        break;
      case "nova":
        ctx.audio.sfx("swing", { pitch: 0.6 });
        ctx.particles.emit({ x: player.x, y: player.y - 4, life: 0.3, sprite: uiSprite("ring", 0) });
        break;
    }
  }

  private advance(dt: number, ctx: SceneContext, player: Player): void {
    const a = this.active!;
    a.age += dt;
    const t = a.age / a.duration;
    const timing = STYLE_TIMING[a.weapon.style];
    const style = a.weapon.style;

    if (style === "slam") {
      if (!a.impactDone && t >= timing.hitFrom) {
        a.impactDone = true;
        this.slamImpact(ctx, player, a);
      }
    } else if (style === "nova") {
      const radius = a.weapon.range * Math.min(1, t);
      this.hitShape(ctx, player, a, { type: "ring", cx: player.x, cy: player.y - 4, inner: Math.max(0, radius - 12), outer: radius });
    } else if (t >= timing.hitFrom && t <= timing.hitTo) {
      const shape = meleeShape(style, player.x, player.y - 4, a.aim, a.weapon.range);
      if (shape) this.hitShape(ctx, player, a, shape);
    }
    if (a.age >= a.duration) this.active = null;
  }

  private hitShape(ctx: SceneContext, player: Player, a: ActiveAttack, shape: HitShape): void {
    for (const target of ctx.hittables) {
      if (!target.alive || a.hit.has(target) || !shapeHits(shape, target)) continue;
      a.hit.add(target);
      strike(ctx, target, {
        damage: a.weapon.damage,
        fromX: player.x,
        fromY: player.y - 4,
        knockback: a.weapon.knockback,
        source: "weapon",
        quack: QUACK_WEAPONS.has(a.weapon.id),
      });
    }
  }

  private slamImpact(ctx: SceneContext, player: Player, a: ActiveAttack): void {
    const shape = meleeShape("slam", player.x, player.y - 4, a.aim, a.weapon.range);
    if (shape?.type !== "circle") return;
    ctx.audio.sfx("slam");
    ctx.shake(0.3);
    ctx.particles.emit({ x: shape.cx, y: shape.cy, life: 0.3, sprite: uiSprite("ring", 1) });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      ctx.particles.emit({
        x: shape.cx + Math.cos(angle) * 4,
        y: shape.cy + Math.sin(angle) * 3,
        vx: Math.cos(angle) * 60,
        vy: Math.sin(angle) * 40,
        life: 0.35,
        sprite: uiSprite("dust", i % 3),
        drag: 5,
      });
    }
    this.hitShape(ctx, player, a, shape);
  }
}
