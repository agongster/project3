/**
 * The PURIFY moment. When the dungeon's code has no bug left (fixed or
 * sealed in the Workshop), a wave of sparkles sweeps out from the hero
 * across the whole map. Whatever the wave
 * has passed is cleansed:
 *   - torch light turns from cursed purple to warm gold,
 *   - the room gets a little brighter,
 * and the dungeon scene switches the drifting dust to sparkles.
 *
 * A dungeon that was already purified when the hero walked in starts fully
 * purified. (A dungeon that is only quiet, its monsters subdued, keeps its
 * cursed light: its bugs are still in the code.)
 */
import { mix } from "@/game/art/color";
import { uiSprite } from "@/game/art/ui";
import type { TileMap } from "@/lib/types";
import { TILE_PX } from "../engine/collision";
import type { SceneContext } from "./context";

/** Wave speed (px/s). */
const WAVE_SPEED = 150;
/** Sparkles thrown up along the wave front each step. */
const SPARKLES_PER_STEP = 5;
const SPARKLE_LIFE_SEC = 0.8;
const CURSED_TORCH = "#a27bff";
const WARM_TORCH = "#ffb04a";
/** Torch colours change in this many steps (each colour is a cached glow sprite, so keep it small). */
const COLOR_STEPS = 4;
/** A torch warms up over this much of the wave's width (px). */
const BLEND_PX = 24;
const CURSED_DARKNESS = 0.5;
const PURIFIED_DARKNESS = 0.36;

export class Cleanse {
  private originX = 0;
  private originY = 0;
  /** Radius of the wave; -1 before it starts, Infinity when the dungeon was purified before. */
  private radius: number;
  private maxRadius = 0;

  constructor(
    private readonly map: TileMap,
    alreadyPurified: boolean,
  ) {
    this.radius = alreadyPurified ? Infinity : -1;
  }

  /** Sends the wave out from (x, y). */
  start(x: number, y: number): void {
    this.originX = x;
    this.originY = y;
    this.radius = 0;
    const w = this.map.width * TILE_PX;
    const h = this.map.height * TILE_PX;
    this.maxRadius = Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));
  }

  update(ctx: SceneContext, dt: number): void {
    if (this.radius < 0 || this.radius >= this.maxRadius) return;
    this.radius += WAVE_SPEED * dt;
    for (let i = 0; i < SPARKLES_PER_STEP; i++) {
      const a = Math.random() * Math.PI * 2;
      const x = this.originX + Math.cos(a) * this.radius;
      const y = this.originY + Math.sin(a) * this.radius;
      if (!this.isFloor(x, y) || !ctx.camera.sees(x, y, 1, 1, TILE_PX)) continue;
      ctx.particles.emit({ x, y, z: 2, vz: 14, life: SPARKLE_LIFE_SEC, sprite: uiSprite("sparkle", i), drag: 1 });
    }
  }

  /** 0 (cursed) → 1 (purified) at a world point. */
  purityAt(x: number, y: number): number {
    if (this.radius < 0) return 0;
    const d = Math.hypot(x - this.originX, y - this.originY);
    return Math.max(0, Math.min(1, (this.radius - d) / BLEND_PX));
  }

  /** Torch light colour at a world point. */
  torchColor(x: number, y: number): string {
    const t = Math.round(this.purityAt(x, y) * COLOR_STEPS) / COLOR_STEPS;
    return mix(CURSED_TORCH, WARM_TORCH, t);
  }

  /** Opacity of the dungeon's darkness: it lifts a little as the wave spreads. */
  darknessAlpha(): number {
    if (this.radius < 0) return CURSED_DARKNESS;
    const k = Number.isFinite(this.radius) ? Math.min(1, this.radius / this.maxRadius) : 1;
    return CURSED_DARKNESS + (PURIFIED_DARKNESS - CURSED_DARKNESS) * k;
  }

  private isFloor(x: number, y: number): boolean {
    const tx = Math.floor(x / TILE_PX);
    const ty = Math.floor(y / TILE_PX);
    if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return false;
    return this.map.solid[ty * this.map.width + tx] === 0;
  }
}
