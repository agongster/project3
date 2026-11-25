/**
 * The hero: walking, dashing, getting hurt, and drawing.
 *
 * Position (x, y) is the point between the hero's feet, in world pixels.
 * Collision uses a small FEET box (10×6 px) around that point, so the head
 * and body can overlap walls and trees visually, like in classic Zelda.
 *
 * Attacks live in `combat/attacks.ts` (AttackController); the player only
 * owns one and lets it slow movement while a swing is in progress.
 */
import { CHAR_H, drawSprite, flashSprite, WALK_CYCLE, type CharacterSheet, type Facing, type Sprite } from "@/game/art";
import { uiSprite } from "@/game/art/ui";
import { boxHitsSolid, moveBox, type Box } from "../engine/collision";
import { AttackController } from "../combat/attacks";
import { strike } from "../combat/strike";
import type { Hittable } from "../combat/hittable";
import type { SceneContext } from "../scenes/context";
import type { Drawable } from "../scenes/scene";
import { facingFromVector, facingVector } from "./facing";
import { Afterimages, emitDust } from "./playerFx";

// ───────────── tuning ─────────────
export const BASE_SPEED = 80; // px/s before charms
const ACCEL_SEC = 0.08; // time to reach full speed
const DECEL_SEC = 0.06; // time to stop
const FEET_W = 10;
const FEET_H = 6;
const DASH_DISTANCE = 44;
const DASH_SEC = 0.15;
const DASH_COOLDOWN_SEC = 0.7;
const HURT_INVULN_SEC = 1.0;
const HURT_KNOCKBACK_SPEED = 150; // px/s, decays quickly
const KNOCKBACK_DECAY = 10; // per second
const WALK_FRAME_SEC = 0.13;
const STEP_SFX_SEC = 0.26;
const SQUASH_SEC = 0.12;
/** Movement speed multiplier while an attack is in progress. */
const ATTACK_SLOW = 0.6;
/** Hearts healed by a heart pickup / healer pet. */
export const HEART_HEAL = 2;

export class Player {
  x = 0;
  y = 0;
  /** The hero's sprite sheet (look + hat); replaced live by `setLook`. */
  private sheet: CharacterSheet;
  facing: Facing = "down";
  /** Direction (radians) of the last aimed attack, or of the facing. */
  aim = Math.PI / 2;
  hp = 10;
  maxHp = 10;
  /** Seconds of invulnerability left (after a hit). */
  invuln = 0;
  readonly attack = new AttackController();
  readonly afterimages = new Afterimages();

  private vx = 0;
  private vy = 0;
  private knockX = 0;
  private knockY = 0;
  private dashLeft = 0;
  private dashDirX = 0;
  private dashDirY = 0;
  private dashCooldown = 0;
  private dashCooldownTotal = DASH_COOLDOWN_SEC;
  private walkClock = 0;
  private stepClock = 0;
  private squash = 0;
  private wasMoving = false;
  private regenClock = 0;
  /** True while the scene plays the faint animation (input ignored). */
  fainted = false;

  constructor(sheet: CharacterSheet) {
    this.sheet = sheet;
  }

  /** Puts the hero on a tile (feet near the bottom of the tile), standing still. */
  placeAtTile(tx: number, ty: number, facing: Facing): void {
    this.x = tx * 16 + 8;
    this.y = ty * 16 + 13;
    this.facing = facing;
    const v = facingVector(facing);
    this.aim = Math.atan2(v.y, v.x);
    this.vx = this.vy = this.knockX = this.knockY = this.dashLeft = 0;
    this.attack.cancel();
  }

  feetBox(): Box {
    return { x: this.x - FEET_W / 2, y: this.y - FEET_H, w: FEET_W, h: FEET_H };
  }

  get isDashing(): boolean {
    return this.dashLeft > 0;
  }

  /** 0 = dash just used … 1 = ready. */
  get dashReady(): number {
    return this.dashCooldown <= 0 ? 1 : 1 - this.dashCooldown / this.dashCooldownTotal;
  }

