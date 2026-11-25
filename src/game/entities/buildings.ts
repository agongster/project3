/**
 * Overworld buildings (one per Python file) and the little bits of life
 * around them:
 *
 *   cursed     purple miasma oozes from the roof; a bobbing skull badge
 *              shows how many bugs are still inside
 *   treasure   a bobbing chest icon with sparkles (clean file, chest unopened)
 *   claimable  same chest icon (dungeon cleared, prize not claimed yet)
 *   done       an occasional sparkle; clean houses puff chimney smoke
 */
import { buildingLights, drawSprite, getAtlas, type BuildingState, type Sprite } from "@/game/art";
import { drawText } from "@/game/art/font";
import { uiSprite } from "@/game/art/ui";
import type { AnalyzedFile, Building, ThemeId } from "@/lib/types";
import type { SceneContext } from "../scenes/context";
import type { Drawable, Light } from "../scenes/scene";
import { bugsLeft, buildingStatus, type BuildingStatus } from "../scenes/progressView";
import { hidesHero, TALL_ALPHA } from "./scenery";

const MIASMA_EVERY_SEC = 0.35;
const SMOKE_EVERY_SEC = 0.55;
const SPARKLE_EVERY_SEC = 1.6;
const BADGE_BOB_PX = 2;
/** Roof top row inside the sprite for house-like buildings (see art/buildings.ts). */
const ROOF_TOP: Record<Building["kind"], number> = { cottage: 7, house: 6, manor: 5, tower: 3 };

/** Which picture a building uses for each status. */
export function spriteStateFor(status: BuildingStatus, file: AnalyzedFile | undefined): BuildingState {
  if (status === "cursed") return "corrupted";
  return file && file.findings.length > 0 ? "restored" : "clean";
}

export class BuildingEntity {
  /** Anchor: bottom-centre of the footprint. */
  readonly x: number;
  readonly y: number;
  /** Centre of the walkable tile in front of the door. */
  readonly doorX: number;
  readonly doorY: number;
  status: BuildingStatus = "done";
  private lifeClock = Math.random();

  constructor(
    readonly building: Building,
    readonly file: AnalyzedFile | undefined,
  ) {
    this.x = (building.x + building.w / 2) * 16;
    this.y = (building.y + building.h) * 16;
    this.doorX = building.door.x * 16 + 8;
    this.doorY = building.door.y * 16 + 8;
  }

  get path(): string {
    return this.building.path;
  }

  /** Re-reads the save (cheap; called every step). */
  refresh(ctx: SceneContext): void {
    this.status = buildingStatus(ctx.save.get(), ctx.repoKey, this.file);
  }

  sprite(theme: ThemeId): Sprite {
    const b = this.building;
    return getAtlas(theme).building(b.kind, spriteStateFor(this.status, this.file), b.variant);
  }

  drawable(theme: ThemeId, hero: { x: number; y: number }): Drawable {
    const sprite = this.sprite(theme);
    const seeThrough = hidesHero(sprite, this.x, this.y, hero);
    return { y: this.y, draw: (g) => drawSprite(g, sprite, this.x, this.y, seeThrough ? { alpha: TALL_ALPHA } : undefined) };
  }

  /** Skull + bug count, or a chest icon, bobbing over the roof. Drawn above the lighting. */
  drawBadge(g: CanvasRenderingContext2D, ctx: SceneContext, theme: ThemeId): void {
    if (this.status === "done") return;
    const top = this.y - this.sprite(theme).h;
    const bob = Math.round(Math.sin(ctx.time * 3 + this.x) * BADGE_BOB_PX);
    if (this.status === "cursed" && this.file) {
      const skull = uiSprite("skull");
      const label = `${bugsLeft(ctx.save.get(), ctx.repoKey, this.file)}`;
      drawSprite(g, skull, this.x - 4, top - 2 + bob);
      drawText(g, label, this.x + 2, top - 10 + bob, { color: "#ffd6f5", outline: "#2b1d34" });
    } else {
      drawSprite(g, uiSprite("chestClosed"), this.x, top - 1 + bob);
    }
  }

  /** Miasma, smoke and sparkles (only while on screen). */
  emitLife(dt: number, ctx: SceneContext, theme: ThemeId): void {
    this.lifeClock += dt;
    const sprite = this.sprite(theme);
    const left = this.x - sprite.ax;
    const top = this.y - sprite.ay;
    if (this.status === "cursed" && this.lifeClock >= MIASMA_EVERY_SEC) {
      this.lifeClock = 0;
      const px = left + 4 + Math.random() * (sprite.w - 8);
      ctx.particles.emit({ x: px, y: this.y, z: this.y - top - 6 - Math.random() * 10, vz: 6, vx: (Math.random() - 0.5) * 6, life: 2.2, sprite: uiSprite("miasma", Math.floor(Math.random() * 3)), wobble: 3 });
    } else if ((this.status === "treasure" || this.status === "claimable") && this.lifeClock >= SPARKLE_EVERY_SEC / 2) {
      this.lifeClock = 0;
      ctx.particles.emit({ x: this.x + (Math.random() - 0.5) * 14, y: this.y, z: sprite.h + 4 + Math.random() * 8, life: 0.6, sprite: uiSprite("sparkle", 0) });
    } else if (this.status === "done" && this.lifeClock >= SPARKLE_EVERY_SEC) {
      this.lifeClock = 0;
      ctx.particles.emit({ x: left + Math.random() * sprite.w, y: this.y, z: 8 + Math.random() * (sprite.h - 12), life: 0.6, sprite: uiSprite("sparkle", 1) });
    }
    if (this.status !== "cursed" && this.building.kind !== "tower" && Math.random() < dt / SMOKE_EVERY_SEC) this.puffSmoke(ctx, left, top);
  }

  /** Lights for the night theme / the always-on cursed doorway glow. */
  lights(dark: boolean, out: Light[]): void {
    const b = this.building;
    for (const l of buildingLights(b.kind, spriteStateFor(this.status, this.file))) {
      if (dark || l.always) out.push({ x: this.x + l.dx, y: this.y + l.dy, radius: l.radius, color: l.color, strength: dark ? 1 : 0.6 });
    }
  }

  private puffSmoke(ctx: SceneContext, left: number, top: number): void {
    const b = this.building;
    const spriteW = b.w * 16;
    const chimneyX = left + (b.variant % 2 ? spriteW - 12 : 6) + 2;
    const chimneyTop = top + ROOF_TOP[b.kind] - 4;
    ctx.particles.emit({ x: chimneyX, y: this.y, z: this.y - chimneyTop, vz: 9, vx: 3, life: 1.8, color: "#ece8f4", size: 3, wobble: 2, drag: 0.3 });
  }
}
