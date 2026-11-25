/**
 * UI sprites, part 2: effects and particles — shadows, the sword slash,
 * hit sparks, smoke poofs, shock rings, sparkles, dust, cursed miasma,
 * ambient weather particles, trail bits and soft glows.
 *
 * Effects are mostly procedural (circles, arcs, rings) because they are
 * about shape and timing rather than detail; tiny particles are grids.
 */
import { mix, withAlpha } from "./color";
import { bayer, Pix } from "./engine";
import { outlined } from "./uiKit";

// ───────────────────────────── shadows ─────────────────────────────

/** A soft shadow: a dark ellipse with a slightly darker core (banded, not blurred). */
export function shadow(rx: number, ry: number): Pix {
  const w = Math.ceil(rx) * 2 + 1;
  const h = Math.ceil(ry) * 2 + 1;
  const p = new Pix(w, h);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2;
      if (d <= 1) p.set(x, y, withAlpha("#1e1430", d < 0.45 ? 0.42 : 0.3));
    }
  }
  return p;
}

// ───────────────────────────── sparkles & stars ─────────────────────────────

const SPARK = { w: "#ffffff", y: "#fff1a0", Y: "#ffd34d" };
/** A twinkle: grows into a 4-point star, then shrinks to a glint. */
const SPARKLE_FRAMES = [
  [".y.", "ywy", ".y."],
  ["..y..", "..y..", "yywyy", "..y..", "..y.."],
  ["y.y", ".w.", "y.y"],
];

export function sparkle(frame: number): Pix {
  return Pix.fromGrid(SPARKLE_FRAMES[frame % 3], SPARK);
}

// ───────────────────────────── dust & poof ─────────────────────────────

const DUST = { d: "#f4ead8", D: "#cbb9a0" };
/** A footstep puff: small, puffier, breaking up. */
const DUST_FRAMES = [
  [".d.", "dDd", ".D."],
  [".dd.", "ddDd", "dDDD", ".DD."],
  ["d..", "...", "..D"],
];

export function dust(frame: number): Pix {
  return Pix.fromGrid(DUST_FRAMES[frame % 3], DUST);
}

/**
 * A smoke poof (monster defeated): a cluster of round puffs that grows,
 * gets holes, then breaks into wisps. Puffs are lit from the top-left.
 */
export function poof(frame: number): Pix {
  const p = new Pix(18, 18);
  const f = frame % 4;
  const puffs: [number, number, number][][] = [
    [[9, 9, 3]],
    [[9, 9, 4], [5, 8, 2.5], [13, 8, 2.5], [9, 5, 2.5]],
    [[5, 8, 3], [13, 8, 3], [9, 4, 3], [9, 12, 3], [5, 13, 2], [13, 13, 2]],
    [[3, 6, 1.5], [15, 6, 1.5], [9, 2, 1.5], [4, 14, 1.5], [14, 14, 1.5], [9, 15, 1]],
  ];
  for (const [x, y, r] of puffs[f]) {
    p.ellipse(x, y, r, r, "#d9d0ec");
    p.ellipse(x - 0.5, y - 0.5, Math.max(0.5, r - 1), Math.max(0.5, r - 1), "#ffffff");
  }
  if (f === 2) for (const [x, y] of [[9, 8], [8, 9], [10, 9]]) p.erase(x, y); // a hole as it thins out
  p.outline(withAlpha("#7a6e9a", 0.7));
  return p;
}

// ───────────────────────────── combat effects ─────────────────────────────

/**
 * The sword slash (24×24, anchor = centre = the hero): a crescent on the
 * right that sweeps from top to bottom over 3 frames. The leading edge is a
 * bright white rim; behind it a pale-cyan smear fades out (translucent).
 */
export function slash(frame: number): Pix {
  const p = new Pix(24, 24);
  const f = frame % 3;
  const spans: [number, number][] = [
    [-110, 0],
    [-85, 75],
    [0, 105],
  ];
  const [a0, a1] = spans[f];
  const maxThick = [4, 6, 3][f];
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 24; x++) {
      const dx = x - 11.5;
      const dy = y - 11.5;
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (ang < a0 || ang > a1) continue;
      const t = (ang - a0) / (a1 - a0); // 0 at the start of the arc, 1 at its end
      const thick = 0.8 + Math.sin(t * Math.PI) * maxThick;
      const r = Math.hypot(dx, dy);
      const outer = 11.2;
      if (r > outer || r < outer - thick) continue;
      const depth = (outer - r) / thick; // 0 at the rim … 1 deepest
      if (depth < 0.3) p.set(x, y, "#ffffff");
      else if (depth < 0.6) p.set(x, y, withAlpha("#dff8ff", f === 2 ? 0.7 : 0.95));
      else p.set(x, y, withAlpha("#8fe4ff", f === 2 ? 0.35 : 0.6));
    }
  }
  return p;
}

/** Impact spark: a bright 8-point burst, then a broken ring of fragments. */
export function hitSpark(frame: number): Pix {
  const p = new Pix(11, 11);
  if (frame % 2 === 0) {
    for (let i = -4; i <= 4; i++) {
      const c = Math.abs(i) < 2 ? "#ffffff" : "#fff1a0";
      p.set(5 + i, 5, c);
      p.set(5, 5 + i, c);
      if (Math.abs(i) < 3) {
        p.set(5 + i, 5 + i, "#ffd34d");
        p.set(5 + i, 5 - i, "#ffd34d");
      }
    }
    p.set(5, 5, "#ffffff");
  } else {
    for (const [x, y] of [[1, 5], [9, 5], [5, 1], [5, 9], [2, 2], [8, 2], [2, 8], [8, 8]]) p.set(x, y, "#fff1a0");
    for (const [x, y] of [[0, 5], [10, 5], [5, 0], [5, 10]]) p.set(x, y, "#ffffff");
  }
  return p;
}

