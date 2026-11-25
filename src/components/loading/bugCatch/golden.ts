/**
 * Golden bugs: any monster sprite re-coloured as if cast in shiny gold.
 *
 * Each pixel keeps its brightness but takes its colour from a gold ramp
 * (dark outline → deep gold → gold → pale highlight). Because only the
 * brightness is kept, every bug keeps its shape and face but reads clearly
 * as "the special one" — a plain yellow wash over a purple bat looks muddy.
 * Browser only; results are cached per sprite.
 */
import type { Sprite } from "@/game/art";
import { parseHex } from "@/game/art/color";

/** Dark → light. A pixel's brightness (0–1) picks one of these. */
const GOLD_RAMP = ["#6b3f12", "#b8721c", "#e9a92a", "#ffd84a", "#fff3b0"];

const cache = new WeakMap<Sprite, Sprite>();

export function goldenSprite(sprite: Sprite): Sprite {
  const hit = cache.get(sprite);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = sprite.w;
  canvas.height = sprite.h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(sprite.canvas, 0, 0);
  const img = ctx.getImageData(0, 0, sprite.w, sprite.h);
  const ramp = GOLD_RAMP.map(parseHex);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const brightness = (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255;
    const step = Math.min(ramp.length - 1, Math.floor(brightness * ramp.length));
    px[i] = ramp[step].r;
    px[i + 1] = ramp[step].g;
    px[i + 2] = ramp[step].b;
  }
  ctx.putImageData(img, 0, 0);
  const gold = { ...sprite, canvas };
  cache.set(sprite, gold);
  return gold;
}
