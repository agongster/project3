/**
 * Ground tiles (16×16, no outlines) for every `Ground` id.
 *
 * AUTOTILING. Path, plaza, water and sand blend into the grass around them.
 * Each tile looks at its four neighbours and builds a 4-bit mask:
 *
 *        N = 1
 *   W = 8  [tile]  E = 2          mask = sum of the sides whose neighbour
 *        S = 4                    is the "same" ground (see `connects`)
 *
 * so there are 16 possible tiles per ground. They are not drawn by hand: we
 * paint the plain tile, then repaint a wobbly grass border on every side
 * whose bit is 0, rounding the corner where two such sides meet.
 * `autotileMask()` computes the mask for the engine.
 */
import { Ground, type GroundId } from "@/lib/types";
import { hash01, mod, Pix } from "./engine";
import { DUNGEON, type ThemePalette } from "./themes";
import { mix, shade } from "./color";

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

const T = 16;

/** How many animation frames each ground id has (the `frame` argument is taken modulo this). */
export const GROUND_FRAMES: Record<number, number> = {
  [Ground.Water]: 4,
  [Ground.DungeonExit]: 4,
};

export function groundFrames(id: GroundId): number {
  return GROUND_FRAMES[id] ?? 1;
}

/** How many distinct looks a ground id has (the `variant` argument is taken modulo this). */
export function groundVariants(id: GroundId): number {
  switch (id) {
    case Ground.Grass:
    case Ground.Meadow:
      return 16;
    case Ground.DungeonFloor:
    case Ground.DungeonFloorAlt:
      return 12;
    case Ground.Path:
    case Ground.Sand:
    case Ground.DungeonWallFace:
      return 4;
    case Ground.Water:
      return 4;
    default:
      return 1;
  }
}

const isSolidDungeon = (g: number) => g === Ground.DungeonWall || g === Ground.DungeonWallFace || g === Ground.DungeonVoid;

/** True when a tile of ground `id` should blend seamlessly into a neighbour of ground `other`. */
function connects(id: number, other: number): boolean {
  if (other < 0) return true; // off the map: no border
  switch (id) {
    case Ground.Path:
      return other === Ground.Path || other === Ground.Plaza || other === Ground.Bridge || other === Ground.DungeonExit;
    case Ground.Plaza:
      return other === Ground.Plaza || other === Ground.Path || other === Ground.Bridge;
    case Ground.Water:
      return other === Ground.Water || other === Ground.Bridge;
    case Ground.Sand:
      return other === Ground.Sand || other === Ground.Water || other === Ground.Bridge || other === Ground.Path || other === Ground.Plaza;
    case Ground.Bridge:
      return other === Ground.Bridge;
    case Ground.DungeonWall:
      return isSolidDungeon(other);
    default:
      return true;
  }
}

/**
 * Computes the mask to pass to `atlas.ground()` for the tile at (x, y).
 * `at(x, y)` must return the ground id there, or -1 outside the map.
 * The low 4 bits are the N/E/S/W "same ground" bits described above; a few
 * tiles use extra bits (water: which sides touch sand; bridge: which sides
 * touch water) — callers never need to look inside the number.
 */
export function autotileMask(at: (x: number, y: number) => number, x: number, y: number): number {
  const id = at(x, y);
  const n = at(x, y - 1);
  const e = at(x + 1, y);
  const s = at(x, y + 1);
  const w = at(x - 1, y);
  let m = 0;
  if (connects(id, n)) m |= N;
  if (connects(id, e)) m |= E;
  if (connects(id, s)) m |= S;
  if (connects(id, w)) m |= W;
  if (id === Ground.Water) {
    if (n === Ground.Sand) m |= N << 4;
    if (e === Ground.Sand) m |= E << 4;
    if (s === Ground.Sand) m |= S << 4;
    if (w === Ground.Sand) m |= W << 4;
  }
  if (id === Ground.Bridge) {
    if (n === Ground.Water) m |= N << 4;
    if (e === Ground.Water) m |= E << 4;
    if (s === Ground.Water) m |= S << 4;
    if (w === Ground.Water) m |= W << 4;
  }
  return m;
}

