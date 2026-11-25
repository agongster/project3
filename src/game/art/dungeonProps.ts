/**
 * Dungeon props: pots, crates, torches, bones, crystals, cobwebs and the
 * plaque that names the file. They use the shared dungeon palette, so they
 * look the same in every scenery theme.
 */
import { light, mix, ramp, shade } from "./color";
import { Pix } from "./engine";
import { SHADOW, type PropArt } from "./nature";
import { dropShadow } from "./shapes";
import { DUNGEON } from "./themes";

const INK = "#241a30";

function place(src: Pix, w: number, h: number, shadowRx = 0): PropArt {
  const p = new Pix(w, h);
  p.paste(src, Math.floor((w - src.w) / 2), h - src.h - 1);
  if (shadowRx) dropShadow(p, Math.floor(w / 2) - 0.5, h - 2, shadowRx, 1.5, SHADOW);
  return { pix: p, ax: Math.floor(w / 2), ay: h };
}

const POTS = [
  [
    "...rrrrrr...",
    "..RhhhhhhR..",
    "...cccccc...",
    "..chcccccC..",
    ".chccccccCC.",
    ".chggggggCC.",
    ".chcgcgcgCC.",
    ".chccccccCC.",
    "..cccccccC..",
    "...CCCCCC...",
  ],
  [
    "....rrrr....",
    "...RhhhhR...",
    "....cccc....",
    "...chcccC...",
    "..chcccccC..",
    "..chgggggC..",
    "..chcccccC..",
    "..chcgcgcC..",
    "..chcccccC..",
    "...cccccC...",
    "....CCCC....",
  ],
];

/** Breakable clay pot. Variants: 0 round, 1 tall; even/odd tint. */
export function potArt(v: number): PropArt {
  const clay = v % 4 < 2 ? "#c47a5e" : "#8f6fb0";
  const r = ramp(clay);
  const src = Pix.fromGrid(POTS[v % 2], { c: r.base, C: r.lo, h: r.hi, r: r.lo2, R: r.lo, g: "#ffd36b" });
  src.outline(INK);
  return place(src, 16, 15, 5);
}

const CRATE = [
  "hhhhhhhhhhhh",
  "hbbbbbbbbbbB",
  "hbBbbbbbbdbB",
  "hbbdbbbbdbbB",
  "hbbbdbbdbbbB",
  "hhhhhdddhhhh",
  "hbbbbddbbbbB",
  "hbbbdbbdbbbB",
  "hbbdbbbbdbbB",
  "hbdbbbbbbdbB",
  "hbbbbbbbbbbB",
  "BBBBBBBBBBBB",
];

export function crateArt(): PropArt {
  const r = ramp(DUNGEON.wood);
  const src = Pix.fromGrid(CRATE, { h: r.hi, b: r.base, B: r.lo, d: r.lo2 });
  // metal corner caps
  for (const [x, y] of [[0, 0], [11, 0], [0, 11], [11, 11]]) src.set(x, y, "#8c84a2");
  src.outline(INK);
  return place(src, 16, 15, 6);
}

/** Flame shapes for the 4 torch frames (drawn above the bowl). */
const FLAMES = [
  ["..a...", ".aba..", ".abba.", "abccba", "abccba", ".bccb."],
  ["...a..", "..aba.", ".abba.", ".bcba.", "abccba", ".bccb."],
  [".a....", ".aba..", "aabba.", "abccb.", "abccba", ".bccb."],
  ["...a..", "..ab..", ".abba.", "abcbba", "abccba", ".bccb."],
];

/**
 * Torches with a 4-frame flame. variant % 2: 0 = standing brazier torch
 * (stands on a floor tile), 1 = wall sconce (place it on a wall-face tile).
 */
export function torchArt(v: number, frame: number): PropArt {
  const [hot, mid, warm, deep] = DUNGEON.flame;
  const flame = Pix.fromGrid(FLAMES[frame % 4], { a: deep, b: warm, c: mid });
  flame.set(2, 4, hot);
  flame.set(3, 4, hot);
  const p = new Pix(12, v % 2 ? 16 : 24);
  if (v % 2 === 0) {
    // iron stand
    const iron = ["#4a4262", "#5f5680", "#2f2840"];
    p.rect(4, 8, 4, 2, iron[1]);
    p.rect(3, 7, 6, 1, iron[0]);
    for (let y = 10; y <= 20; y++) {
      p.set(5, y, iron[1]);
      p.set(6, y, iron[2]);
    }
    p.hline(3, 8, 21, iron[0]);
    p.hline(4, 7, 22, iron[2]);
    p.outline(INK);
    p.paste(flame, 3, 1);
    dropShadow(p, 5.5, 22.5, 4, 1, SHADOW);
    return { pix: p, ax: 6, ay: 24 };
  }
  // wall sconce: a bracket with a wooden torch handle
  const wood = ramp(DUNGEON.wood);
  p.rect(5, 7, 2, 6, wood.base);
  p.vline(5, 7, 12, wood.hi);
  p.rect(4, 6, 4, 2, "#5f5680");
  p.rect(3, 11, 6, 2, "#4a4262");
  p.rect(5, 13, 2, 2, "#4a4262");
  p.outline(INK);
  p.paste(flame, 3, 0);
  return { pix: p, ax: 6, ay: 16 };
}

