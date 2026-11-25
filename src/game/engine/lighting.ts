/**
 * Darkness and light (the night theme and dungeons).
 *
 * How it works, in screen space:
 *   1. Fill an off-screen "darkness" layer with a deep blue at some opacity.
 *   2. Punch soft HOLES into it where lights are ("destination-out"
 *      compositing erases pixels). The hole mask is banded with a dither,
 *      like pixel-art lighting, instead of a smooth gradient.
 *   3. Draw the darkness layer over the world.
 *   4. Add a coloured GLOW on top ("lighter" compositing adds colour), so
 *      lamps look warm and crystals purple.
 */
import { glowSprite } from "@/game/art";
import type { Light } from "../scenes/scene";

/** Opacity of each band of a light's hole, from the centre outward. */
const HOLE_BANDS = [1, 0.85, 0.62, 0.38, 0.16];

/** 4×4 ordered-dither thresholds (0–15), used to soften the band edges. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const holeCache = new Map<number, HTMLCanvasElement>();

/** A white disc whose opacity steps down in bands; used to erase darkness. */
function holeMask(radius: number): HTMLCanvasElement {
  const r = Math.max(2, Math.round(radius));
  let c = holeCache.get(r);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = r * 2 + 1;
  const g = c.getContext("2d")!;
  const img = g.createImageData(c.width, c.height);
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const d = Math.hypot(x - r, y - r) / r;
      if (d > 1) continue;
      const dither = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5;
      const band = Math.max(0, Math.min(HOLE_BANDS.length - 1, Math.floor(d * HOLE_BANDS.length + dither * 0.9)));
      const i = (y * c.width + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(HOLE_BANDS[band] * 255);
    }
  }
  g.putImageData(img, 0, 0);
  holeCache.set(r, c);
  return c;
}

export interface Darkness {
  color: string;
  /** 0–1 opacity of the darkness away from any light. */
  alpha: number;
}

export class Lighting {
  private layer: HTMLCanvasElement | null = null;

  /**
   * Draws darkness with holes and glows. `lights` are in world pixels;
   * (camLeft, camTop) converts them to the screen. Call in SCREEN space.
   */
  draw(g: CanvasRenderingContext2D, w: number, h: number, camLeft: number, camTop: number, darkness: Darkness | null, lights: readonly Light[]): void {
    if (darkness) {
      const layer = this.ensureLayer(w, h);
      const lg = layer.getContext("2d")!;
      lg.globalCompositeOperation = "source-over";
      lg.clearRect(0, 0, w, h);
      lg.globalAlpha = darkness.alpha;
      lg.fillStyle = darkness.color;
      lg.fillRect(0, 0, w, h);
      lg.globalCompositeOperation = "destination-out";
      for (const l of lights) {
        const mask = holeMask(l.radius * 1.25);
        lg.globalAlpha = l.strength ?? 1;
        lg.drawImage(mask, Math.round(l.x - camLeft - mask.width / 2), Math.round(l.y - camTop - mask.height / 2));
      }
      lg.globalAlpha = 1;
      g.drawImage(layer, 0, 0);
    }
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const l of lights) {
      g.globalAlpha = l.strength ?? 1;
      const glow = glowSprite(l.radius, l.color);
      g.drawImage(glow.canvas, Math.round(l.x - camLeft - glow.ax), Math.round(l.y - camTop - glow.ay));
    }
    g.restore();
  }

  private ensureLayer(w: number, h: number): HTMLCanvasElement {
    if (!this.layer) {
      this.layer = document.createElement("canvas");
      this.layer.width = w;
      this.layer.height = h;
    }
    return this.layer;
  }
}

/** Darkens the screen edges (dungeons feel enclosed). Call in screen space. */
export function drawVignette(g: CanvasRenderingContext2D, w: number, h: number, color: string, alpha: number): void {
  const grad = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.6);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, color);
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.restore();
}
