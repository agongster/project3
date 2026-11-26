/**
 * Boss monsters (32×32): Key Thief, Eval Serpent, Glitch King.
 *
 * Bosses are big enough that each is assembled from parts: soft lit
 * volumes (`litBlobs`, the same shading the trees use) for bodies, small
 * hand-drawn grids for faces, and a few lines of code for the animated bits
 * (jangling keys, flicking tongue, glitching rows). All face RIGHT.
 *
 * A boss's LOOK (src/lib/game/monsterLooks.ts) only picks its colour family
 * (monstersPalettes.ts): the hood, the scales, the king's screen. Bosses
 * have no feature variants or markings: they are rare and drawn as a set.
 */
import type { MonsterLook } from "@/lib/game/monsterLooks";
import { INK, withAlpha } from "./color";
import { Pix } from "./engine";
import { KING_FAMILIES, SERPENT_FAMILIES, THIEF_HOODS, type SerpentTones } from "./monstersPalettes";
import { litBlobs } from "./shapes";
import { BASE_PAL, outlined } from "./uiKit";

/** Tones are listed dark → light, as `litBlobs` expects. */
const FUR = ["#4a4260", "#77708c", "#9e97b0", "#cfc9dc"];
const GOLD = { hi: "#fff4b0", base: "#ffd34d", lo: "#d99a2b", line: "#8a5a1e" };

// ───────────────────────────── Key Thief ─────────────────────────────

/** Raccoon face inside the hood. m = mask, e = eye, W = white fur, n = nose, F/f = fur. */
const THIEF_FACE = [
  "..ffffffff..",
  ".fWWffffWWf.",
  "fmmmmffmmmmf",
  "mwekmmmmwekm",
  "meekmmmmeekm",
  "fmmmfFFfmmmf",
  ".fWWWWWWWWnn",
  "..WWWWkWWWn.",
  "...WWWWWWW..",
];
const THIEF_PAL = { ...BASE_PAL, f: FUR[3], F: FUR[2], m: "#3d3450", e: "#fff3b0", W: "#f6f2fa", n: INK };

/** Ears poking out through holes in the hood. */
const THIEF_EAR = ["F.", "Fp", "FF"];

/** A key: a round bow with a hole, a shaft, two teeth. y = gold, Y = shine. */
const KEY = [".y.", "yYy", ".y.", ".y.", ".yy", ".y.", ".yy"];
/** The key ring the thief jangles. */
const RING = [".yyy.", "y...y", "y...y", ".yyy."];

/**
 * The ringed tail: a chain of discs that rises behind the body in an S
 * curve, banded light / dark like a raccoon's, with a lit upper edge.
 */
function thiefTail(p: Pix, sway: number): void {
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = 9 - Math.sin(t * Math.PI * 0.9) * 6 + sway * t * t;
    const y = 27 - t * 17;
    const r = 3.6 - t * 1.4;
    const dark = Math.floor(i / 3) % 2 === 1;
    p.ellipse(x, y, r, r, dark ? "#3d3450" : FUR[2]);
    p.set(Math.round(x - r + 1), Math.round(y - 1), dark ? "#564c6e" : FUR[3]);
  }
}