/** Edges wobble with a 16-px periodic pattern so neighbouring tiles' borders line up. */
const WOBBLE = [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0];

/**
 * Which pixels of an autotiled tile belong to the tile's own ground (true)
 * rather than the grass border (false). Sides whose mask bit is 0 get a
 * border `inset` px deep (± wobble); corners between two such sides are
 * rounded with `radius`.
 */
function innerMask(mask: number, inset: number, radius: number): boolean[] {
  const out: boolean[] = [];
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const top = mask & N ? -99 : inset + WOBBLE[x];
      const bottom = mask & S ? 99 : T - 1 - inset - WOBBLE[(x + 5) % T];
      const left = mask & W ? -99 : inset + WOBBLE[(y + 3) % T];
      const right = mask & E ? 99 : T - 1 - inset - WOBBLE[(y + 9) % T];
      let ok = x >= left && x <= right && y >= top && y <= bottom;
      if (ok && radius > 0) {
        const corner = (cxEdge: number, cyEdge: number, dx: number, dy: number) => {
          // centre of the rounding circle, `radius` px in from both edges
          const cx = cxEdge + dx * (radius - 0.5);
          const cy = cyEdge + dy * (radius - 0.5);
          const inCornerZone = (x - cx) * dx < 0 && (y - cy) * dy < 0;
          return !inCornerZone || Math.hypot(x - cx, y - cy) <= radius - 0.1;
        };
        if (!(mask & N) && !(mask & W)) ok = ok && corner(left - 0.5, top - 0.5, 1, 1);
        if (!(mask & N) && !(mask & E)) ok = ok && corner(right + 0.5, top - 0.5, -1, 1);
        if (!(mask & S) && !(mask & W)) ok = ok && corner(left - 0.5, bottom + 0.5, 1, -1);
        if (!(mask & S) && !(mask & E)) ok = ok && corner(right + 0.5, bottom + 0.5, -1, -1);
      }
      out.push(ok);
    }
  }
  return out;
}

// ─────────────────────────── overworld ───────────────────────────

/** Small decorations for grass tiles, per theme. */
function sprinkle(p: Pix, pal: ThemePalette, x: number, y: number, k: number): void {
  const c = pal.sprinkles;
  switch (pal.sprinkle) {
    case "daisy": {
      const petal = k % 3 === 2 ? c[2] : c[0];
      p.set(x, y - 1, petal);
      p.set(x - 1, y, petal);
      p.set(x + 1, y, petal);
      p.set(x, y + 1, petal);
      p.set(x, y, c[1]);
      p.set(x + 1, y + 1, pal.grass.dark);
      break;
    }
    case "petal":
      p.set(x, y, c[k % 2]);
      p.set(x + 1, y, c[2]);
      p.set(x + 3, y + 2, c[(k + 1) % 2]);
      break;
    case "leaf":
      p.set(x, y, c[k % 3]);
      p.set(x + 1, y, c[k % 3]);
      p.set(x + 1, y - 1, c[(k + 1) % 3]);
      p.set(x, y + 1, shade(c[k % 3], 0.12));
      break;
    case "sparkle":
      p.set(x, y, c[0]);
      p.set(x - 1, y, c[1]);
      p.set(x + 1, y, c[1]);
      p.set(x, y - 1, c[1]);
      p.set(x, y + 1, c[1]);
      break;
    case "shell":
      if (k % 2) {
        // little scallop shell
        p.set(x, y, c[0]);
        p.set(x + 1, y, c[1]);
        p.set(x + 2, y, c[0]);
        p.set(x + 1, y - 1, c[1]);
        p.set(x + 1, y + 1, shade(c[0], 0.15));
      } else {
        // tiny starfish
        p.set(x, y, c[2]);
        p.set(x - 1, y, c[2]);
        p.set(x + 1, y, c[2]);
        p.set(x, y - 1, c[2]);
        p.set(x - 1, y + 1, c[2]);
        p.set(x + 1, y + 1, c[2]);
      }
      break;
    case "glow":
      p.set(x, y, c[k % 3]);
      p.set(x + 1, y, mix(c[k % 3], pal.grass.base, 0.6));
      p.set(x - 1, y, mix(c[k % 3], pal.grass.base, 0.6));
      p.set(x, y - 1, mix(c[k % 3], pal.grass.base, 0.6));
      p.set(x + 3, y + 2, c[(k + 1) % 3]);
      break;
  }
}

