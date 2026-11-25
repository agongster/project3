/**
 * The hero's pet: follows a little behind with a springy delay, hops along
 * (or floats, if it flies), and does its perk:
 *
 *   collector – pulls coins near itself to the hero (handled in pickups.ts)
 *   fighter   – every FIGHT_EVERY_SEC lunges at a monster within reach for 1 damage
 *   healer    – every HEAL_EVERY_SEC drops a heart while the hero is hurt
 *   lucky     – monsters drop extra coins (read through ctx.petPerk)
 *
 * The pet passes over walls: it is a cosmetic companion, so getting stuck
 * behind a fence would only be annoying.
 */
import { drawSprite } from "@/game/art";
import { petSprite } from "@/game/art/pets";
import { uiSprite } from "@/game/art/ui";
import { getItem, type PetDef } from "@/lib/game/catalog";
import { strike } from "../combat/strike";
import type { Hittable } from "../combat/hittable";
import type { SceneContext } from "../scenes/context";
import type { Drawable } from "../scenes/scene";
import { facingVector } from "./facing";

/** How far behind the hero the pet likes to be. */
const FOLLOW_GAP_PX = 14;
/** Spring stiffness and damping of the follow motion. */
const SPRING = 28;
const DAMPING = 7;
/** Further than this from the hero and the pet pops back next to them. */
const TELEPORT_DIST_PX = 110;
const HOP_HEIGHT_PX = 3;
const HOP_RATE = 9;
const FLY_HEIGHT_PX = 9;
const FRAME_SEC = 0.16;
const FIGHT_EVERY_SEC = 2.2;
const FIGHT_RANGE_PX = 56;
const FIGHT_DAMAGE = 1;
const LUNGE_SEC = 0.22;
const HEAL_EVERY_SEC = 45;

export class Pet {
  x = 0;
  y = 0;
  private vx = 0;
  private vy = 0;
  private faceLeft = false;
  private clock = 0;
  private fightClock = 0;
  private healClock = 0;
  private lunge: { target: Hittable; age: number; fromX: number; fromY: number; struck: boolean } | null = null;
  private def: PetDef | null = null;

  /** True when a pet is equipped. */
  get active(): boolean {
    return this.def !== null;
  }

  /** Follows the save: called by the game whenever the equipped pet changes. */
  setPet(id: string | null): void {
    const item = id ? getItem(id) : undefined;
    this.def = item?.slot === "pet" ? item : null;
  }

  /** Drops the pet right next to the hero (scene start, teleports). */
  placeNear(x: number, y: number): void {
    this.x = x - FOLLOW_GAP_PX;
    this.y = y;
    this.vx = this.vy = 0;
    this.lunge = null;
  }

  update(dt: number, ctx: SceneContext): void {
    if (!this.def) return;
    this.clock += dt;
    const player = ctx.game.player;
    if (this.lunge) this.updateLunge(dt, ctx);
    else this.follow(dt, player.x, player.y, facingVector(player.facing));
    if (Math.abs(this.vx) > 4) this.faceLeft = this.vx < 0;
    this.usePerk(dt, ctx);
  }

  drawable(): Drawable | null {
    const def = this.def;
    if (!def) return null;
    const moving = Math.hypot(this.vx, this.vy) > 10;
    const z = def.flies ? FLY_HEIGHT_PX + Math.sin(this.clock * 3) * 2 : moving ? Math.abs(Math.sin(this.clock * HOP_RATE)) * HOP_HEIGHT_PX : 0;
    const sprite = petSprite(def.id, Math.floor(this.clock / FRAME_SEC));
    return {
      y: this.y,
      shadow: (g) => drawSprite(g, uiSprite("shadowSmall"), this.x, this.y),
      draw: (g) => drawSprite(g, sprite, this.x, this.y - z, { flipX: this.faceLeft }),
    };
  }

  /** Damped spring toward a spot just behind the hero. */
  private follow(dt: number, px: number, py: number, facing: { x: number; y: number }): void {
    const tx = px - facing.x * FOLLOW_GAP_PX;
    const ty = py - facing.y * FOLLOW_GAP_PX * 0.6 + 1;
    if (Math.hypot(tx - this.x, ty - this.y) > TELEPORT_DIST_PX) {
      this.placeNear(px, py);
      return;
    }
    this.vx += ((tx - this.x) * SPRING - this.vx * DAMPING) * dt;
    this.vy += ((ty - this.y) * SPRING - this.vy * DAMPING) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  private usePerk(dt: number, ctx: SceneContext): void {
    const perk = this.def?.perk;
    const player = ctx.game.player;
    if (perk === "fighter" && !this.lunge) {
      this.fightClock += dt;
      if (this.fightClock >= FIGHT_EVERY_SEC) {
        const target = this.nearestMonster(ctx);
        if (target) {
          this.fightClock = 0;
          this.lunge = { target, age: 0, fromX: this.x, fromY: this.y, struck: false };
        }
      }
    }
    if (perk === "healer") {
      this.healClock = player.hp < player.maxHp ? this.healClock + dt : 0;
      if (this.healClock >= HEAL_EVERY_SEC) {
        this.healClock = 0;
        ctx.spawnHeart(this.x, this.y);
        ctx.particles.burst(6, this.x, this.y - 8, 30, { life: 0.5, sprite: uiSprite("sparkle", 0), drag: 3 });
      }
    }
  }

  private nearestMonster(ctx: SceneContext): Hittable | null {
    let best: Hittable | null = null;
    let bestDist = FIGHT_RANGE_PX;
    for (const t of ctx.hittables) {
      if (!t.alive || t.kind !== "monster") continue;
      const d = Math.hypot(t.x - this.x, t.y - this.y);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }

  /** Dash out to the target, peck at the halfway point, hop back. */
  private updateLunge(dt: number, ctx: SceneContext): void {
    const l = this.lunge!;
    l.age += dt;
    const k = Math.min(1, l.age / LUNGE_SEC);
    const out = k < 0.5 ? k * 2 : (1 - k) * 2; // 0 → 1 → 0
    const prevX = this.x;
    this.x = l.fromX + (l.target.x - l.fromX) * out * 0.85;
    this.y = l.fromY + (l.target.y - l.fromY) * out * 0.85;
    this.vx = (this.x - prevX) / dt;
    if (!l.struck && k >= 0.5) {
      l.struck = true;
      if (l.target.alive) strike(ctx, l.target, { damage: FIGHT_DAMAGE, fromX: l.fromX, fromY: l.fromY, knockback: 4, source: "pet", canCrit: false });
    }
    if (k >= 1) this.lunge = null;
  }
}