  get isMoving(): boolean {
    return Math.hypot(this.vx, this.vy) > 8;
  }

  update(dt: number, ctx: SceneContext): void {
    const stats = ctx.stats;
    this.maxHp = stats.maxHp;
    this.hp = Math.min(this.hp, this.maxHp);
    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.squash = Math.max(0, this.squash - dt / SQUASH_SEC);
    this.afterimages.update(dt);
    this.updateRegen(dt, ctx);
    if (this.fainted) return;

    const input = ctx.game.input;
    const move = input.moveVector();
    if (input.pressed("dash")) this.tryDash(ctx, move);

    // Accelerate toward the wanted velocity: snappy, but not instant.
    const speed = BASE_SPEED * stats.speedMult * (this.attack.isBusy ? ATTACK_SLOW : 1);
    const wantX = move.x * speed;
    const wantY = move.y * speed;
    const rate = (move.x || move.y ? speed / ACCEL_SEC : speed / DECEL_SEC) * dt;
    this.vx = approach(this.vx, wantX, rate);
    this.vy = approach(this.vy, wantY, rate);

    if (!this.attack.isBusy) this.facing = facingFromVector(move.x, move.y, this.facing);

    let dx = (this.vx + this.knockX) * dt;
    let dy = (this.vy + this.knockY) * dt;
    if (this.dashLeft > 0) {
      const dashSpeed = DASH_DISTANCE / DASH_SEC;
      dx = this.dashDirX * dashSpeed * dt;
      dy = this.dashDirY * dashSpeed * dt;
      this.dashLeft -= dt;
      this.afterimages.maybeCapture(this, this.currentFrame());
    }
    this.moveBy(dx, dy, ctx);
    const decay = Math.exp(-KNOCKBACK_DECAY * dt);
    this.knockX *= decay;
    this.knockY *= decay;

    this.attack.update(dt, ctx, this);
    this.updateWalkFx(dt, ctx);
  }

  /** Moves with wall sliding / corner nudging against the scene's solid tiles. */
  moveBy(dx: number, dy: number, ctx: SceneContext): void {
    const box = this.feetBox();
    // Already overlapping something solid (a chest appeared on us, a debug teleport...):
    // move freely until we are out, instead of being stuck forever.
    if (boxHitsSolid(box.x, box.y, box.w, box.h, ctx.isSolidTile)) {
      this.x += dx;
      this.y += dy;
      return;
    }
    const r = moveBox(box, dx, dy, ctx.isSolidTile);
    this.x += r.x - box.x;
    this.y += r.y - box.y;
  }