/** A tiny grass tuft (three blades) with its base at (x, y). */
function tuft(p: Pix, pal: ThemePalette, x: number, y: number): void {
  const [d, l] = pal.tuft;
  p.set(x - 1, y - 1, d);
  p.set(x + 1, y - 1, d);
  p.set(x, y - 2, l);
  p.set(x, y - 1, d);
  p.set(x - 2, y - 2, l);
  p.set(x + 2, y - 2, l);
  p.set(x - 1, y, d);
  p.set(x, y, d);
  p.set(x + 1, y, d);
}

/** Paints a full grass tile (used as the base of every overworld tile, so borders blend). */
function paintGrass(p: Pix, pal: ThemePalette, v: number, base: { base: string; dark: string; light: string } = pal.grass): void {
  p.rect(0, 0, T, T, base.base);
  // soft, large blotches of darker / lighter grass break up the grid
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const r = hash01(v * 31 + 7, x, y);
      if (r < 0.045) p.set(x, y, base.dark);
      else if (r > 0.97) p.set(x, y, base.light);
    }
  }
  // tiny two-pixel blades
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(hash01(v, i, 1) * 14) + 1;
    const y = Math.floor(hash01(v, i, 2) * 13) + 2;
    p.set(x, y, base.dark);
    p.set(x + 1, y - 1, base.dark);
  }
}

/** The 16 grass looks. Most are calm; a few have tufts or theme sprinkles. */
function grassTile(pal: ThemePalette, v: number): Pix {
  const p = new Pix(T, T);
  paintGrass(p, pal, v);
  const at = (i: number, lo: number, hi: number) => lo + Math.floor(hash01(v, i, 99) * (hi - lo + 1));
  if (v === 4 || v === 5 || v === 9 || v === 13) tuft(p, pal, at(1, 3, 12), at(2, 5, 13));
  if (v === 9) tuft(p, pal, at(3, 3, 12), at(4, 4, 8));
  if (v === 6 || v === 13) sprinkle(p, pal, at(5, 3, 12), at(6, 3, 12), v);
  if (v === 11) {
    sprinkle(p, pal, at(7, 2, 6), at(8, 3, 6), v + 1);
    sprinkle(p, pal, at(9, 9, 13), at(10, 9, 13), v);
  }
  return p;
}

/**
 * Flower-field tile: the same grass (so there is no visible seam with plain
 * grass) covered in a few flowers and tufts.
 */
function meadowTile(pal: ThemePalette, v: number): Pix {
  const p = new Pix(T, T);
  paintGrass(p, pal, v + 50);
  const count = 2 + (v % 3);
  for (let i = 0; i < count; i++) {
    // place flowers on a jittered grid so they never clump
    const cell = (i * 5 + v) % 4;
    const x = (cell % 2) * 8 + 2 + Math.floor(hash01(v, i, 3) * 4);
    const y = Math.floor(cell / 2) * 8 + 2 + Math.floor(hash01(v, i, 4) * 4);
    const c = pal.flowers[Math.floor(hash01(v, i, 5) * pal.flowers.length)];
    p.set(x, y + 2, pal.tuft[0]);
    p.set(x + 1, y + 2, pal.grass.dark);
    p.set(x, y - 1, c);
    p.set(x - 1, y, c);
    p.set(x + 1, y, c);
    p.set(x, y + 1, c);
    p.set(x, y, pal.flowerCenter);
    p.set(x + 1, y + 1, shade(c, 0.15));
  }
  if (v % 4 === 1) tuft(p, pal, 4 + (v % 7), 13);
  return p;
}

