/**
 * Coins and hearts lying on the ground.
 *
 * Life of a coin:
 *   1. POP – it jumps out of whatever dropped it in a little arc and bounces
 *      twice (z = height above the ground, with gravity).
 *   2. REST – after a short moment it can be collected. Inside the hero's
 *      magnet radius it accelerates toward them (the Coin Magnet charm makes
 *      the radius bigger; a collector pet pulls coins near itself too).
 *   3. COLLECT – coin sound whose pitch climbs with rapid pickups, "+N"
 *      text, and the save gets the coins (× the coin multiplier; fractions
 *      are carried over to the next coin so nothing is lost to rounding).
 */
import { drawSprite } from "@/game/art";
import { uiSprite } from "@/game/art/ui";
import { addCoins } from "@/lib/game";
import type { SceneContext } from "../scenes/context";
import type { Drawable } from "../scenes/scene";
import { HEART_HEAL } from "./player";

const GRAVITY = 420;
const BOUNCE_KEEP = 0.45;
const POP_SPEED_XY = 38;
const POP_SPEED_Z = 95;
/** Seconds before a fresh drop can be collected (so you see it pop). */
const SETTLE_SEC = 0.35;
const COLLECT_RADIUS_PX = 9;
/** Acceleration toward the hero once inside the magnet radius (px/s²). */
const MAGNET_ACCEL = 900;
const MAGNET_MAX_SPEED = 240;
/** A collector pet pulls coins that are this close to it. */
const PET_PULL_RADIUS_PX = 40;
/** Drops of this many coins or more use some big coins worth BIG_COIN_VALUE. */
const BIG_COIN_THRESHOLD = 10;
const BIG_COIN_VALUE = 5;
/** Pickups within this many seconds of each other raise the coin sound's pitch. */
const STREAK_WINDOW_SEC = 0.7;
const STREAK_PITCH_STEP = 0.06;
const STREAK_PITCH_MAX = 1.7;
/** "+N" texts are merged over this long so a coin shower shows one number. */
const TEXT_MERGE_SEC = 0.15;
/** Hearts nobody needs fade away after this long. */
const HEART_LIFETIME_SEC = 14;
const COIN_SPIN_FPS = 10;
/** On average, a resting coin twinkles once every this many seconds. */
const TWINKLE_EVERY_SEC = 1.4;

type PickupKind = "coin" | "bigCoin" | "heart";

interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  alive: boolean;
}

export class Pickups {
  private items: Pickup[] = [];
  /** Fraction of a coin left over from drops (e.g. 2.4 coins → 2 now, 0.4 kept). */
  private dropCarry = 0;
  /** Fraction of a coin left over from the coin multiplier. */
  private valueCarry = 0;
  private streak = 0;
  private sinceLastCoin = Infinity;
  private pendingText = 0;
  private pendingTextTimer = 0;

  constructor(private readonly ctx: SceneContext) {}

  /** Pops coins out of (x, y). `amount` may be fractional (combo bonus); the remainder is carried. */
  spawnCoins(x: number, y: number, amount: number): void {
    this.dropCarry += amount;
    let count = Math.floor(this.dropCarry);
    this.dropCarry -= count;
    while (count >= BIG_COIN_THRESHOLD) {
      this.pop("bigCoin", x, y);
      count -= BIG_COIN_VALUE;
    }
    for (let i = 0; i < count; i++) this.pop("coin", x, y);
  }

  spawnHeart(x: number, y: number): void {
    this.pop("heart", x, y);
  }

  update(dt: number): void {
    this.sinceLastCoin += dt;
    if (this.sinceLastCoin > STREAK_WINDOW_SEC) this.streak = 0;
    this.flushText(dt);
    for (const p of this.items) this.updateOne(p, dt);
    this.items = this.items.filter((p) => p.alive);
  }

  drawables(out: Drawable[]): void {
    for (const p of this.items) {
      const sprite = this.spriteFor(p);
      // hearts about to vanish blink
      const blinking = p.kind === "heart" && p.age > HEART_LIFETIME_SEC - 2 && Math.floor(p.age * 8) % 2 === 0;
      out.push({
        y: p.y,
        shadow: (g) => drawSprite(g, uiSprite("shadowSmall"), p.x, p.y),
        draw: (g) => {
          if (!blinking) drawSprite(g, sprite, p.x, p.y - p.z);
        },
      });
    }
  }

  private pop(kind: PickupKind, x: number, y: number): void {
    const angle = Math.random() * Math.PI * 2;
    const speed = POP_SPEED_XY * (0.4 + Math.random() * 0.6);
    this.items.push({ kind, x, y, z: 4, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * 0.7, vz: POP_SPEED_Z * (0.8 + Math.random() * 0.4), age: 0, alive: true });
  }

