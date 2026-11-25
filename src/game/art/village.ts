/**
 * Village props: lamp, fence, bench, lantern, sign, and the interactive
 * landmarks (Wishing Well, wardrobe tent, notice board, fountain).
 *
 * Mostly string grids (see engine.ts for the format). Wood and stone
 * colours come from the theme palette, so a bench is warm brown in Autumn
 * and bluish at Night; snowy themes get snow caps automatically.
 */
import { light, mix, ramp, shade } from "./color";
import { hash01, Pix } from "./engine";
import { SHADOW, SNOW, type PropArt } from "./nature";
import { dropShadow, snowCap } from "./shapes";
import type { ThemePalette } from "./themes";

/** Wood palette keys used by the grids below: h = highlight, b = base, B = shade, d = dark. */
function woodPal(pal: ThemePalette) {
  const r = ramp(pal.wood);
  return { h: r.hi, b: r.base, B: r.lo, d: r.lo2, line: r.line };
}

/** Puts a source picture at the bottom-centre of a w×h canvas, adds a shadow, returns PropArt. */
function place(src: Pix, w: number, h: number, shadowRx = 0): PropArt {
  const p = new Pix(w, h);
  p.paste(src, Math.floor((w - src.w) / 2), h - src.h - 1);
  if (shadowRx) dropShadow(p, Math.floor(w / 2) - 0.5, h - 2, shadowRx, 1.5, SHADOW);
  return { pix: p, ax: Math.floor(w / 2), ay: h };
}

// ───────────────────────────── lamp ─────────────────────────────

const LAMP = [
  "...k....",
  "..hkk...",
  ".hkkkk..",
  "hkkkkkkk",
  ".gGGGGg.",
  ".gGwwGg.",
  ".gGwwGg.",
  ".gGGGGg.",
  "kkkkkkkk",
  "..kkkk..",
  "...hk...",
  "...hk...",
  "...hk...",
  "...hk...",
  "...hk...",
  "...hk...",
  "...hk...",
  "...hk...",
  "...hk...",
  "..hkkk..",
  ".hkkkkk.",
];

/** Street lamp. Lit (with 4 flicker frames) in the night theme. */
export function lampArt(pal: ThemePalette, frame: number): PropArt {
  const lit = pal.lit;
  const flick = [0, 1, 0, 2][frame % 4];
  const glass = lit ? { g: "#ffc95a", G: flick === 1 ? "#ffe7a0" : "#fff0b8", w: "#ffffff" } : { g: "#a9cbd9", G: "#d6ebf2", w: "#fff1c8" };
  const iron = pal.id === "beach" ? "#f4f0e8" : pal.id === "sakura" ? "#5a4a6a" : "#403c58";
  const src = Pix.fromGrid(LAMP, { k: iron, h: light(iron, 0.15), ...glass });
  src.outline(pal.id === "beach" ? "#7a6a6a" : "#221a30");
  if (pal.snowy) snowCap(src, SNOW, 1, 3, 4);
  return place(src, 12, 26, 3);
}

// ───────────────────────────── fence ─────────────────────────────

const FENCE_H = [
  "................",
  ".......hb.......",
  "......hbbB......",
  "hhhhhhhbbBhhhhhh",
  "bbbbbbbbbBbbbbbb",
  "BBBBBBhbbBBBBBBB",
  "......hbbB......",
  "hhhhhhhbbBhhhhhh",
  "bbbbbbbbbBbbbbbb",
  "BBBBBBhbbBBBBBBB",
  "......hbbB......",
  "......hbbB......",
];

const FENCE_V = [
  "......hbB.......",
  "......hbB.......",
  "......hbB.......",
  "......hbB.......",
  ".....hhbbB......",
  ".....hbbbB......",
  ".....hbbbB......",
  ".....hbbbB......",
  ".....hbbbB......",
  ".....dBBBd......",
  "......hbB.......",
  "......hbB.......",
  "......hbB.......",
  "......hbB.......",
  "......hbB.......",
  "......hbB.......",
];