/**
 * Shared border painter for autotiled grounds: `inner` pixels keep the
 * tile's own look, the rest becomes grass with a highlighted "lip" where it
 * meets the inner ground and a shadow cast onto the inner ground below it.
 */
/**
 * Returns a lookup "is pixel (x, y) part of the inner ground?" that also
 * answers for pixels just OUTSIDE the tile: across a connected side the inner
 * ground continues, across an unconnected side there is grass.
 */
function insideFn(inner: boolean[], mask: number): (x: number, y: number) => boolean {
  const clamp = (v: number) => Math.max(0, Math.min(T - 1, v));
  return (x, y) => {
    if (y < 0 && !(mask & N)) return false;
    if (y >= T && !(mask & S)) return false;
    if (x < 0 && !(mask & W)) return false;
    if (x >= T && !(mask & E)) return false;
    return inner[clamp(y) * T + clamp(x)];
  };
}

function grassBorder(p: Pix, inner: boolean[], mask: number, pal: ThemePalette, v: number, shadow: string | null, lipColor = pal.grass.light): void {
  const grass = new Pix(T, T);
  paintGrass(grass, pal, v);
  const isIn = insideFn(inner, mask);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (isIn(x, y)) {
        // inner pixel right below / right of the grass: in the grass's shadow
        if (shadow && (!isIn(x, y - 1) || !isIn(x - 1, y))) p.set(x, y, shadow);
        continue;
      }
      p.set(x, y, grass.hexAt(x, y));
      const touches = isIn(x, y + 1) || isIn(x + 1, y) || isIn(x, y - 1) || isIn(x - 1, y);
      if (touches) p.set(x, y, lipColor);
    }
  }
}

function pathTile(pal: ThemePalette, mask: number, v: number): Pix {
  const c = pal.path;
  const p = new Pix(T, T);
  p.rect(0, 0, T, T, c.base);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const r = hash01(v + 11, x, y);
      if (r < 0.06) p.set(x, y, c.dark);
      else if (r > 0.95) p.set(x, y, c.light);
    }
  }
  // a couple of pebbles: light top, dark bottom
  for (let i = 0; i < 2; i++) {
    const x = 2 + Math.floor(hash01(v, i, 7) * 11);
    const y = 2 + Math.floor(hash01(v, i, 8) * 11);
    p.set(x, y, c.light);
    p.set(x + 1, y, c.light);
    p.set(x, y + 1, c.pebble);
    p.set(x + 1, y + 1, c.pebble);
  }
  if ((mask & 15) !== 15) grassBorder(p, innerMask(mask, 3, 4), mask, pal, v, c.dark);
  return p;
}

/** Cobblestones laid out in staggered rows (one fixed 16×16 pattern that tiles seamlessly). */
const COBBLES: [number, number, number, number][] = [
  // x, y, w, h  (stones may wrap around the tile's right edge)
  [0, 0, 5, 4], [5, 0, 5, 4], [10, 0, 6, 4],
  [13, 4, 5, 4], [2, 4, 5, 4], [7, 4, 6, 4],
  [0, 8, 6, 4], [6, 8, 5, 4], [11, 8, 5, 4],
  [14, 12, 5, 4], [3, 12, 5, 4], [8, 12, 6, 4],
];

function plazaTile(pal: ThemePalette, mask: number, v: number): Pix {
  const c = pal.plaza;
  const p = new Pix(T, T);
  p.rect(0, 0, T, T, c.mortar);
  COBBLES.forEach(([sx, sy, sw, sh], i) => {
    const tone = hash01(i, 3) < 0.25 ? c.light : hash01(i, 4) < 0.2 ? mix(c.base, c.dark, 0.5) : c.base;
    for (let j = 0; j < sh - 1; j++) {
      for (let k = 0; k < sw - 1; k++) {
        // round each stone's corners
        if ((j === 0 || j === sh - 2) && (k === 0 || k === sw - 2)) continue;
        let col = tone;
        if (j === 0 || k === 0) col = mix(tone, c.light, 0.6);
        if (j === sh - 2 || k === sw - 2) col = c.dark;
        p.set((sx + k) % T, sy + j, col);
      }
    }
  });
  if (pal.snowy) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (hash01(v, x, y) < 0.05) p.set(x, y, "#ffffff");
  }
  if ((mask & 15) !== 15) grassBorder(p, innerMask(mask, 2, 3), mask, pal, v, null, shade(pal.grass.base, 0.08));
  return p;
}

