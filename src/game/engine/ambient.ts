/**
 * Ambient drifting particles that give each scenery theme its mood:
 * pollen, sakura petals, autumn leaves, snow, sea-spray bubbles, fireflies,
 * and slow dust motes in dungeons.
 *
 * They live in a screen-sized box that wraps around: when the camera moves,
 * they slide the other way (so they feel part of the world) and whatever
 * leaves one edge comes back in at the opposite one. A fixed set of
 * AMBIENT_COUNT particles is enough to fill the screen forever.
 */
import { drawSprite, glowSprite } from "@/game/art";
import { uiSprite, type UiSpriteName } from "@/game/art/ui";
import type { ThemeDef } from "@/lib/game/catalog";

/** "dust" floats in dungeons, "sparkles" once a dungeon is purified. */
export type AmbientKind = ThemeDef["ambient"] | "dust" | "sparkles";

const AMBIENT_COUNT = 26;
/** Extra room around the screen so particles wrap out of sight. */
const MARGIN = 12;

interface Motion {
  /** Base drift in px/s. */
  vx: number;
  vy: number;
  /** Side-to-side sway amplitude in px. */
  sway: number;
  sprite: UiSpriteName | null;
  /** Sprite animation frames. */
  frames: number;
  /** Chance that a particle is a sprite rather than a 1-px dot. */
  spriteShare: number;
}

const MOTIONS: Record<AmbientKind, Motion> = {
  pollen: { vx: 4, vy: -3, sway: 6, sprite: "pollen", frames: 2, spriteShare: 0.4 },
  petals: { vx: 10, vy: 9, sway: 10, sprite: "petal", frames: 4, spriteShare: 0.8 },
  leaves: { vx: 8, vy: 11, sway: 12, sprite: "leaf", frames: 4, spriteShare: 0.8 },
  snow: { vx: 3, vy: 12, sway: 6, sprite: "snowflake", frames: 2, spriteShare: 0.45 },
  bubbles: { vx: 0, vy: -7, sway: 4, sprite: "bubble", frames: 2, spriteShare: 0.6 },
  fireflies: { vx: 0, vy: 0, sway: 14, sprite: "firefly", frames: 2, spriteShare: 1 },
  dust: { vx: 2, vy: -1.5, sway: 5, sprite: null, frames: 1, spriteShare: 0 },
  sparkles: { vx: 0, vy: -5, sway: 4, sprite: "sparkle", frames: 3, spriteShare: 0.5 },
};

interface Mote {
  x: number;
  y: number;
  phase: number;
  speed: number;
  color: string;
  useSprite: boolean;
}

export class Ambient {
  private motes: Mote[] = [];
  private kind: AmbientKind | null = null;
  private time = 0;

  constructor(
    private readonly w: number,
    private readonly h: number,
  ) {}

  /** Switches the particle kind (and re-seeds the particles if it changed). */
  setKind(kind: AmbientKind, colors: readonly string[]): void {
    if (kind === this.kind) return;
    this.kind = kind;
    const motion = MOTIONS[kind];
    this.motes = Array.from({ length: AMBIENT_COUNT }, (_, i) => ({
      x: Math.random() * (this.w + MARGIN * 2),
      y: Math.random() * (this.h + MARGIN * 2),
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 0.8,
      color: colors[i % colors.length],
      useSprite: Math.random() < motion.spriteShare,
    }));
  }

  update(dt: number): void {
    if (!this.kind) return;
    this.time += dt;
    const m = MOTIONS[this.kind];
    for (const p of this.motes) {
      p.x += m.vx * p.speed * dt;
      p.y += m.vy * p.speed * dt;
      if (this.kind === "fireflies") {
        p.x += Math.cos(this.time * 0.7 + p.phase) * 8 * dt;
        p.y += Math.sin(this.time * 0.9 + p.phase * 1.3) * 6 * dt;
      }
    }
  }

  /** Draws in screen space; the camera position makes the particles slide with the world. */
  draw(g: CanvasRenderingContext2D, camLeft: number, camTop: number): void {
    if (!this.kind) return;
    const m = MOTIONS[this.kind];
    const spanW = this.w + MARGIN * 2;
    const spanH = this.h + MARGIN * 2;
    for (const p of this.motes) {
      const sway = Math.sin(this.time * 1.5 * p.speed + p.phase) * m.sway;
      const sx = mod(p.x - camLeft + sway, spanW) - MARGIN;
      const sy = mod(p.y - camTop, spanH) - MARGIN;
      if (this.kind === "fireflies") {
        const blink = 0.5 + 0.5 * Math.sin(this.time * 2.2 + p.phase * 3);
        g.save();
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = blink;
        drawSprite(g, glowSprite(7, p.color), sx, sy);
        g.restore();
        if (blink > 0.3) drawSprite(g, uiSprite("firefly", 0), sx, sy, { alpha: blink });
        continue;
      }
      if (p.useSprite && m.sprite) {
        drawSprite(g, uiSprite(m.sprite, Math.floor(this.time * 4 * p.speed + p.phase)), sx, sy);
      } else {
        g.globalAlpha = 0.85;
        g.fillStyle = p.color;
        g.fillRect(Math.round(sx), Math.round(sy), 1, 1);
        g.globalAlpha = 1;
      }
    }
  }
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}
