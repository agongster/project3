/**
 * Overworld buildings (one per Python file) and the little bits of life
 * around them:
 *
 *   cursed     purple miasma oozes from the roof; a bobbing skull badge
 *              shows how many bugs are still inside
 *   treasure   a bobbing chest icon with sparkles (clean file, chest unopened)
 *   claimable  same chest icon (dungeon cleared, prize not claimed yet)
 *   done       an occasional sparkle; clean houses puff chimney smoke
 *
 * When its file is edited in the Workshop a building PULSES the first time
 * it is on screen afterwards: a white flash and a shower of gold stars when
 * it was purified, a purple shudder and a puff of miasma when a new bug
 * cursed it, a small sparkle when only its bug count changed.
 */
import { buildingLights, drawSprite, flashSprite, getAtlas, type BuildingState, type Sprite } from "@/game/art";
import { drawText } from "@/game/art/font";
import { uiSprite } from "@/game/art/ui";
import type { AnalyzedFile, Building, ThemeId } from "@/lib/types";
import type { SceneContext } from "../scenes/context";
import type { Drawable, Light } from "../scenes/scene";
import { bugsLeft, buildingStatus, type BuildingStatus } from "../scenes/progressView";
import { hidesHero, TALL_ALPHA } from "./scenery";
import { tinted } from "./monsters/monsterDraw";

const MIASMA_EVERY_SEC = 0.35;
const SMOKE_EVERY_SEC = 0.55;
const SPARKLE_EVERY_SEC = 1.6;
const BADGE_BOB_PX = 2;
/** Roof top row inside the sprite for house-like buildings (see art/buildings.ts). */
const ROOF_TOP: Record<Building["kind"], number> = { cottage: 7, house: 6, manor: 5, tower: 3 };
/** How long an edited building's pulse lasts. */
const PULSE_SEC = 0.9;
/** The strongest flash over the sprite, at the start of a pulse. */
const PULSE_FLASH_ALPHA = 0.85;
const CURSE_TINT = "#b56cff";
/** A newly cursed building shudders sideways by this much (px), this many times a second. */
const SHUDDER_PX = 1;
const SHUDDER_HZ = 18;
const PULSE_STARS = 18;
const PULSE_MIASMA = 10;
const PULSE_SPARKLES = 6;

/** How an edit changed a building (see the file comment). */
export type BuildingPulse = "cleansed" | "cursed" | "changed";

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
  /** The file as the code is now (replaced by `setFile` after an edit in the Workshop). */
  file: AnalyzedFile | undefined;
  private lifeClock = Math.random();
  /** A pulse waiting to be seen (it starts the first time the building is on screen). */
  private armedPulse: BuildingPulse | null = null;
  private pulse: { kind: BuildingPulse; age: number } | null = null;

  constructor(
    readonly building: Building,
    file: AnalyzedFile | undefined,
  ) {
    this.file = file;
    this.x = (building.x + building.w / 2) * 16;
    this.y = (building.y + building.h) * 16;
    this.doorX = building.door.x * 16 + 8;
    this.doorY = building.door.y * 16 + 8;
  }

  get path(): string {
    return this.building.path;
  }

  setFile(file: AnalyzedFile): void {
    this.file = file;
  }

  /** Pulses (see the file comment) as soon as the building is on screen. */
  pulseWhenSeen(kind: BuildingPulse): void {
    this.armedPulse = kind;
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
    const pulse = this.pulse;
    const shudder = pulse?.kind === "cursed" ? (Math.floor(pulse.age * SHUDDER_HZ) % 2 === 0 ? SHUDDER_PX : -SHUDDER_PX) : 0;
    const x = this.x + shudder;
    return {
      y: this.y,
      draw: (g) => {
        drawSprite(g, sprite, x, this.y, seeThrough ? { alpha: TALL_ALPHA } : undefined);
        if (!pulse) return;
        const flash = pulse.kind === "cursed" ? tinted(sprite, CURSE_TINT) : flashSprite(sprite);
        drawSprite(g, flash, x, this.y, { alpha: PULSE_FLASH_ALPHA * (1 - pulse.age / PULSE_SEC) });
      },
    };
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
    this.updatePulse(dt, ctx, sprite);
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

  /** Starts an armed pulse (with its burst of particles) and ages the running one. */
  private updatePulse(dt: number, ctx: SceneContext, sprite: Sprite): void {
    if (this.armedPulse) {
      this.pulse = { kind: this.armedPulse, age: 0 };
      this.armedPulse = null;
      this.burst(ctx, this.pulse.kind, sprite);
    }
    if (!this.pulse) return;
    this.pulse.age += dt;
    if (this.pulse.age >= PULSE_SEC) this.pulse = null;
  }

  private burst(ctx: SceneContext, kind: BuildingPulse, sprite: Sprite): void {
    const roof = sprite.h - 8;
    if (kind === "cleansed") {
      for (let i = 0; i < PULSE_STARS; i++) {
        ctx.particles.emit({ x: this.x + (Math.random() - 0.5) * sprite.w, y: this.y, z: roof * Math.random(), vz: 24 + Math.random() * 30, gravity: 30, life: 1.1, sprite: uiSprite(i % 3 === 0 ? "star" : "sparkle", i), delay: i * 0.02 });
      }
    } else if (kind === "cursed") {
      for (let i = 0; i < PULSE_MIASMA; i++) {
        ctx.particles.emit({ x: this.x + (Math.random() - 0.5) * sprite.w, y: this.y, z: roof, vz: 10, vx: (Math.random() - 0.5) * 20, life: 1.6, sprite: uiSprite("miasma", i % 3), wobble: 3 });
      }
    } else {
      ctx.particles.burst(PULSE_SPARKLES, this.x, this.y - roof / 2, 30, { life: 0.7, sprite: uiSprite("sparkle", 1), drag: 2 });
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