const BONES = [
  "........sss.....",
  ".......swwws....",
  ".......wewew....",
  ".bb....wwwws....",
  "bwwbb..swsw.....",
  ".bwwwwbb......b.",
  "..b.bwwwb...bwwb",
  "......b...bwwwb.",
  ".........bwwb...",
  "........bwwb....",
];

export function bonesArt(v: number): PropArt {
  const src = Pix.fromGrid(BONES, { w: "#f1e6d2", s: "#cfc0a8", b: "#b7a68e", e: "#3a2a44" });
  src.outline(INK);
  const p = new Pix(18, 13);
  p.paste(v % 2 ? src.flippedX() : src, 0, 1);
  return { pix: p, ax: 9, ay: 13 };
}

const CRYSTAL = [
  "......a.......",
  ".....aAb......",
  ".....aAb......",
  "..a..aAbb.....",
  ".aAb.aAbb..a..",
  ".aAb.aAAb.aAb.",
  ".aAbbaAAbbaAb.",
  ".aAAbaAAbbaAbb",
  "..aAbaAAbbaAb.",
  "..aAbbaAbbAbb.",
  "...cccccccccc.",
  "..cccccccccccc",
];

/** Glowing crystal cluster. Variant picks the colour; 3 shimmer frames. */
export function crystalArt(v: number, frame: number): PropArt {
  const hues = [
    ["#c79bff", "#f1e2ff", "#8a5ad8"],
    ["#6ff0e0", "#e2fff8", "#2fa8b8"],
    ["#ff9ad0", "#ffe6f4", "#c8508e"],
  ][v % 3];
  const src = Pix.fromGrid(CRYSTAL, { a: hues[0], A: hues[1], b: hues[2], c: "#4a4060" });
  // a glint travels up the big crystal
  const gy = [7, 4, 1][frame % 3];
  src.set(6, gy, "#ffffff");
  src.set(6, gy + 1, "#ffffff");
  src.outline(mix(shade(hues[2], 0.3), INK, 0.4));
  return place(src, 16, 15, 0);
}

const WEB = [
  "wwwwwwwwwwwww...",
  "w..w....w...w...",
  "w...w...w..w....",
  "ww...w..w.w.....",
  "w.ww..wwwww.....",
  "w...wwwww.ww....",
  "w...w.ww...w....",
  "w..w..ww....w...",
  "wwwwwww.w.......",
  "w..w..w..w......",
  "w.w...w...w.....",
  "ww....w.........",
  "w.....w.........",
  "w...............",
];

/** Cobweb. variant % 3: 0 = top-left corner, 1 = top-right corner, 2 = hanging web with a tiny spider. */
export function webArt(v: number): PropArt {
  const kind = v % 3;
  const p = new Pix(16, 16);
  if (kind === 2) {
    p.vline(8, 0, 6, "#e8e0f4b0");
    const spider = Pix.fromGrid([".l.l.", "lbbbl", ".bwb.", "l.b.l"], { l: "#3a2a44", b: "#5a4a6a", w: "#ffffff" });
    p.paste(spider, 6, 7);
    for (const [x, y] of [[4, 2], [12, 3], [3, 3], [13, 2]]) p.set(x, y, "#e8e0f480");
    return { pix: p, ax: 8, ay: 16 };
  }
  const src = Pix.fromGrid(WEB, { w: "#e8e0f4b0" });
  p.paste(kind === 1 ? src.flippedX() : src, 0, 0);
  return { pix: p, ax: 8, ay: 16 };
}

const PLAQUE = [
  "..ssssssssss..",
  ".sHHHHHHHHHHs.",
  ".sHggggggggHs.",
  ".sHHHHHHHHHHs.",
  ".sHgggggHHHHs.",
  ".sHHHHHHHHHHs.",
  ".sHggggggHHHs.",
  ".sSSSSSSSSSSs.",
  "....bbbbbb....",
  "....bBBBBb....",
  "...bbbbbbbb...",
  "..bBBBBBBBBb..",
];

/** A stone tablet on a pedestal (shows the dungeon's file path when read). */
export function plaqueArt(): PropArt {
  const st = ramp(DUNGEON.stone);
  const src = Pix.fromGrid(PLAQUE, { s: st.lo, H: st.hi, S: st.lo2, g: "#ffd36b", b: st.base, B: st.lo });
  src.set(2, 1, light(st.hi, 0.1));
  src.outline(INK);
  return place(src, 16, 15, 6);
}
