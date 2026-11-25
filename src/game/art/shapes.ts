/**
 * Reusable procedural shapes: lit leafy clumps, pine tiers, palm fronds,
 * snow caps and soft shadows. These are what make trees, bushes and rocks
 * look hand-shaded without drawing every pixel by hand.
 *
 * Light always comes from the TOP-LEFT (and a bit towards the viewer).
 */
import { bayer, hash01, type Pix } from "./engine";

/** An ellipse that is part of a clump. (x, y) is its centre in pixels. */
export interface Blob {
  x: number;
  y: number;
  rx: number;
  ry?: number;
}

const L = (() => {
  const v = [-0.5, -0.7, 0.62];
  const n = Math.hypot(v[0], v[1], v[2]);
  return v.map((c) => c / n);
})();

/**
 * Paints overlapping ellipses as soft 3D balls lit from the top-left and
 * quantises the brightness into `tones` (dark → light). Later blobs are
 * painted over earlier ones, so list them back-to-front (top-to-bottom for
 * a tree canopy): each clump then gets its own lit top and shaded bottom,
 * which is what makes foliage read as "leafy".
 *
 * `bias` shifts everything lighter (+) or darker (−); `dither` blends the
 * tone bands with a checker pattern for a hand-shaded look.
 */
export function litBlobs(p: Pix, blobs: Blob[], tones: string[], opts: { bias?: number; dither?: number; rim?: boolean } = {}): void {
  const bias = opts.bias ?? 0;
  const dither = opts.dither ?? 0.5;
  const n = tones.length;
  for (const b of blobs) {
    const ry = b.ry ?? b.rx;
    for (let y = Math.floor(b.y - ry - 1); y <= Math.ceil(b.y + ry + 1); y++) {
      for (let x = Math.floor(b.x - b.rx - 1); x <= Math.ceil(b.x + b.rx + 1); x++) {
        const nx = (x - b.x) / (b.rx + 0.5);
        const ny = (y - b.y) / (ry + 0.5);
        const d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        let i = nx * L[0] + ny * L[1] + nz * L[2]; // -1..1
        i = (i + 1) / 2 + bias; // 0..1
        let k = Math.floor(i * n + (bayer(x, y) - 0.5) * dither);
        // a dark rim on the lower-right edge separates clumps from each other
        if (opts.rim !== false && d2 > 0.78 && nx + ny > 0.35) k = Math.min(k, 0);
        p.set(x, y, tones[Math.max(0, Math.min(n - 1, k))]);
      }
    }
  }
}

/**
 * Sprinkles little "leaf" highlights over a canopy: short arcs of the
 * lightest tone on already-light pixels. Makes foliage read as leaves rather
 * than smooth balls.
 */
export function leafTexture(p: Pix, tones: string[], seed: number, density = 0.12): void {
  const lightest = tones[tones.length - 1];
  const second = tones[tones.length - 2];
  const dark = tones[1] ?? tones[0];
  const marks: [number, number, string][] = [];
  p.forEach((x, y) => {
    const r = hash01(seed, x, y);
    if (r > density) return;
    const hex = p.hexAt(x, y);
    if (hex === second && p.has(x + 1, y) && p.has(x - 1, y)) marks.push([x, y, lightest]);
    else if (hex === tones[2] && r < density * 0.5 && p.has(x, y + 1)) marks.push([x, y, dark]);
  });
  for (const [x, y, c] of marks) p.set(x, y, c);
}

/**
 * A layered pine tree: `tiers` stacked triangles with jagged lower edges.
 * (cx, top) is the tip; the tree is `h` tall and `w` wide at the bottom.
 */
