/**
 * Cosmetic trails: while the hero walks, the equipped trail leaves little
 * particles behind in its colours and shape (sparkles, petals, hearts,
 * tumbling 0/1 bits, music notes).
 */
import { uiSprite, type UiSpriteName } from "@/game/art/ui";
import { getItem, type TrailDef } from "@/lib/game/catalog";
import type { SceneContext } from "../scenes/context";

/** Seconds between two trail particles while moving. */
const EMIT_EVERY_SEC = 0.07;

/** Which UI sprite each trail shape uses (bits alternate between 0 and 1). */
const SHAPE_SPRITES: Record<TrailDef["shape"], UiSpriteName[]> = {
  sparkle: ["sparkle"],
  petal: ["petal"],
  heart: ["heartTiny"],
  bit: ["bit0", "bit1"],
  note: ["note"],
};

export class Trail {
  private def: TrailDef | null = null;
  private clock = 0;
  private count = 0;

  setTrail(id: string | null): void {
    const item = id ? getItem(id) : undefined;
    this.def = item?.slot === "trail" ? item : null;
  }

  update(dt: number, ctx: SceneContext): void {
    const player = ctx.game.player;
    if (!this.def || !(player.isMoving || player.isDashing)) return;
    this.clock += dt;
    if (this.clock < EMIT_EVERY_SEC) return;
    this.clock = 0;
    this.count++;
    const def = this.def;
    const x = player.x + (Math.random() - 0.5) * 8;
    const y = player.y - 1 - Math.random() * 3;
    // Alternate a shaped sprite with a tiny square in one of the trail's colours.
    if (this.count % 2 === 0) {
      const names = SHAPE_SPRITES[def.shape];
      ctx.particles.emit({ x, y, z: 2, vz: 10, gravity: 4, life: 0.7, sprite: uiSprite(names[this.count % names.length], this.count), wobble: def.shape === "petal" ? 3 : 0 });
    } else {
      ctx.particles.emit({ x, y, z: 1, vz: 14, life: 0.6, color: def.colors[this.count % def.colors.length], size: 2, shrink: true });
    }
  }
}