  private spriteFor(p: Pickup) {
    if (p.kind === "heart") return uiSprite("heartPickup", Math.floor(p.age * 4));
    const frame = Math.floor(p.age * COIN_SPIN_FPS + p.x);
    return uiSprite(p.kind === "bigCoin" ? "coinBig" : "coin", frame);
  }

  private updateOne(p: Pickup, dt: number): void {
    const ctx = this.ctx;
    const player = ctx.game.player;
    p.age += dt;
    if (p.kind === "heart" && p.age > HEART_LIFETIME_SEC) {
      p.alive = false;
      return;
    }

    // Bouncing pop-out arc.
    if (p.z > 0 || p.vz > 0) {
      p.vz -= GRAVITY * dt;
      p.z += p.vz * dt;
      if (p.z <= 0) {
        p.z = 0;
        p.vz = Math.abs(p.vz) > 30 ? -p.vz * BOUNCE_KEEP : 0;
        p.vx *= 0.6;
        p.vy *= 0.6;
      }
    } else {
      p.vx *= Math.max(0, 1 - 6 * dt);
      p.vy *= Math.max(0, 1 - 6 * dt);
    }

    // Resting coins twinkle now and then so they catch the eye.
    if (p.kind !== "heart" && p.z === 0 && Math.random() < dt / TWINKLE_EVERY_SEC) {
      ctx.particles.emit({ x: p.x + (Math.random() - 0.5) * 6, y: p.y - 3 - Math.random() * 4, life: 0.35, sprite: uiSprite("sparkle", 2) });
    }

    const wanted = p.kind !== "heart" || player.hp < player.maxHp;
    if (p.age > SETTLE_SEC && wanted && !player.fainted) this.attract(p, dt);

    // Don't let a pickup fly into a wall while popping or being pulled.
    const nx = p.x + p.vx * dt;
    const ny = p.y + p.vy * dt;
    if (!ctx.isSolid(nx, p.y)) p.x = nx;
    else p.vx = 0;
    if (!ctx.isSolid(p.x, ny)) p.y = ny;
    else p.vy = 0;

    if (p.age > SETTLE_SEC && wanted && Math.hypot(player.x - p.x, player.y - 4 - p.y) < COLLECT_RADIUS_PX) this.collect(p);
  }

  /** Magnet toward the hero (and toward the hero from near a collector pet). */
  private attract(p: Pickup, dt: number): void {
    const ctx = this.ctx;
    const player = ctx.game.player;
    const pet = ctx.game.pet;
    const dx = player.x - p.x;
    const dy = player.y - 4 - p.y;
    const dist = Math.hypot(dx, dy);
    const inMagnet = dist < ctx.stats.magnetRadius;
    const nearCollector = p.kind !== "heart" && ctx.petPerk === "collector" && pet.active && Math.hypot(pet.x - p.x, pet.y - p.y) < PET_PULL_RADIUS_PX;
    if (!inMagnet && !nearCollector) return;
    p.vx += (dx / dist) * MAGNET_ACCEL * dt;
    p.vy += (dy / dist) * MAGNET_ACCEL * dt;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > MAGNET_MAX_SPEED) {
      p.vx = (p.vx / speed) * MAGNET_MAX_SPEED;
      p.vy = (p.vy / speed) * MAGNET_MAX_SPEED;
    }
  }

  private collect(p: Pickup): void {
    const ctx = this.ctx;
    p.alive = false;
    if (p.kind === "heart") {
      ctx.game.player.heal(HEART_HEAL);
      ctx.audio.sfx("heart");
      ctx.floatText(p.x, p.y - 14, "+1 heart", "heal");
      return;
    }
    const value = (p.kind === "bigCoin" ? BIG_COIN_VALUE : 1) * ctx.stats.coinMult + this.valueCarry;
    const whole = Math.floor(value);
    this.valueCarry = value - whole;
    if (whole > 0) ctx.save.set((save) => addCoins(save, whole));
    this.pendingText += whole;
    this.pendingTextTimer = TEXT_MERGE_SEC;
    this.streak = this.sinceLastCoin < STREAK_WINDOW_SEC ? this.streak + 1 : 0;
    this.sinceLastCoin = 0;
    ctx.audio.sfx("coin", { pitch: Math.min(STREAK_PITCH_MAX, 1 + this.streak * STREAK_PITCH_STEP) });
    ctx.particles.emit({ x: p.x, y: p.y - 6, life: 0.3, sprite: uiSprite("sparkle", 0) });
  }

  private flushText(dt: number): void {
    if (this.pendingText <= 0) return;
    this.pendingTextTimer -= dt;
    if (this.pendingTextTimer > 0) return;
    const player = this.ctx.game.player;
    this.ctx.floatText(player.x, player.y - player.height - 4, `+${this.pendingText}`, "coin");
    this.pendingText = 0;
  }
}
