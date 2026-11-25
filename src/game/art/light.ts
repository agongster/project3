/**
 * Soft light glows for lamps, torches, windows and crystals.
 *
 * A glow is a disc made of a few stepped rings (pixel-art lighting is
 * banded, not a smooth gradient), with a checker dither between rings.
 * Draw it with `ctx.globalCompositeOperation = "lighter"` after the night
 * overlay so the light "cuts through" the darkness.
 */
import { parseHex } from "./color";
import { bayer, cached, Pix, type Sprite } from "./engine";

const store = new Map<string, Sprite>();

/** A glow of the given radius (px) and colour; anchor is its centre. Cached. */
export function glowSprite(radius: number, color: string): Sprite {
  const r = Math.max(2, Math.round(radius));
  return cached(store, `${r}:${color}`, () => {
    const size = r * 2 + 1;
    const p = new Pix(size, size);
    const { r: cr, g: cg, b: cb } = parseHex(color);
    const hex = (a: number) => "#" + [cr, cg, cb, Math.round(a * 255)].map((v) => v.toString(16).padStart(2, "0")).join("");
    const rings = [0.18, 0.12, 0.07, 0.035];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - r, y - r) / r; // 0 centre → 1 edge
        if (d > 1) continue;
        const band = d * rings.length + (bayer(x, y) - 0.5) * 0.9;
        const k = Math.max(0, Math.min(rings.length - 1, Math.floor(band)));
        p.set(x, y, hex(rings[k]));
      }
    }
    return p.toSprite(r, r);
  });
}