  /**
   * Takes damage from something at (fromX, fromY). Returns false when the
   * hero shrugged it off (invulnerable, dashing, fainted). `attacker` gets
   * the Cactus Buddy's thorns back.
   */
  hurt(damage: number, fromX: number, fromY: number, ctx: SceneContext, attacker?: Hittable): boolean {
    if (this.invuln > 0 || this.isDashing || this.fainted || damage <= 0) return false;
    this.hp = Math.max(0, this.hp - damage);
    this.invuln = HURT_INVULN_SEC;
    const away = Math.atan2(this.y - fromY, this.x - fromX);
    this.knockX = Math.cos(away) * HURT_KNOCKBACK_SPEED;
    this.knockY = Math.sin(away) * HURT_KNOCKBACK_SPEED;
    ctx.audio.sfx("hurt");
    ctx.juice.flash("#ff2a4a", 0.55, 0.45, "vignette");
    ctx.shake(0.35);
    ctx.hitStop(40);
    const thorns = ctx.stats.thorns;
    if (thorns > 0 && attacker?.alive) strike(ctx, attacker, { damage: thorns, fromX: this.x, fromY: this.y, knockback: 8, source: "thorns" });
    return true;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** Back to full health (overworld return, respawn after fainting). `maxHp` comes from the current stats. */
  restore(maxHp: number): void {
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.invuln = 0;
    this.fainted = false;
  }

  drawable(ctx: SceneContext): Drawable {
    return {
      y: this.y,
      shadow: (g) => drawSprite(g, uiSprite("shadowSmall"), this.x, this.y),
      draw: (g) => this.draw(g, ctx),
    };
  }

  private draw(g: CanvasRenderingContext2D, ctx: SceneContext): void {
    this.afterimages.draw(g);
    // Blink while invulnerable (visible 2 frames out of 3 is gentler than 50%).
    const hidden = this.invuln > 0 && !this.isDashing && Math.floor(this.invuln * 18) % 3 === 0;
    const weaponBehind = this.facing === "up";
    if (weaponBehind) this.attack.drawWeapon(g, this, ctx);
    if (!hidden) {
      const sprite = this.currentFrame();
      const flash = this.invuln > HURT_INVULN_SEC - 0.08 ? flashSprite(sprite, "#ffffff") : sprite;
      if (this.squash > 0) {
        // Landing squash: a touch wider and shorter for a moment.
        const s = this.squash * 0.12;
        g.save();
        g.translate(Math.round(this.x), Math.round(this.y));
        g.scale(1 + s, 1 - s);
        g.drawImage(flash.canvas, -flash.ax, -flash.ay);
        g.restore();
      } else {
        drawSprite(g, flash, this.x, this.y);
      }
    }
    if (!weaponBehind) this.attack.drawWeapon(g, this, ctx);
  }

  /** The character sheet frame for the current pose. */
  currentFrame(): Sprite {
    const moving = this.isMoving || this.isDashing;
    const step = moving ? WALK_CYCLE[Math.floor(this.walkClock / WALK_FRAME_SEC) % WALK_CYCLE.length] : 0;
    return this.sheet.frame(this.facing, step);
  }

  /** Height of the drawn figure above the feet (for labels, hit sparks...). */
  get height(): number {
    return CHAR_H - 12;
  }

  /** Called by the game whenever the look or hat changes in the save. */
  setLook(sheet: CharacterSheet): void {
    this.sheet = sheet;
  }

  private tryDash(ctx: SceneContext, move: { x: number; y: number }): void {
    if (this.dashCooldown > 0 || this.dashLeft > 0) return;
    const dir = move.x || move.y ? move : facingVector(this.facing);
    this.dashDirX = dir.x;
    this.dashDirY = dir.y;
    this.dashLeft = DASH_SEC;
    this.dashCooldownTotal = DASH_COOLDOWN_SEC * ctx.stats.dashCooldownMult;
    this.dashCooldown = this.dashCooldownTotal;
    this.afterimages.start();
    ctx.audio.sfx("dash");
    emitDust(ctx, this.x, this.y, 5);
  }

  private updateWalkFx(dt: number, ctx: SceneContext): void {
    const moving = this.isMoving;
    if (moving) {
      this.walkClock += dt;
      this.stepClock += dt;
      if (!this.wasMoving) emitDust(ctx, this.x - this.vx * 0.04, this.y, 2);
      if (this.stepClock >= STEP_SFX_SEC) {
        this.stepClock = 0;
        ctx.audio.sfx("step", { volume: 0.5, pitch: 0.9 + Math.random() * 0.2 });
      }
    } else {
      if (this.wasMoving) this.squash = 1;
      this.walkClock = 0;
      this.stepClock = STEP_SFX_SEC * 0.6;
    }
    this.wasMoving = moving;
  }

  private updateRegen(dt: number, ctx: SceneContext): void {
    const every = ctx.stats.regenEverySec;
    if (every === null || this.hp >= this.maxHp || this.fainted) {
      this.regenClock = 0;
      return;
    }
    this.regenClock += dt;
    if (this.regenClock >= every) {
      this.regenClock = 0;
      this.heal(1);
      ctx.floatText(this.x, this.y - this.height, "+♥", "heal");
    }
  }
}

/** Moves `value` toward `target` by at most `step`. */
function approach(value: number, target: number, step: number): number {
  if (value < target) return Math.min(target, value + step);
  return Math.max(target, value - step);
}
