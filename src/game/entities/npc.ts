/**
 * Villagers: they idle, wander within one tile of their home spot, turn to
 * look at the hero when they come close, and talk when the hero presses E.
 *
 * Villagers don't block a tile; instead the hero is gently pushed out of
 * their circle (`pushOut`). That way a villager can wander without leaving
 * invisible walls behind.
 */
import { drawSprite, randomLook, renderCharacter, WALK_CYCLE, type CharacterSheet, type Facing } from "@/game/art";
import { uiSprite } from "@/game/art/ui";
import type { NpcSpawn } from "@/lib/types";
import { moveBox } from "../engine/collision";
import type { SceneContext } from "../scenes/context";
import type { Drawable } from "../scenes/scene";
import { facingFromVector } from "./facing";

const WALK_SPEED = 18;
/** Villagers wander at most this far from home (one tile). */
const WANDER_RADIUS_PX = 16;
const IDLE_MIN_SEC = 1.5;
const IDLE_MAX_SEC = 4.5;
/** When the hero is this close, villagers stop and look at them. */
const NOTICE_DIST_PX = 36;
/** Body radius used to push the hero out. */
const BODY_RADIUS_PX = 7;
const WALK_FRAME_SEC = 0.15;

export class Villager {
  x: number;
  y: number;
  facing: Facing = "down";
  private readonly homeX: number;
  private readonly homeY: number;
  private readonly sheet: CharacterSheet;
  private target: { x: number; y: number } | null = null;
  private idle = Math.random() * IDLE_MAX_SEC;
  private walkClock = 0;

  constructor(readonly spawn: NpcSpawn) {
    this.homeX = this.x = spawn.x * 16 + 8;
    this.homeY = this.y = spawn.y * 16 + 13;
    this.sheet = renderCharacter(randomLook(spawn.lookSeed), null);
  }

  update(dt: number, ctx: SceneContext): void {
    const player = ctx.game.player;
    const toPlayer = Math.hypot(player.x - this.x, player.y - this.y);
    if (toPlayer < NOTICE_DIST_PX) {
      this.target = null;
      this.faceToward(player.x, player.y);
      return;
    }
    if (this.target) this.walk(dt, ctx);
    else {
      this.idle -= dt;
      if (this.idle <= 0) this.pickTarget(ctx);
    }
  }

  /** Turns to look at a point (used when the hero starts talking). */
  faceToward(x: number, y: number): void {
    this.facing = facingFromVector(x - this.x, (y - this.y) * 1.2, this.facing);
  }

  /** Keeps the hero's feet outside the villager's body. */
  pushOut(ctx: SceneContext): void {
    const player = ctx.game.player;
    const dx = player.x - this.x;
    const dy = (player.y - this.y) * 1.5; // flatter ellipse: bodies are wider than deep
    const dist = Math.hypot(dx, dy);
    const minDist = BODY_RADIUS_PX + 4;
    if (dist >= minDist || dist === 0) return;
    const push = minDist - dist;
    player.moveBy((dx / dist) * push, (dy / dist) * push * 0.66, ctx);
  }

  drawable(): Drawable {
    const moving = this.target !== null;
    const step = moving ? WALK_CYCLE[Math.floor(this.walkClock / WALK_FRAME_SEC) % WALK_CYCLE.length] : 0;
    const sprite = this.sheet.frame(this.facing, step);
    return {
      y: this.y,
      shadow: (g) => drawSprite(g, uiSprite("shadowSmall"), this.x, this.y),
      draw: (g) => drawSprite(g, sprite, this.x, this.y),
    };
  }

  private pickTarget(ctx: SceneContext): void {
    this.idle = IDLE_MIN_SEC + Math.random() * (IDLE_MAX_SEC - IDLE_MIN_SEC);
    const tx = this.homeX + Math.round((Math.random() * 2 - 1) * WANDER_RADIUS_PX);
    const ty = this.homeY + Math.round((Math.random() * 2 - 1) * WANDER_RADIUS_PX * 0.5);
    if (!ctx.isSolid(tx, ty) && !ctx.isSolid(tx, ty - 4)) this.target = { x: tx, y: ty };
  }

  private walk(dt: number, ctx: SceneContext): void {
    const t = this.target!;
    const dx = t.x - this.x;
    const dy = t.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) {
      this.target = null;
      this.facing = "down";
      return;
    }
    const step = Math.min(dist, WALK_SPEED * dt);
    const box = { x: this.x - 4, y: this.y - 4, w: 8, h: 4 };
    const moved = moveBox(box, (dx / dist) * step, (dy / dist) * step, ctx.isSolidTile, 0);
    if (moved.blockedX && moved.blockedY) this.target = null;
    this.x += moved.x - box.x;
    this.y += moved.y - box.y;
    this.facing = facingFromVector(dx, dy, this.facing);
    this.walkClock += dt;
  }
}
