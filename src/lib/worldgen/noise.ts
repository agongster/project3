/**
 * Smooth "value noise".
 *
 * If every tile rolled its own independent random number, meadows and groves
 * would look like salt-and-pepper static. Value noise instead puts random
 * numbers on a coarse lattice (one every `cellSize` tiles) and blends
 * smoothly between them, which gives soft blobby shapes: perfect for flower
 * fields, clumps of trees and gently meandering streams.
 */
import type { Rng } from "@/lib/rng";

/** Returns a function (x, y) → value in [0, 1) that changes smoothly over the map. */
export function makeValueNoise(rng: Rng, width: number, height: number, cellSize: number): (x: number, y: number) => number {
  const cols = Math.ceil(width / cellSize) + 2;
  const rows = Math.ceil(height / cellSize) + 2;
  const lattice: number[] = [];
  for (let i = 0; i < cols * rows; i++) lattice.push(rng());

  const at = (cx: number, cy: number) => lattice[cy * cols + cx];

  return (x, y) => {
    const gx = Math.max(0, x) / cellSize;
    const gy = Math.max(0, y) / cellSize;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = smoothstep(gx - x0);
    const ty = smoothstep(gy - y0);
    const top = lerp(at(x0, y0), at(x0 + 1, y0), tx);
    const bottom = lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx);
    return lerp(top, bottom, ty);
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Eases 0→1 so the blend has no visible creases at lattice lines. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