/** 4 frames: the key ring jangles (keys swing) and the tail sways. */
export function keyThief(frame: number, _disguised: boolean, look: MonsterLook): Pix {
  const hood = [...THIEF_HOODS[look.family]];
  const f = frame % 4;
  const bob = f === 1 || f === 2 ? 1 : 0;
  const p = new Pix(32, 32);
  thiefTail(p, [0, -1, 0, 1][f]);
  // feet, cloak body, hood
  p.ellipse(12, 29, 2, 1, "#3d3450");
  p.ellipse(18, 29, 2, 1, "#3d3450");
  litBlobs(p, [{ x: 15, y: 22 + bob, rx: 7, ry: 6.5 }], hood, { dither: 0.4 });
  // fur belly showing where the cloak parts at the front
  for (let y = 19; y <= 27; y++) for (let x = 19; x <= 21; x++) if (p.has(x, y + bob) && x - 19 <= (y - 19) / 3) p.set(x, y + bob, y % 3 ? FUR[3] : FUR[2]);
  litBlobs(p, [{ x: 9, y: 6 + bob, rx: 3, ry: 3 }, { x: 15, y: 11 + bob, rx: 9, ry: 7.5 }], hood, { dither: 0.4 });
  // ears, face
  p.stamp(THIEF_EAR, { F: FUR[2], p: "#ff9ec4" }, 13, 1 + bob);
  p.stamp(THIEF_EAR, { F: FUR[2], p: "#ff9ec4" }, 19, 2 + bob);
  p.stamp(THIEF_FACE, THIEF_PAL, 13, 7 + bob);
  // arm reaching forward, paw up, holding the ring
  p.hline(20, 23, 18 + bob, hood[2]);
  p.hline(20, 23, 19 + bob, hood[1]);
  p.ellipse(24.5, 18.5 + bob, 1, 1, FUR[2]);
  p.outline(INK);
  // the ring hangs from the paw; two keys dangle from it and swing
  const gold = { y: GOLD.base, Y: GOLD.hi };
  const ring = outlined(RING, gold, { line: GOLD.line });
  p.paste(ring, 23, 19 + bob);
  const swing = [0, 1, 0, -1][f];
  p.paste(outlined(KEY, gold, { line: GOLD.line }), 22 - swing, 22 + bob);
  p.paste(outlined(KEY, gold, { line: GOLD.line }), 26 + swing, 23 + bob);
  // a glint that jumps between the keys
  p.set(f % 2 ? 27 + swing : 23 - swing, 24 + bob, "#ffffff");
  return p;
}

// ───────────────────────────── Eval Serpent ─────────────────────────────

/** The code-glyph markings: "(" ")" "{" "}" as tiny pixel patterns. */
const GLYPHS: Record<string, [number, number][]> = {
  "(": [[1, 0], [0, 1], [0, 2], [1, 3]],
  ")": [[0, 0], [1, 1], [1, 2], [0, 3]],
  "{": [[1, 0], [0, 1], [-1, 2], [0, 3], [1, 4]],
  "}": [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]],
};

/** One coil of the serpent's body: an ellipse shaded like a tube (lit top, dark underside) with scale texture. */
function coil(p: Pix, cx: number, cy: number, rx: number, ry: number, scales: SerpentTones["scales"]): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / (rx + 0.5);
      const ny = (y - cy) / (ry + 0.5);
      if (nx * nx + ny * ny > 1) continue;
      const v = (y - (cy - ry)) / (2 * ry); // 0 top … 1 bottom
      let k = Math.max(0, Math.min(3, Math.floor((1 - v) * 3.6 - nx * 0.6)));
      if (k > 0 && k < 3 && (x + 2 * y) % 4 === 0) k--; // diamond scale texture
      p.set(x, y, scales[k]);
    }
  }
  // a dark crease along the bottom separates it from the coil below
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x - cx) / (rx + 0.5);
    if (Math.abs(nx) >= 1) continue;
    const y = Math.round(cy + (ry + 0.5) * Math.sqrt(1 - nx * nx) - 0.3);
    p.set(x, y, INK);
  }
}

function glyph(p: Pix, ch: string, x: number, y: number, color: string): void {
  for (const [dx, dy] of GLYPHS[ch]) p.set(x + dx, y + dy, color);
}