function sandTile(pal: ThemePalette, mask: number, v: number): Pix {
  const c = pal.sand;
  const p = new Pix(T, T);
  p.rect(0, 0, T, T, c.base);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const r = hash01(v + 3, x, y);
      if (r < 0.07) p.set(x, y, c.dark);
      else if (r > 0.93) p.set(x, y, c.light);
    }
  }
  // soft ripple
  if (v % 2 === 0) {
    const y = 5 + (v % 3) * 3;
    for (let x = 3; x < 9; x++) p.set(x, y + (x > 5 ? 1 : 0), c.dark);
  }
  if (v === 3) sprinkle(p, { ...pal, sprinkle: "shell", sprinkles: ["#ffc6d0", "#ffffff", "#ff9b7a"] }, 10, 10, 1);
  if ((mask & 15) !== 15) {
    const inner = innerMask(mask, 2, 3);
    // dithered transition instead of a lip: sand and grass grains mix
    grassBorder(p, inner, mask, pal, v, null, pal.grass.base);
    const isIn = insideFn(inner, mask);
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const nearIn = isIn(x - 1, y) || isIn(x + 1, y) || isIn(x, y - 1) || isIn(x, y + 1);
        if (!isIn(x, y) && nearIn && (x + y) % 2 === 0) p.set(x, y, c.dark);
      }
    }
  }
  return p;
}

/** Water: 4 frames of gently drifting wave highlights; shoreline where it meets land. */
function waterTile(pal: ThemePalette, mask: number, v: number, frame: number): Pix {
  const c = pal.water;
  const p = new Pix(T, T);
  p.rect(0, 0, T, T, c.base);
  // deeper water dither in the middle area
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if ((x + y * 3 + v) % 7 === 0 && hash01(x, y, v) < 0.5) p.set(x, y, mix(c.base, c.deep, 0.6));
  // wave highlights: short strokes that slide 4 px right each frame (period 16 = seamless)
  const waves: [number, number, number][] = [
    [1, 3, 4],
    [9, 7, 3],
    [4, 11, 4],
    [12, 14, 3],
  ];
  for (const [wx, wy, len] of waves) {
    for (let k = 0; k < len; k++) {
      const x = mod(wx + k + frame * 4 + (v % 2) * 2, T);
      p.set(x, wy, c.light);
      if (k === 1) p.set(x, wy - 1, mix(c.light, c.base, 0.5));
    }
  }
  // a twinkle that blinks on alternate frames
  const tx = mod(6 + v * 5, T);
  if (frame % 2 === 0) p.set(tx, 9, c.shine);
  if (pal.snowy && v === 1) {
    // a little ice floe
    p.ellipse(9.5, 5.5, 2.5, 1.2, "#f4fbff");
    p.hline(8, 11, 7, "#c9e6f6");
  }
  if (pal.lit && v === 2) p.set(mod(3 + frame, T), 4, c.shine);
  if ((mask & 15) === 15) return p;

  const inner = innerMask(mask, 3, 4);
  const isIn = insideFn(inner, mask);
  const sandSides = mask >> 4;
  const out = p.clone();
  const grass = new Pix(T, T);
  paintGrass(grass, pal, v);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (!isIn(x, y)) {
        // land: grass (or sand on sandy sides)
        const sandy = (sandSides & N && y < 6) || (sandSides & S && y > 9) || (sandSides & W && x < 6) || (sandSides & E && x > 9);
        if (sandy) out.set(x, y, hash01(x, y, 5) < 0.1 ? pal.sand.dark : pal.sand.base);
        else {
          out.set(x, y, grass.hexAt(x, y));
        }
        if (isIn(x, y + 1) || isIn(x + 1, y) || isIn(x - 1, y) || isIn(x, y - 1)) out.set(x, y, sandy ? pal.sand.light : pal.grass.light);
        continue;
      }
      // water: under the far (north) shore we see the earth bank, then foam
      // (only along the north shore: wobbly side edges must not grow a bank)
      const northShore = !(mask & N) && y < 9;
      const landAbove1 = northShore && !isIn(x, y - 1);
      const landAbove2 = northShore && !isIn(x, y - 2);
      if (landAbove1) out.set(x, y, shade(pal.bank, 0.08));
      else if (landAbove2) out.set(x, y, pal.bank);
      else if (!isIn(x, y - 3) || !isIn(x - 1, y) || !isIn(x + 1, y) || !isIn(x, y + 1)) {
        // foam line, gently shimmering between frames
        out.set(x, y, (x + y + frame) % 4 === 0 ? c.light : c.foam);
      } else if (!isIn(x - 2, y) || !isIn(x + 2, y) || !isIn(x, y + 2) || !isIn(x, y - 4)) {
        out.set(x, y, mix(c.base, c.light, 0.35));
      }
    }
  }
  return out;
}

