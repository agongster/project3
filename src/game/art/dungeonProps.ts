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

// ───────────────────────────── the end door ─────────────────────────────

/**
 * The END DOOR in the east wall of a dungeon's last room: a stone arch a
 * little wider than its tile (so it sits in the wall around it) and taller
 * than the hero, drawn front-on like the entrance's glowing archway.
 */
const END_DOOR_W = 20;
const END_DOOR_H = 36;
/** The doorway inside the arch: its columns, the row where its round top meets the straight sides, its last row. */
const DOORWAY = { left: 4, right: 15, archRow: 10, bottom: 33 };
const DOORWAY_CX = (DOORWAY.left + DOORWAY.right + 1) / 2;
const DOORWAY_R = (DOORWAY.right - DOORWAY.left + 1) / 2;
/** Thickness of the stone arch around the doorway, and the rows of mortar across its sides. */
const ARCH_STONE = 3;
const MORTAR_EVERY = 6;
/** The stone step under the doorway. */
const STEP_TOP = DOORWAY.bottom + 1;
/** The two leaves meet between these columns. */
const SEAM_X = 9;
/** Plank edges on the shut leaves. */
const PLANK_EDGES = [6, 13];
/** Iron bands across the shut leaves, and the heavy bar across the whole arch (two rows). */
const BAND_ROWS = [13, 29];
const BAR_TOP = 20;
/** The cursed seal on the bar: a purple diamond of this half-height, centred on the bar. */
const SEAL_HALF = 4;
const SEAL_COLORS = { rim: "#5a2f96", glow: ["#a77cf5", "#d8c2ff"], core: "#ffffff" };
const IRON = { hi: "#8c84a2", base: "#5f5680", lo: "#3a3352" };
/** Steps of light leading up and out of the open doorway. */
const STEP_ROWS = [24, 28, 32];
/** Where the light motes of the open doorway start; each frame they rise 2 px. */
const END_DOOR_MOTES = [
  [7, 26],
  [12, 20],
  [9, 14],
];
/** Width of each leaf in frames 0 (shut: half the doorway) to 3 (wide open, seen edge-on). */
const LEAF_WIDTH = [6, 4, 2, 1];
/** Frames of the end door: 0 shut and barred, 1–2 swinging open, 3 open. */
export const END_DOOR_OPEN_FRAME = LEAF_WIDTH.length - 1;
/** Animation frames of the seal's pulse (shut) and of the light motes (open). */
export const END_DOOR_FRAMES = 4;

/** Squared distance from a pixel's centre to the centre of the doorway's round top. */
const archDist2 = (x: number, y: number) => (x + 0.5 - DOORWAY_CX) ** 2 + (y + 0.5 - DOORWAY.archRow) ** 2;

/** True for a pixel of the doorway: the straight part, or under its round top. */
function inDoorway(x: number, y: number): boolean {
  if (x < DOORWAY.left || x > DOORWAY.right || y > DOORWAY.bottom) return false;
  return y >= DOORWAY.archRow || archDist2(x, y) <= DOORWAY_R ** 2;
}

/** True for a pixel of the stone arch around the doorway (the doorway itself included). */
function inArch(x: number, y: number): boolean {
  if (x < DOORWAY.left - ARCH_STONE || x > DOORWAY.right + ARCH_STONE || y > DOORWAY.bottom) return false;
  return y >= DOORWAY.archRow || archDist2(x, y) <= (DOORWAY_R + ARCH_STONE) ** 2;
}

/**
 * The END DOOR. `openness` 0 = shut: dim wooden leaves with iron bands, a
 * heavy bar and a pulsing purple seal (the dungeon is not quiet yet);
 * 1–2 = the leaves swinging open; 3 = open: the leaves seen edge-on and a
 * warm glowing stair with motes drifting up (`frame` animates both the
 * seal and the motes). `openness` must be 0..END_DOOR_OPEN_FRAME (the
 * atlas reduces it). Anchored at the bottom-centre of the door tile.
 */
export function endDoorArt(openness: number, frame: number): PropArt {
  const p = new Pix(END_DOOR_W, END_DOOR_H);
  paintArch(p);
  paintWayOut(p);
  if (openness === 0) paintShutLeaves(p, frame);
  else paintOpenLeaves(p, LEAF_WIDTH[openness], frame, openness === END_DOOR_OPEN_FRAME);
  p.outline(INK);
  return { pix: p, ax: END_DOOR_W / 2, ay: END_DOOR_H };
}

