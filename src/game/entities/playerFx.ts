/**
 * Small visual effects around the hero: dash after-images and dust puffs.
 */
import { drawSprite, type Sprite } from "@/game/art";
import { uiSprite } from "@/game/art/ui";
import type { SceneContext } from "../scenes/context";

/** How many ghost copies a dash leaves behind. */
const AFTERIMAGE_COUNT = 3;
/** Seconds between two ghost copies. */
const AFTERIMAGE_SPACING_SEC = 0.045;
/** Seconds a ghost copy takes to fade away. */
const AFTERIMAGE_FADE_SEC = 0.25;
/** Tint of the ghosts (a soft sky blue). */
const AFTERIMAGE_ALPHA = 0.5;

interface Ghost {
  x: number;
  y: number;
  sprite: Sprite;
  age: number;
}

/** Fading copies of the hero left behind while dashing. */
export class Afterimages {
  private ghosts: Ghost[] = [];
  private captured = 0;
  private sinceCapture = 0;

  /** A dash began: allow a fresh set of ghosts. */
  start(): void {
    this.captured = 0;
    this.sinceCapture = AFTERIMAGE_SPACING_SEC;
  }

  /** Called every step of a dash; keeps a ghost every few frames, up to AFTERIMAGE_COUNT. */
  maybeCapture(at: { x: number; y: number }, sprite: Sprite): void {
    if (this.captured >= AFTERIMAGE_COUNT || this.sinceCapture < AFTERIMAGE_SPACING_SEC) return;
    this.ghosts.push({ x: at.x, y: at.y, sprite, age: 0 });
    this.captured++;
    this.sinceCapture = 0;
  }

  update(dt: number): void {
    this.sinceCapture += dt;
    for (const g of this.ghosts) g.age += dt;
    this.ghosts = this.ghosts.filter((g) => g.age < AFTERIMAGE_FADE_SEC);
  }

  draw(g: CanvasRenderingContext2D): void {
    for (const ghost of this.ghosts) {
      const alpha = AFTERIMAGE_ALPHA * (1 - ghost.age / AFTERIMAGE_FADE_SEC);
      drawSprite(g, ghost.sprite, ghost.x, ghost.y, { alpha });
    }
  }
}

/** A few soft dust puffs at someone's feet (starting to run, dashing, landing). */
export function emitDust(ctx: SceneContext, x: number, y: number, count: number): void {
  for (let i = 0; i < count; i++) {
    ctx.particles.emit({
      x: x + (Math.random() - 0.5) * 8,
      y: y - 1,
      vx: (Math.random() - 0.5) * 30,
      vy: -4 - Math.random() * 6,
      life: 0.35 + Math.random() * 0.2,
      sprite: uiSprite("dust", Math.floor(Math.random() * 3)),
      drag: 4,
    });
  }
}