/**
 * Wooden bridge over water. Planks run across the direction of travel, with
 * a rail along both sides and posts where the bridge meets land.
 */
function bridgeTile(pal: ThemePalette, mask: number): Pix {
  const p = new Pix(T, T);
  const same = mask & 15;
  const wet = mask >> 4;
  // travel direction: along neighbouring bridge tiles, else across the water
  const horizontal = same & (E | W) ? true : same & (N | S) ? false : !!(wet & (N | S)) || !(wet & (E | W));
  const wood = pal.wood;
  const plankLo = shade(wood, 0.12);
  const plankHi = mix(wood, "#fff4dc", 0.25);
  const rail = shade(wood, 0.2);
  const ink = mix(shade(wood, 0.4), "#2b1d34", 0.5);
  // "a" runs along the bridge, "b" across it (swapped for vertical bridges)
  const draw = (a: number, b: number, c: string) => (horizontal ? p.set(a, b, c) : p.set(b, a, c));
  for (let a = 0; a < T; a++) {
    draw(a, 0, ink);
    draw(a, 1, plankHi);
    draw(a, 2, rail);
    for (let b = 3; b <= 12; b++) {
      let c = a % 4 === 3 ? plankLo : b === 3 ? plankHi : wood;
      if (a % 4 !== 3 && hash01(a >> 2, 5) < 0.5 && b === 8) c = plankLo; // wood grain
      draw(a, b, c);
    }
    draw(a, 13, rail);
    draw(a, 14, shade(rail, 0.1));
    draw(a, 15, ink);
  }
  // posts at the ends (where the bridge meets land) and in the middle
  const ends = horizontal ? [same & W ? -1 : 0, 7, same & E ? -1 : 14] : [same & N ? -1 : 0, 7, same & S ? -1 : 14];
  for (const a of ends) {
    if (a < 0) continue;
    for (const b of [0, 1, 2, 13, 14, 15]) {
      draw(a, b, b === 0 || b === 15 ? ink : plankHi);
      draw(a + 1, b, b === 0 || b === 15 ? ink : rail);
    }
  }
  if (pal.snowy) for (let a = 0; a < T; a++) if (hash01(a, 4) < 0.7) draw(a, 1, "#ffffff");
  return p;
}

// ──────────────────────────── dungeon ────────────────────────────