export function pineTiers(p: Pix, cx: number, top: number, h: number, w: number, tones: string[], opts: { tiers?: number; snow?: string[]; seed?: number } = {}): void {
  const tiers = opts.tiers ?? 3;
  const tierH = h / (tiers * 0.72 + 0.28);
  for (let t = 0; t < tiers; t++) {
    const y0 = Math.round(top + t * tierH * 0.72);
    const th = Math.round(tierH);
    const halfBottom = (w / 2) * (0.55 + (0.45 * (t + 1)) / tiers);
    for (let j = 0; j < th; j++) {
      const y = y0 + j;
      const hw = Math.max(0.5, ((j + 1) / th) * halfBottom);
      for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw - 1); x++) {
        const u = (x + 0.5 - cx) / hw; // -1 (left) .. 1 (right)
        // jagged bottom edge: drop every third pixel on the last row
        if (j === th - 1 && (x + t) % 3 === 0 && Math.abs(u) > 0.2) continue;
        let k: number;
        if (u < -0.45) k = 3;
        else if (u < 0.05) k = 2;
        else if (u < 0.55) k = 1;
        else k = 0;
        if (j >= th - 2) k = Math.max(0, k - 1); // shadow at the bottom of each tier
        if (j < 2 && u < 0.3) k = Math.min(tones.length - 1, k + 1);
        p.set(x, y, tones[Math.min(tones.length - 1, k)]);
      }
      if (opts.snow && j <= 2 + (t === 0 ? 1 : 0)) {
        // snow sits on the upper part of each tier, thicker on the left
        for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw - 1); x++) {
          const u = (x + 0.5 - cx) / hw;
          if (j === 2 && hash01(opts.seed ?? 0, x, y) < 0.5) continue;
          if (u > 0.6 && j > 0) continue;
          p.set(x, y, u > 0.25 ? opts.snow[0] : opts.snow[1]);
        }
      }
    }
  }
}

/** A soft drop shadow (dithered ellipse) — used under props. */
export function dropShadow(p: Pix, cx: number, cy: number, rx: number, ry: number, color = "#1e14302e"): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / (rx + 0.5);
      const ny = (y - cy) / (ry + 0.5);
      if (nx * nx + ny * ny <= 1 && !p.has(x, y)) p.set(x, y, color);
    }
  }
}

/**
 * Adds a snow cap: every painted pixel whose pixel above is empty (an
 * upward-facing edge) gets snow, about `depth` pixels deep. Only rows above
 * `limitY` are capped (e.g. snow on a roof but not on the wall below).
 */
export function snowCap(p: Pix, snow: [string, string], depth = 2, seed = 7, limitY = Infinity): void {
  const caps: [number, number, string][] = [];
  for (let x = 0; x < p.w; x++) {
    for (let y = 0; y < Math.min(p.h, limitY); y++) {
      if (!p.has(x, y) || p.has(x, y - 1)) continue; // not an upward-facing edge
      const d = depth + (hash01(seed, x) < 0.3 ? 1 : 0); // uneven thickness
      for (let k = 0; k < d; k++) {
        if (!p.has(x, y + k + 1)) break; // keep the outline pixel underneath
        caps.push([x, y + k, k === 0 ? snow[0] : snow[1]]);
      }
    }
  }
  for (const [x, y, c] of caps) p.set(x, y, c);
}

/**
 * Draws one curved palm frond from (x0, y0) in direction `angle` (radians),
 * drooping as it goes. `tones` = [dark, mid, light].
 */
export function palmFrond(p: Pix, x0: number, y0: number, angle: number, len: number, droop: number, tones: string[]): void {
  const steps = Math.ceil(len * 2);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let prev: [number, number] | null = null;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = x0 + dx * len * t;
    const y = y0 + dy * len * t + droop * t * t * len * 0.5;
    const px = Math.round(x);
    const py = Math.round(y);
    if (prev && prev[0] === px && prev[1] === py) continue;
    prev = [px, py];
    const width = t < 0.15 ? 1 : t < 0.75 ? 2 : 1;
    // spine
    p.set(px, py, tones[2]);
    // leaflets hang below the spine
    for (let k = 1; k <= width; k++) p.set(px, py + k, tones[k === width ? 0 : 1]);
    if (t > 0.2 && t < 0.9 && s % 3 === 0) p.set(px, py + width + 1, tones[0]);
  }
}