/** Expanding shock ring (radius 5, 9, 13): a bright line with a soft inner band, fading as it grows. */
export function ring(frame: number): Pix {
  const f = frame % 3;
  const r = 5 + f * 4;
  const size = r * 2 + 3;
  const p = new Pix(size, size);
  const c = (size - 1) / 2;
  const fade = [1, 0.8, 0.55][f];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, (y - c) * 1.25);
      if (Math.abs(d - r) < 0.6) p.set(x, y, withAlpha("#ffffff", fade));
      else if (d < r && d > r - 1.6) p.set(x, y, withAlpha("#bff4ff", fade * 0.8));
      else if (d < r && d > r - 3) p.set(x, y, withAlpha("#7fdcff", fade * 0.35));
    }
  }
  return p;
}

// ───────────────────────────── cursed miasma ─────────────────────────────

/** A purple wisp rising off cursed buildings: a wavy column that thins upwards. */
export function miasma(frame: number): Pix {
  const p = new Pix(9, 14);
  const f = frame % 2;
  for (let y = 0; y < 14; y++) {
    const t = y / 13; // 0 top … 1 bottom
    const cx = 4 + Math.sin(y * 0.7 + f * 2.2) * 1.6 * (1 - t * 0.5);
    const half = 0.4 + t * 1.8;
    for (let x = 0; x < 9; x++) {
      const d = Math.abs(x - cx);
      if (d > half) continue;
      const core = d < half * 0.45;
      const a = (0.35 + t * 0.4) * (core ? 1 : 0.6);
      if (!core && bayer(x, y + f) > 0.6) continue;
      p.set(x, y, withAlpha(core ? "#b07ae8" : "#7a4ab8", a));
    }
  }
  return p;
}

// ───────────────────────────── ambient particles ─────────────────────────────

/** Petals tumbling (4 frames: the petal turns as it falls). */
const PETAL = [
  ["pP", "Pp"],
  [".p.", "pPp"],
  ["pp", ".P"],
  ["p", "P", "p"],
];
const LEAF = [
  [".ll", "lLl", "L.."],
  ["l.l", "lLl", ".L."],
  ["ll.", "lLl", "..L"],
  [".L.", "lLl", "l.l"],
];
const SNOW = [
  [".w.", "wWw", ".w."],
  ["w.w", ".W.", "w.w"],
];
const BUBBLE = [
  [".bb.", "bw.b", "b..b", ".bb."],
  [".bbb.", "bw..b", "b...b", "b...b", ".bbb."],
];

export function ambient(name: "petal" | "leaf" | "snowflake" | "bubble" | "firefly" | "pollen", frame: number): Pix {
  switch (name) {
    case "petal":
      return Pix.fromGrid(PETAL[frame % 4], { p: "#ffc4d4", P: "#ff8fab" });
    case "leaf":
      return Pix.fromGrid(LEAF[frame % 4], { l: "#ffa94d", L: "#d9602a" });
    case "snowflake":
      return Pix.fromGrid(SNOW[frame % 2], { w: "#ffffff", W: "#e6f2ff" });
    case "bubble":
      return Pix.fromGrid(BUBBLE[frame % 2], { b: "#c8f4ffc0", w: "#ffffff" });
    case "firefly": {
      const p = new Pix(3, 3);
      const bright = frame % 2 === 0;
      for (const [x, y] of [[1, 0], [0, 1], [2, 1], [1, 2]]) p.set(x, y, withAlpha("#e8ff7a", bright ? 0.45 : 0.25));
      p.set(1, 1, bright ? "#fbffd0" : "#e8ff7a");
      return p;
    }
    case "pollen": {
      const p = new Pix(2, 2);
      p.set(0, 0, "#fff6a0");
      if (frame % 2 === 0) p.set(1, 1, "#ffe066");
      else p.set(1, 0, "#ffe066");
      return p;
    }
  }
}

// ───────────────────────────── trail bits ─────────────────────────────

/** A music note (Rainbow Road trail). */
const NOTE = ["..ww", "..wW", "..w.", "..w.", "www.", "wWW."];
/** Tumbling binary digits (Bit Stream trail). */
const BIT0 = ["ggg", "g.g", "g.g", "ggg"];
const BIT1 = [".g.", "gg.", ".g.", "ggg"];

export function trailBit(name: "note" | "bit0" | "bit1"): Pix {
  if (name === "note") return outlined(NOTE, { w: "#ffffff", W: "#e0d4ff" }, { line: "#5a4a8a" });
  return outlined(name === "bit0" ? BIT0 : BIT1, { g: "#7cf5a4" }, { line: "#1a5a3a" });
}

// ───────────────────────────── glows ─────────────────────────────

/**
 * A soft radial glow: stepped rings of `color` getting more transparent
 * outward, dithered at the ring edges (pixel-art light, like light.ts).
 */
export function radialGlow(w: number, h: number, color: string, strength = 1): Pix {
  const p = new Pix(w, h);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const rings = [0.85, 0.55, 0.32, 0.14].map((a) => Math.min(1, a * strength));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2));
      if (d > 1) continue;
      const band = d * rings.length + (bayer(x, y) - 0.5) * 0.6;
      const k = Math.max(0, Math.min(rings.length - 1, Math.floor(band)));
      p.set(x, y, withAlpha(mix(color, "#ffffff", [0.7, 0.35, 0.1, 0][k]), rings[k]));
    }
  }
  return p;
}