function dungeonFloor(v: number, alt: boolean): Pix {
  const c = alt ? DUNGEON.floorAlt : DUNGEON.floor;
  const p = new Pix(T, T);
  p.rect(0, 0, T, T, c.mortar);
  // stones: the main floor uses 4 big flagstones, the alt floor a staggered brick pattern
  const stones: [number, number, number, number][] = alt
    ? [
        [0, 0, 6, 4], [6, 0, 5, 4], [11, 0, 5, 4],
        [0, 4, 3, 4], [3, 4, 6, 4], [9, 4, 7, 4],
        [0, 8, 5, 4], [5, 8, 6, 4], [11, 8, 5, 4],
        [0, 12, 3, 4], [3, 12, 7, 4], [10, 12, 6, 4],
      ]
    : [
        [0, 0, 8, 8], [8, 0, 8, 6], [8, 6, 8, 10], [0, 8, 8, 8],
      ];
  stones.forEach(([sx, sy, sw, sh], i) => {
    const r = hash01(v % 4, i, 77);
    const tone = r < 0.3 ? c.light : r > 0.8 ? c.dark : c.base;
    for (let j = 0; j < sh - 1; j++) {
      for (let k = 0; k < sw - 1; k++) {
        let col = tone;
        if (j === 0 || k === 0) col = mix(tone, c.light, 0.5);
        if (j === sh - 2) col = mix(tone, c.dark, 0.7);
        if (hash01(i, k, j, v) < 0.05) col = c.dark;
        p.set(sx + k, sy + j, col);
      }
    }
  });
  const kind = v % 12;
  if (kind === 4 || kind === 9) {
    // a crack
    let x = 3 + (v % 5);
    for (let y = 2; y < 12; y++) {
      p.set(x, y, c.mortar);
      if (hash01(v, y) < 0.4) x += hash01(v, y, 1) < 0.5 ? -1 : 1;
      if (y === 6) p.set(x + 1, y, c.mortar);
    }
  }
  if (kind === 5 || kind === 10) {
    // a little moss growing out of the mortar in one corner
    const [mx, my] = kind === 10 ? [8, 8] : [0, 0];
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const d = Math.hypot(x - mx, y - my) + hash01(x, y, v) * 2;
        const onMortar = p.hexAt(x, y) === c.mortar;
        if (d < 2.2 || (onMortar && d < 4)) p.set(x, y, DUNGEON.moss[1]);
        else if (d < 3.2 && hash01(x, y, 3) < 0.5) p.set(x, y, DUNGEON.moss[0]);
        if (d < 1) p.set(x, y, DUNGEON.moss[2]);
      }
    }
  }
  if (kind === 6) {
    // pebbles
    p.set(4, 11, c.light);
    p.set(5, 11, c.light);
    p.set(4, 12, c.mortar);
    p.set(11, 4, c.light);
    p.set(11, 5, c.mortar);
  }
  if (kind === 7) {
    // a faint rune scratched into the stone
    for (const [x, y] of [[6, 5], [7, 4], [8, 5], [7, 6], [7, 7], [6, 8], [8, 8]]) p.set(x, y, mix(c.light, "#c9b6ff", 0.35));
  }
  return p;
}

function dungeonWallTop(mask: number, v: number): Pix {
  const c = DUNGEON.wallTop;
  const p = new Pix(T, T);
  p.rect(0, 0, T, T, c.base);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (hash01(x, y, v + 40) < 0.08) p.set(x, y, c.light);
  // light rim on every side that borders walkable floor (lit from inside the room)
  if (!(mask & N)) {
    p.hline(0, T - 1, 0, c.rim);
    p.hline(0, T - 1, 1, c.rimDark);
  }
  if (!(mask & S)) {
    p.hline(0, T - 1, T - 1, c.rim);
    p.hline(0, T - 1, T - 2, c.rimDark);
  }
  if (!(mask & W)) {
    p.vline(0, 0, T - 1, c.rim);
    p.vline(1, 0, T - 1, c.rimDark);
  }
  if (!(mask & E)) {
    p.vline(T - 1, 0, T - 1, c.rim);
    p.vline(T - 2, 0, T - 1, c.rimDark);
  }
  return p;
}