const FENCE_POST = ["......hb.......", ".....hbbB......", ".....hbbB......", ".....hbbB......", ".....hbbB......", ".....hbbB......", ".....hbbB......", ".....hbbB......", ".....hbbB......"];

/**
 * Fence pieces. variant % 3: 0 = horizontal run (connects left/right),
 * 1 = vertical run (connects up/down), 2 = lone post.
 */
export function fenceArt(pal: ThemePalette, v: number): PropArt {
  const w = woodPal(pal);
  const grid = [FENCE_H, FENCE_V, FENCE_POST][v % 3];
  const src = Pix.fromGrid(grid, w);
  src.outline(w.line);
  if (pal.snowy) snowCap(src, SNOW, 1, v);
  const p = new Pix(16, 16);
  p.paste(src, 0, 16 - src.h - (v % 3 === 1 ? 0 : 1));
  return { pix: p, ax: 8, ay: 16 };
}

// ───────────────────────────── bench ─────────────────────────────

const BENCH = [
  "hhhhhhhhhhhhhh",
  "bbbbbbbbbbbbbb",
  "BBBBBBBBBBBBBB",
  ".k..........k.",
  "hhhhhhhhhhhhhh",
  "bbbbbbbbbbbbbb",
  "dddddddddddddd",
  ".k..........k.",
  ".k..........k.",
];

export function benchArt(pal: ThemePalette): PropArt {
  const w = woodPal(pal);
  const src = Pix.fromGrid(BENCH, { ...w, k: "#3d3a52" });
  src.outline(w.line);
  if (pal.snowy) snowCap(src, SNOW, 1, 5);
  return place(src, 16, 14, 7);
}

// ──────────────────────────── lantern ────────────────────────────

const LANTERN = [
  "..hbbbbb.",
  "..hb...k.",
  "..hb..rRr",
  "..hb.rLLLr",
  "..hb.rLWLr",
  "..hb.rLLLr",
  "..hb..rRr",
  "..hb...t.",
  "..hb.....",
  "..hb.....",
  "..hb.....",
  "..hb.....",
  ".hbbB....",
];

/** A paper lantern on a hook post (marks an empty __init__.py). 2 flicker frames. */
export function lanternArt(pal: ThemePalette, frame: number): PropArt {
  const w = woodPal(pal);
  const paper = pal.lit ? "#ffb04a" : "#ff8a6a";
  const src = Pix.fromGrid(LANTERN, {
    ...w,
    k: "#3d3a52",
    r: shade(paper, 0.25),
    R: shade(paper, 0.15),
    L: frame % 2 ? light(paper, 0.08) : paper,
    W: pal.lit ? "#fff6c8" : "#ffd36b",
    t: "#ffd36b",
  });
  src.outline(w.line);
  if (pal.snowy) snowCap(src, SNOW, 1, 2, 3);
  return place(src, 14, 18, 3);
}

// ───────────────────────────── sign ─────────────────────────────

const SIGN = [
  "hhhhhhhhhhh...",
  "hbbbbbbbbbbb..",
  "hbtttbttttbbb.",
  "hbbbbbbbbbbbbb",
  "hbtttttbttbbb.",
  "BBBBBBBBBBBB..",
  ".....hB.......",
  ".....hB.......",
  ".....hB.......",
  ".....hB.......",
  "....hbBB......",
];

export function signArt(pal: ThemePalette): PropArt {
  const w = woodPal(pal);
  const src = Pix.fromGrid(SIGN, { ...w, t: shade(pal.wood, 0.35) });
  src.outline(w.line);
  if (pal.snowy) snowCap(src, SNOW, 1, 9, 3);
  return place(src, 16, 14, 4);
}

// ────────────────────────── wishing well ──────────────────────────