/** 4 frames: tongue flicks in and out, the head bobs, the glyphs pulse. */
export function evalSerpent(frame: number, _disguised: boolean, look: MonsterLook): Pix {
  const { scales, belly, glyph: glyphTones, eye } = SERPENT_FAMILIES[look.family];
  const f = frame % 4;
  const bob = f === 1 || f === 2 ? 1 : 0;
  const p = new Pix(32, 32);
  // tail tip curling out behind
  for (let i = 0; i < 6; i++) p.ellipse(5 - i * 0.6, 28 - i * 0.7, 1.6 - i * 0.2, 1.4 - i * 0.2, scales[1 + (i % 2)]);
  // a short S-curved neck rising from the top coil (drawn first so the coils overlap its base)
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const x = 18 + Math.sin(t * Math.PI) * 2.5 + t * 1.5;
    const y = 17 - t * 7 + bob * t;
    p.ellipse(x, y, 2.8, 2.3, scales[2]);
    p.set(Math.round(x - 2), Math.round(y), scales[3]);
    // belly scutes on the front of the neck
    p.set(Math.round(x + 2), Math.round(y), belly[i % 2]);
    p.set(Math.round(x + 2), Math.round(y + 1), belly[0]);
  }
  coil(p, 15.5, 26.5, 12, 3.8, scales);
  coil(p, 14.5, 22, 10, 3.5, scales);
  coil(p, 14, 17.5, 7.5, 3, scales);
  // the head: a big round chibi head with a blunt snout pointing right
  const hy = 7 + bob;
  litBlobs(p, [{ x: 21, y: hy, rx: 5, ry: 4 }, { x: 25.5, y: hy + 1, rx: 3, ry: 2.5 }], [...scales], { dither: 0.3 });
  p.hline(20, 27, hy + 3, scales[1]); // jaw line
  p.set(28, hy, INK); // nostril
  // forked tongue
  if (f === 0 || f === 2) {
    const len = f === 2 ? 3 : 2;
    p.hline(29, 28 + len, hy + 2, "#ff5a8a");
    p.set(29 + len, hy + 1, "#ff5a8a");
    p.set(29 + len, hy + 3, "#ff5a8a");
  }
  p.outline(INK);
  // glowing eye: a soft halo, a bright eye with a slit pupil and a shine
  for (const [dx, dy] of [[-1, 0], [-1, 1], [3, 0], [3, 1], [0, -1], [1, -1], [2, -1], [0, 2], [1, 2], [2, 2]]) p.blend(22 + dx, hy - 2 + dy, withAlpha(eye, 0.45));
  p.rect(22, hy - 2, 3, 2, eye);
  p.set(23, hy - 2, INK);
  p.set(23, hy - 1, INK);
  p.set(22, hy - 2, "#ffffff");
  // code glyphs on the coils, pulsing between two brightnesses
  const g = glyphTones[f % 2];
  const g2 = glyphTones[(f + 1) % 2];
  glyph(p, "(", 6, 24, g);
  glyph(p, ")", 10, 24, g);
  glyph(p, "{", 18, 23, g);
  glyph(p, "}", 22, 23, g);
  glyph(p, "(", 10, 19, g2);
  glyph(p, ")", 14, 19, g2);
  return p;
}

// ───────────────────────────── Glitch King ─────────────────────────────

/** The king's blocky body. b/B/s/d = body ramp, x = face screen, e = eye, z = zigzag mouth, c/C = missing-texture checker. */
const KING = [
  "......................",
  "..hhhhhhhhhhhhhhhhhh..",
  ".hhbbbbbbbbbbbbbbbbbs.",
  ".hbxxxxxxxxxxxxxxxxbs.",
  ".hbxeeexxxxxxeeexxxbs.",
  ".hbxeekxxxxxxeekxxxbs.",
  ".hbxeekxxxxxxeekxxxbs.",
  ".hbxxxxxxxxxxxxxxxxbs.",
  ".hbxxzxxzxxzxxzxxxxbs.",
  ".hbxxxzxxzxxzxxzxxxbs.",
  ".hbxxxxxxxxxxxxxxxxbs.",
  ".hbbbbbbbbbbbbbbbbbbs.",
  ".hbccCCbbbbbbbbbbbbbs.",
  ".hbccCCbbbbbbbbbbbbss.",
  ".hbCCccbbbbbbbbbbbsss.",
  ".sbCCccbbbbbbbbbbssss.",
  "..ssssssssssssssssss..",
];