function dungeonWallFace(v: number): Pix {
  const c = DUNGEON.wallFace;
  const p = new Pix(T, T);
  p.rect(0, 0, T, T, c.mortar);
  for (let row = 0; row < 4; row++) {
    const y0 = row * 4;
    const off = row % 2 ? 4 : 0;
    for (let b = -1; b < 3; b++) {
      const x0 = b * 8 + off;
      const r = hash01(row, b, v);
      const tone = r < 0.25 ? c.light : r > 0.8 ? c.dark : c.base;
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 7; k++) {
          const x = x0 + k;
          if (x < 0 || x >= T) continue;
          let col = tone;
          if (j === 0) col = mix(tone, c.light, 0.6);
          if (j === 2) col = mix(tone, c.dark, 0.6);
          p.set(x, y0 + j, col);
        }
      }
    }
  }
  // the top course catches torch light; the bottom fades into shadow at the floor
  p.hline(0, T - 1, 0, mix(c.light, "#ffe0b0", 0.25));
  p.hline(0, T - 1, T - 1, c.shadow);
  for (let x = 0; x < T; x++) if ((x + v) % 2 === 0) p.set(x, T - 2, mix(c.dark, c.shadow, 0.5));
  if (v % 4 === 1) {
    // moss dripping from a mortar line
    for (const [x, y] of [[3, 4], [4, 4], [5, 4], [4, 5], [4, 6], [10, 8], [11, 8], [11, 9]]) p.set(x, y, DUNGEON.moss[(x + y) % 2]);
  }
  if (v % 4 === 2) {
    // a crack
    for (const [x, y] of [[9, 1], [10, 2], [10, 3], [11, 5], [11, 6], [12, 7]]) p.set(x, y, c.mortar);
  }
  return p;
}

function dungeonExit(frame: number): Pix {
  const p = dungeonFloor(0, false);
  const [glowHi, glow, glowLo, frameC] = DUNGEON.exit;
  // a glowing archway of light with three steps leading up and out
  p.rect(2, 1, 12, 15, frameC);
  p.rect(3, 2, 10, 13, glowLo);
  p.rect(3, 2, 10, 2, glowHi);
  p.rect(3, 4, 10, 1, glow);
  p.rect(3, 6, 10, 3, glow);
  p.hline(3, 12, 6, glowHi);
  p.rect(3, 10, 10, 4, glowLo);
  p.hline(3, 12, 10, glow);
  p.hline(3, 12, 14, shade(glowLo, 0.15));
  p.hline(2, 13, 15, shade(frameC, 0.15));
  for (const [x, y] of [[2, 1], [13, 1]]) p.set(x, y, DUNGEON.floor.mortar);
  // motes of light drifting upwards
  const motes = [
    [5, 12],
    [10, 9],
    [7, 6],
  ];
  motes.forEach(([x, y], i) => {
    const yy = y - ((frame + i) % 4) * 2;
    if (yy > 1) p.set(x, yy, "#ffffff");
  });
  return p;
}

// ──────────────────────────── entry ────────────────────────────

/** Paints one ground tile. `variant` and `frame` should already be reduced with groundVariants/groundFrames. */
export function paintGround(pal: ThemePalette, id: GroundId, mask: number, variant: number, frame: number): Pix {
  switch (id) {
    case Ground.Grass:
      return grassTile(pal, variant);
    case Ground.Meadow:
      return meadowTile(pal, variant);
    case Ground.Path:
      return pathTile(pal, mask, variant);
    case Ground.Plaza:
      return plazaTile(pal, mask, variant);
    case Ground.Water:
      return waterTile(pal, mask, variant, frame);
    case Ground.Sand:
      return sandTile(pal, mask, variant);
    case Ground.Bridge:
      return bridgeTile(pal, mask);
    case Ground.DungeonFloor:
      return dungeonFloor(variant, false);
    case Ground.DungeonFloorAlt:
      return dungeonFloor(variant, true);
    case Ground.DungeonWall:
      return dungeonWallTop(mask, variant);
    case Ground.DungeonWallFace:
      return dungeonWallFace(variant);
    case Ground.DungeonVoid: {
      const p = new Pix(T, T);
      p.rect(0, 0, T, T, DUNGEON.void);
      return p;
    }
    case Ground.DungeonExit:
      return dungeonExit(frame);
    default:
      return grassTile(pal, 0);
  }
}

/** Whether the mask matters for this ground (others share one cached tile for all masks). */
export function usesMask(id: GroundId): boolean {
  return id === Ground.Path || id === Ground.Plaza || id === Ground.Water || id === Ground.Sand || id === Ground.Bridge || id === Ground.DungeonWall;
}