/** The Wishing Well (gacha machine): a magic well with a little roof. 4 sparkle frames. */
export function wellArt(pal: ThemePalette, frame: number): PropArt {
  const W = 30;
  const H = 38;
  const p = new Pix(W, H);
  const wood = woodPal(pal);
  const stone = ramp(pal.stone);
  const roofR = ramp("#8a64d6");
  const gold = ["#fff1a8", "#ffd34d", "#d99a2b"];
  const magic = ["#7ff0ff", "#4fc7f0", "#c79bff", "#ffffff"];

  // stone body: a short cylinder (front face + elliptical rim)
  const cx = 14.5;
  for (let y = 24; y <= 34; y++) {
    for (let x = 3; x <= 26; x++) {
      const bottomRound = y >= 33 && (x < 5 || x > 24);
      if (bottomRound) continue;
      const row = Math.floor((y - 24) / 3);
      const brick = Math.floor((x + (row % 2) * 3) / 6);
      const edgeY = (y - 24) % 3 === 2;
      const edgeX = (x + (row % 2) * 3) % 6 === 5;
      let c = hash01(brick, row) < 0.3 ? stone.hi : stone.base;
      if (edgeY || edgeX) c = stone.lo2;
      if (x <= 4) c = edgeY || edgeX ? stone.lo2 : stone.hi;
      if (x >= 24) c = stone.lo;
      p.set(x, y, c);
    }
  }
  p.ellipse(cx, 23.5, 11.5, 3.5, stone.hi);
  p.ellipse(cx, 23.5, 9.5, 2.5, stone.lo2);
  p.ellipse(cx, 24, 8.5, 1.8, magic[1]);
  p.hline(9, 14, 23, magic[0]);
  p.set(17, 24, magic[3]);
  p.set(11, 25, magic[2]);
  // posts
  for (let y = 8; y <= 23; y++) {
    p.set(4, y, wood.h);
    p.set(5, y, wood.B);
    p.set(24, y, wood.h);
    p.set(25, y, wood.B);
  }
  // crank beam, rope and bucket
  p.hline(4, 25, 12, wood.b);
  p.hline(4, 25, 13, wood.d);
  p.set(26, 12, wood.h);
  p.set(27, 12, wood.d);
  p.set(27, 13, wood.d);
  p.vline(14, 14, 16, "#d9c4a0");
  p.rect(12, 17, 5, 3, wood.b);
  p.hline(12, 16, 17, wood.h);
  p.hline(12, 16, 19, wood.d);
  p.set(13, 18, "#7ff0ff");
  p.set(14, 18, "#7ff0ff");
  // a pointed shingle roof with a gold trim
  for (let y = 2; y <= 10; y++) {
    const half = 3 + (y - 2) * 1.45;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const u = (x - cx) / half;
      let c = u < -0.35 ? roofR.hi : u < 0.35 ? roofR.base : roofR.lo;
      if ((y - 2) % 3 === 2 && (x + y) % 2 === 0) c = roofR.lo2;
      p.set(x, y, c);
    }
  }
  p.hline(1, 28, 11, gold[1]);
  p.hline(2, 27, 12, gold[2]);
  // star finial
  for (const [x, y, c] of [[14, 0, 1], [15, 0, 1], [13, 1, 1], [14, 1, 0], [15, 1, 0], [16, 1, 1], [14, 2, 2], [15, 2, 2]] as const) p.set(x, y, gold[c]);
  // a heart emblem on the roof
  for (const [x, y] of [[13, 6], [16, 6], [12, 7], [13, 7], [14, 7], [15, 7], [16, 7], [17, 7], [13, 8], [14, 8], [15, 8], [16, 8], [14, 9], [15, 9]]) p.set(x, y, "#ff7aa8");
  p.set(13, 7, "#ffd0e0");
  if (pal.snowy) snowCap(p, SNOW, 1, 4, 12);
  p.outline("#2b1d34");
  // sparkles twinkling around the well (outside the outline)
  const spots = [
    [2, 18],
    [27, 16],
    [8, 20],
    [21, 20],
    [1, 6],
    [28, 4],
  ];
  spots.forEach(([x, y], i) => {
    const phase = (frame + i) % 4;
    if (phase === 0) p.set(x, y, "#ffffff");
    if (phase === 1) {
      p.set(x, y, magic[0]);
      p.set(x - 1, y, magic[2]);
      p.set(x + 1, y, magic[2]);
      p.set(x, y - 1, magic[2]);
      p.set(x, y + 1, magic[2]);
    }
  });
  dropShadow(p, 14.5, 35.5, 12, 2, SHADOW);
  return { pix: p, ax: 15, ay: H };
}