/** The stone arch, lit from the room on the left, with mortar lines, a keystone and a step. */
function paintArch(p: Pix): void {
  const st = ramp(DUNGEON.stone);
  for (let y = 0; y <= DOORWAY.bottom; y++) {
    for (let x = 0; x < END_DOOR_W; x++) {
      if (!inArch(x, y) || inDoorway(x, y)) continue;
      const leftSide = x + 0.5 < DOORWAY_CX;
      const innerEdge = inDoorway(x + 1, y) || inDoorway(x - 1, y) || inDoorway(x, y + 1);
      const mortar = y > DOORWAY.archRow && (y - DOORWAY.archRow) % MORTAR_EVERY === 0;
      const color = mortar ? st.lo2 : innerEdge ? (leftSide ? st.lo : st.lo2) : leftSide ? st.hi : st.base;
      p.set(x, y, color);
    }
  }
  // the keystone at the top of the arch
  for (let y = 1; y < DOORWAY.archRow - DOORWAY_R; y++) for (const x of [SEAM_X, SEAM_X + 1]) p.set(x, y, light(st.hi, 0.15));
  p.hline(1, END_DOOR_W - 2, STEP_TOP, st.hi);
  p.hline(1, END_DOOR_W - 2, STEP_TOP + 1, st.lo);
}

/** The way out behind the leaves: warm light, brightest at the top, with steps leading up. */
function paintWayOut(p: Pix): void {
  const [glowHi, glow, glowLo] = DUNGEON.exit;
  const top = DOORWAY.archRow - DOORWAY_R;
  for (let y = top; y <= DOORWAY.bottom; y++) {
    const k = (y - top) / (DOORWAY.bottom - top);
    const color = STEP_ROWS.includes(y) ? shade(glowLo, 0.12) : k < 0.35 ? glowHi : k < 0.7 ? glow : glowLo;
    for (let x = DOORWAY.left; x <= DOORWAY.right; x++) if (inDoorway(x, y)) p.set(x, y, color);
  }
}

/** Dim barred leaves: planks, iron bands, a heavy bar across the arch and a pulsing purple seal. */
function paintShutLeaves(p: Pix, frame: number): void {
  const wood = ramp(shade(DUNGEON.wood, 0.2));
  for (let y = 0; y <= DOORWAY.bottom; y++) {
    for (let x = DOORWAY.left; x <= DOORWAY.right; x++) {
      if (!inDoorway(x, y)) continue;
      const color = x === SEAM_X ? wood.lo2 : x === SEAM_X + 1 ? wood.hi : PLANK_EDGES.includes(x) ? wood.lo : wood.base;
      p.set(x, y, color);
    }
  }
  for (const y of BAND_ROWS) {
    p.hline(DOORWAY.left, DOORWAY.right, y, IRON.base);
    for (const x of [DOORWAY.left + 1, SEAM_X - 1, SEAM_X + 2, DOORWAY.right - 1]) p.set(x, y, IRON.hi);
  }
  p.hline(0, END_DOOR_W - 1, BAR_TOP, IRON.hi);
  p.hline(0, END_DOOR_W - 1, BAR_TOP + 1, IRON.base);
  p.hline(0, END_DOOR_W - 1, BAR_TOP + 2, IRON.lo);
  const bright = frame % 2 === 0;
  const centreY = BAR_TOP + 1;
  for (let dy = -SEAL_HALF; dy <= SEAL_HALF; dy++) {
    const half = SEAL_HALF - Math.abs(dy);
    const x0 = SEAM_X - half;
    const x1 = SEAM_X + 1 + half;
    p.hline(x0, x1, centreY + dy, SEAL_COLORS.rim);
    if (x1 - x0 > 1) p.hline(x0 + 1, x1 - 1, centreY + dy, SEAL_COLORS.glow[bright ? 1 : 0]);
  }
  if (bright) p.set(SEAM_X, centreY - 1, SEAL_COLORS.core);
}

/** The leaves swung inward to `leaf` px each, with light motes drifting up once wide open. */
function paintOpenLeaves(p: Pix, leaf: number, frame: number, motes: boolean): void {
  const wood = ramp(DUNGEON.wood);
  for (let y = 0; y <= DOORWAY.bottom; y++) {
    for (let i = 0; i < leaf; i++) {
      const edge = i === leaf - 1;
      if (inDoorway(DOORWAY.left + i, y)) p.set(DOORWAY.left + i, y, edge ? wood.hi : wood.lo);
      if (inDoorway(DOORWAY.right - i, y)) p.set(DOORWAY.right - i, y, edge ? wood.base : wood.lo2);
    }
  }
  if (!motes) return;
  END_DOOR_MOTES.forEach(([x, y], i) => {
    const yy = y - ((frame + i) % END_DOOR_FRAMES) * 2;
    if (inDoorway(x, yy)) p.set(x, yy, "#ffffff");
  });
}