/** The crown: g/G gold, j/J/q jewels in red, green and blue (the RGB of a glitch). */
const CROWN = [
  "g....g....g",
  "gg..gGg..gg",
  "gGggGGGggGg",
  "gjgGqGgGJgg",
  "GGGGGGGGGGG",
];
const CROWN_PAL = { g: GOLD.base, G: GOLD.lo, j: "#ff4a6a", J: "#4aff8a", q: "#4ac0ff" };

/** Rows to displace per frame: [first row, last row, shift in px]. */
const GLITCH_ROWS: [number, number, number][][] = [
  [[13, 14, 2], [24, 24, -1]],
  [[19, 21, -2]],
  [[9, 10, 1], [26, 27, 2]],
  [[16, 16, 3], [22, 23, -1]],
];

/** Stray glitch pixels per frame: [x, y, w, h, colour index]. */
const GLITCH_BITS: [number, number, number, number, number][][] = [
  [[2, 6, 2, 1, 0], [28, 14, 1, 2, 1], [26, 3, 2, 2, 2]],
  [[3, 20, 1, 1, 1], [29, 8, 2, 1, 0], [1, 11, 2, 2, 2]],
  [[27, 22, 2, 1, 2], [2, 26, 1, 2, 0], [29, 2, 1, 1, 1]],
  [[1, 4, 1, 2, 2], [28, 18, 2, 2, 0], [4, 14, 2, 1, 1]],
];
const GLITCH_COLORS = ["#ff3a6a", "#3ae8ff", "#7dff6a"];

/** Shifts the pixels of rows y0..y1 horizontally by dx (wrapping nothing: pixels pushed off the edge vanish). */
function shiftRows(p: Pix, y0: number, y1: number, dx: number): void {
  for (let y = y0; y <= y1; y++) {
    const row = p.data.slice(y * p.w * 4, (y + 1) * p.w * 4);
    p.data.fill(0, y * p.w * 4, (y + 1) * p.w * 4);
    for (let x = 0; x < p.w; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= p.w) continue;
      p.data.set(row.subarray(x * 4, x * 4 + 4), (y * p.w + tx) * 4);
    }
  }
}

/** A tinted copy of a picture's silhouette (for the red / cyan colour-split ghosts). */
function tinted(src: Pix, color: string): Pix {
  const out = new Pix(src.w, src.h);
  src.forEach((x, y) => out.set(x, y, color));
  return out;
}

/** 4 frames: different rows slip sideways, the colour split jitters, stray pixels pop. */
export function glitchKing(frame: number, _disguised: boolean, look: MonsterLook): Pix {
  const f = frame % 4;
  // the king himself: body, stubby arms and legs, crown — outlined as one piece
  const king = new Pix(32, 32);
  const pal = { ...BASE_PAL, ...KING_FAMILIES[look.family] };
  king.rect(4, 17, 3, 4, pal.s); // arms
  king.rect(25, 16 + (f % 2), 3, 4, pal.b);
  king.rect(9, 27, 4, 3, pal.s); // legs
  king.rect(19, 27, 4, 3, pal.s);
  king.stamp(KING, pal, 5, 10);
  king.stamp(CROWN, { ...pal, ...CROWN_PAL }, 10 + (f === 2 ? 1 : 0), 6);
  king.outline(INK);
  // colour-split ghosts: red pulled left, cyan pushed right
  const split = f === 1 ? 2 : 1;
  const out = new Pix(32, 32);
  out.paste(tinted(king, withAlpha("#ff3a6a", 0.75)), -split, 0);
  out.paste(tinted(king, withAlpha("#3ae8ff", 0.75)), split, 0);
  out.paste(king, 0, 0);
  for (const [y0, y1, dx] of GLITCH_ROWS[f]) shiftRows(out, y0, y1, dx);
  for (const [x, y, w, h, c] of GLITCH_BITS[f]) out.rect(x, y, w, h, GLITCH_COLORS[c]);
  return out;
}