// ───────────────────────── wardrobe tent ─────────────────────────

/** The dressing tent where the player changes their look. */
export function wardrobeArt(pal: ThemePalette): PropArt {
  const W = 26;
  const H = 32;
  const p = new Pix(W, H);
  const stripeA = "#c9a6f2";
  const stripeB = "#fff4e6";
  const curtain = ramp("#e0679a");
  const pole = ramp(pal.wood);
  const cx = 12.5;
  // canopy: a rounded cone with vertical stripes and a scalloped hem
  for (let y = 3; y <= 12; y++) {
    const half = 2 + (y - 3) * 1.25;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const band = Math.floor(((x - cx) / (half + 0.01)) * 3 + 3.5);
      let c = band % 2 ? stripeA : stripeB;
      if (x - cx > half * 0.45) c = shade(c, 0.1);
      p.set(x, y, c);
    }
  }
  for (let x = 1; x <= 24; x++) {
    const scallop = x % 4 === 0 || x % 4 === 1;
    p.set(x, 13, (Math.floor(x / 4) % 2 ? stripeA : stripeB));
    if (scallop) p.set(x, 14, shade(Math.floor(x / 4) % 2 ? stripeA : stripeB, 0.12));
  }
  // walls + curtains parted in the middle
  for (let y = 14; y <= 29; y++) {
    for (let x = 3; x <= 22; x++) {
      if (y === 14 && (x % 4 === 0 || x % 4 === 1)) continue;
      const left = x < 10;
      const right = x > 15;
      let c: string;
      if (left || right) {
        c = (x + (left ? 0 : 1)) % 3 === 0 ? curtain.lo : curtain.base;
        if (x === 3) c = curtain.hi;
        if (x === 22) c = curtain.lo2;
      } else c = y < 17 ? "#4a2f5a" : "#3a2448"; // the dark inside of the tent
      p.set(x, y, c);
    }
  }
  // curtain tie-backs
  p.set(9, 21, "#ffd34d");
  p.set(16, 21, "#ffd34d");
  // a mirror inside with a shine, and a coat hanger sign above the door
  p.rect(11, 19, 4, 8, "#9fd8f0");
  p.vline(11, 19, 26, "#d8f4ff");
  p.set(13, 20, "#ffffff");
  p.rect(11, 27, 4, 1, "#ffd34d");
  for (const [x, y] of [[12, 15], [13, 14], [12, 16], [11, 17], [14, 16], [15, 17], [10, 17], [13, 17], [12, 17], [14, 17]]) p.set(x, y, "#ffd34d");
  // pennant on top
  p.vline(12, 0, 3, pole.line);
  p.set(13, 0, "#ff7aa8");
  p.set(14, 0, "#ff7aa8");
  p.set(13, 1, "#ff7aa8");
  if (pal.snowy) snowCap(p, SNOW, 1, 6, 13);
  p.outline("#2b1d34");
  dropShadow(p, 12.5, 30, 11, 1.5, SHADOW);
  return { pix: p, ax: 13, ay: H };
}

// ────────────────────────── notice board ──────────────────────────

const BOARD = [
  "....dddddddddddddd....",
  "..ddbbbbbbbbbbbbbbdd..",
  ".dhhhhhhhhhhhhhhhhhhd.",
  "..hcccccccccccccccc...",
  "..hcwwwwcccyyyyycc....",
  "..hcwtttwcccyttycpppc.",
  "..hcwwwwwcccyyyycptpc.",
  "..hcwttwwcwwwcccccpppc",
  "..hcwwwwwcwttwcpppccc.",
  "..hccccccwwwwcpttpcc..",
  "..hcccccccccccppppcc..",
  "..hBBBBBBBBBBBBBBBBB..",
  "...hB..........hB.....",
  "...hB..........hB.....",
  "...hB..........hB.....",
  "...hB..........hB.....",
  "..hbBB........hbBB....",
];

/** Notice board with the repo's stats pinned to it. */
export function boardArt(pal: ThemePalette): PropArt {
  const w = woodPal(pal);
  const src = Pix.fromGrid(BOARD, { ...w, c: "#c99560", w: "#fffaf0", y: "#ffe08a", p: "#ffb3cd", t: "#8a7a8a" });
  src.outline(w.line);
  if (pal.snowy) snowCap(src, SNOW, 1, 8, 3);
  return place(src, 24, 20, 9);
}

// ──────────────────────────── fountain ────────────────────────────

/** Town-square fountain. 3 frames of splashing water. */
export function fountainArt(pal: ThemePalette, frame: number): PropArt {
  const W = 34;
  const H = 32;
  const p = new Pix(W, H);
  const st = ramp(pal.plaza.base === pal.stone ? pal.stone : mix(pal.stone, pal.plaza.base, 0.5));
  const wat = pal.water;
  const cx = 16.5;
  // basin front face
  for (let y = 22; y <= 28; y++) {
    for (let x = 2; x <= 31; x++) {
      const dx = (x - cx) / 15;
      if (y > 26 && Math.abs(dx) > 0.88) continue;
      let c = Math.abs(dx) > 0.75 ? (dx < 0 ? st.hi : st.lo) : st.base;
      if ((y - 22) % 3 === 2 || (x + (Math.floor((y - 22) / 3) % 2) * 2) % 5 === 0) c = st.lo2;
      p.set(x, y, c);
    }
  }
  // rim + water surface
  p.ellipse(cx, 21.5, 15, 4.5, st.hi);
  p.ellipse(cx, 21.5, 13, 3.2, st.lo);
  p.ellipse(cx, 22, 12, 2.6, wat.base);
  // ripples drifting outward
  const ring = frame % 3;
  for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2;
    const rr = 3 + ring * 3;
    const x = Math.round(cx + Math.cos(ang) * rr);
    const y = Math.round(22 + Math.sin(ang) * rr * 0.35);
    if (p.hexAt(x, y) === wat.base) p.set(x, y, wat.light);
  }
  // pillar + upper bowl
  for (let y = 10; y <= 21; y++) {
    p.set(15, y, st.hi);
    p.set(16, y, st.base);
    p.set(17, y, st.base);
    p.set(18, y, st.lo);
  }
  p.ellipse(cx, 10, 6, 2, st.hi);
  p.ellipse(cx, 10.5, 4.5, 1, wat.light);
  p.hline(11, 22, 12, st.lo);
  // the water jet: a column with droplets arcing out (3 frames)
  p.vline(16, 3, 9, wat.light);
  p.vline(17, 4, 9, wat.foam);
  p.set(16, 2, "#ffffff");
  const drops: [number, number][][] = [
    [[13, 4], [20, 5], [10, 8], [23, 9], [8, 14], [25, 15]],
    [[12, 5], [21, 4], [9, 10], [24, 8], [7, 16], [26, 13]],
    [[14, 3], [19, 4], [11, 6], [22, 7], [9, 12], [24, 12]],
  ];
  for (const [x, y] of drops[frame % 3]) {
    p.set(x, y, wat.foam);
    p.set(x, y + 1, wat.light);
  }
  // little falls from the upper bowl
  for (const x of [11, 22]) {
    for (let y = 12; y < 20; y++) if ((y + frame) % 3 !== 0) p.set(x, y, wat.light);
  }
  if (pal.snowy) {
    p.ellipse(cx, 21, 13, 1, "#ffffff");
  }
  p.outline("#2b1d34");
  dropShadow(p, cx, 29.5, 14, 1.5, SHADOW);
  return { pix: p, ax: 17, ay: H };
}
