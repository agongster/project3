/**
 * Buildings: every Python file is a building.
 *
 *   cottage 2×2 tiles · house 3×2 · manor 4×3 · tower 2×3 (test files)
 *
 * The sprite is exactly `w*16` px wide and `h*16 + roof` px tall: the roof
 * rises above the footprint like in most top-down RPGs. The anchor is the
 * bottom-centre of the footprint, so the engine draws a building at
 * ((b.x + b.w / 2) * 16, (b.y + b.h) * 16). The door is always in the tile
 * column floor((w - 1) / 2), centred in that column, on the bottom row.
 *
 * Three states share one silhouette:
 *   clean     — cozy: warm windows, chimney, flower boxes
 *   corrupted — the file has bugs: gloomy purple, thorny vines, boarded or
 *               cracked windows, and a glowing doorway (a dungeon entrance)
 *               with a skull emblem above it
 *   restored  — clean + extra bloom: flowers, a pennant, sparkles
 *
 * Everything is drawn with shapes; the colours come from the theme.
 */
import type { BuildingKind } from "@/lib/types";
import { light, mix, ramp, shade, type Ramp } from "./color";
import { hash01, Pix } from "./engine";
import { SNOW, type PropArt } from "./nature";
import { dropShadow } from "./shapes";
import type { ThemePalette } from "./themes";

export type BuildingState = "clean" | "corrupted" | "restored";
export const BUILDING_STATES: BuildingState[] = ["clean", "corrupted", "restored"];

/** Footprint (tiles) and how many pixels the roof rises above it. */
export const BUILDING_SIZE: Record<BuildingKind, { w: number; h: number; roof: number }> = {
  cottage: { w: 2, h: 2, roof: 20 },
  house: { w: 3, h: 2, roof: 22 },
  manor: { w: 4, h: 3, roof: 22 },
  tower: { w: 2, h: 3, roof: 26 },
};

const INK = "#2b1d34";

/** All colours a building needs, picked from the theme (or the cursed palette). */
interface Look {
  roof: Ramp;
  wall: Ramp;
  timber: Ramp;
  stone: Ramp;
  door: Ramp;
  glass: [string, string, string]; // dark, mid, light
  cursed: boolean;
  lit: boolean;
  snowy: boolean;
  flowers: string[];
  leaves: string[];
}

function lookFor(pal: ThemePalette, state: BuildingState, v: number): Look {
  if (state === "corrupted") {
    return {
      roof: ramp("#66518a"),
      wall: ramp("#958aaa"),
      timber: ramp("#4c3b5c"),
      stone: ramp("#6a6080"),
      door: ramp("#4c3b5c"),
      glass: ["#2a1a3a", "#4a2a5a", "#8a4aaa"],
      cursed: true,
      lit: false,
      snowy: pal.snowy,
      flowers: ["#c43cff", "#ff6ad5"],
      leaves: ["#2f2440", "#46355a", "#5f4a75"],
    };
  }
  return {
    roof: ramp(pal.roofs[v % pal.roofs.length]),
    wall: ramp(pal.walls[Math.floor(v / 4) % pal.walls.length], 0.8),
    timber: ramp(pal.id === "night" ? "#7a5a70" : shade(pal.wood, 0.05)),
    stone: ramp(pal.stone),
    door: ramp(mix(pal.wood, "#7a4a3a", 0.3)),
    glass: pal.lit ? ["#ff9a3c", "#ffd36b", "#fff4c2"] : ["#e8a23c", "#ffd77a", "#fff4cf"],
    cursed: false,
    lit: pal.lit,
    snowy: pal.snowy,
    flowers: pal.flowers,
    leaves: [pal.leaves[1], pal.leaves[2], pal.leaves[3]],
  };
}

const GLOW = ["#ffb3f0", "#ff6ad5", "#c43cff", "#6a1f8f", "#2a0f3f"];

// ───────────────────────────── parts ─────────────────────────────

/**
 * A hip roof seen from the front: horizontal shingle courses, narrowing a
 * little towards the ridge, lit from the left. Returns nothing; paints p.
 */
function roof(p: Pix, x0: number, x1: number, top: number, bottom: number, look: Look, seed: number, inset = 5): void {
  const r = look.roof;
  const h = bottom - top;
  for (let y = top; y <= bottom; y++) {
    const t = (y - top) / h; // 0 at ridge → 1 at eave
    // the hip slopes in a straight line; the first rows curve in a little more
    const ins = Math.round(inset * (1 - t)) + (y - top < 2 ? 2 - (y - top) : 0);
    const a = x0 + ins;
    const b = x1 - ins;
    const course = Math.floor((y - top - 2) / 3);
    const inCourse = (y - top - 2) % 3;
    for (let x = a; x <= b; x++) {
      const u = (x - a) / Math.max(1, b - a); // 0 left → 1 right
      // the left hip faces the light, the right hip is in shade; lower courses a touch darker
      let c = u < 0.1 + 0.08 * (1 - t) ? r.hi : u > 0.9 - 0.08 * (1 - t) ? r.lo : t > 0.7 ? mix(r.base, r.lo, 0.35) : r.base;
      if (y - top < 2) c = y === top ? r.hi : light(r.base, 0.05); // ridge cap
      else if (inCourse === 2) c = (x + course * 2) % 4 === 0 ? r.lo2 : r.lo; // shingle edge
      else if (inCourse === 0 && (x + course * 2) % 4 === 1) c = mix(c, r.hi, 0.6);
      if (look.cursed && hash01(seed, x, y) < 0.012 && y > top + 2) c = r.line; // missing shingles
      p.set(x, y, c);
    }
  }
  // eave: a darker lip
  p.hline(x0, x1, bottom, r.lo2);
  p.hline(x0, x1, bottom + 1, r.line);
  if (look.snowy) {
    // a soft snow layer on the upper roof and icicles on the eave
    for (let y = top; y <= top + 4; y++) {
      const t = (y - top) / h;
      const ins = Math.round(inset * (1 - t) * (1 - t));
      for (let x = x0 + ins; x <= x1 - ins; x++) {
        if (y === top + 4 && hash01(seed, x) < 0.5) continue;
        if (y === top && (x === x0 + ins || x === x1 - ins)) continue;
        p.set(x, y, y >= top + 3 ? SNOW[1] : SNOW[0]);
      }
    }
    for (let x = x0 + 1; x < x1; x += 3) {
      const len = 1 + Math.floor(hash01(seed, x, 3) * 3);
      for (let k = 0; k < len; k++) p.set(x, bottom + 1 + k, k === len - 1 ? "#cfe8ff" : SNOW[0]);
    }
  }
}

/** Plaster wall with timber corner posts, a stone footing and the eave's shadow. */
function wall(p: Pix, x0: number, x1: number, top: number, bottom: number, look: Look, seed: number): void {
  const w = look.wall;
  for (let y = top; y <= bottom; y++) {
    for (let x = x0; x <= x1; x++) {
      let c = w.base;
      if (hash01(seed, x, y) < 0.05) c = w.lo;
      p.set(x, y, c);
    }
  }
  // shadow under the roof
  p.hline(x0, x1, top, w.lo2);
  p.hline(x0, x1, top + 1, w.lo);
  // corner posts
  for (let y = top; y <= bottom; y++) {
    p.set(x0, y, look.timber.hi);
    p.set(x0 + 1, y, look.timber.base);
    p.set(x1 - 1, y, look.timber.base);
    p.set(x1, y, look.timber.lo);
  }
  // stone footing
  for (let x = x0; x <= x1; x++) {
    p.set(x, bottom - 1, (x + seed) % 4 === 0 ? look.stone.lo : look.stone.base);
    p.set(x, bottom, look.stone.lo2);
  }
  if (look.cursed) {
    // grime streaks and cracks
    for (let i = 0; i < 4; i++) {
      const x = x0 + 3 + Math.floor(hash01(seed, i) * (x1 - x0 - 6));
      for (let y = top + 3; y < top + 3 + 3 + i; y++) p.set(x, y, w.lo);
    }
    const cx = x0 + 4 + Math.floor(hash01(seed, 9) * (x1 - x0 - 8));
    for (const [dx, dy] of [[0, 0], [1, 1], [1, 2], [2, 3], [1, 4]]) p.set(cx + dx, top + 4 + dy, w.lo2);
  }
}

/** A window (frame, panes, sill) with a flower box. Cursed windows are boarded up or cracked. */
function windowAt(p: Pix, x: number, y: number, w: number, h: number, look: Look, seed: number, opts: { box?: boolean; eyes?: boolean; round?: boolean } = {}): void {
  const t = look.timber;
  const [dark, mid, lite] = look.glass;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
      if (opts.round && j === 0 && (i === 0 || i === w - 1)) continue;
      let c = edge ? (i === 0 || j === 0 ? t.hi : t.lo) : mid;
      if (!edge) {
        if (i === Math.floor(w / 2) || j === Math.floor(h / 2)) c = t.base; // mullions
        else if (i + j < 4) c = lite;
        else if (i >= w - 2 || j >= h - 2) c = dark;
      }
      p.set(x + i, y + j, c);
    }
  }
  if (look.cursed) {
    if (seed % 2 === 0) {
      // boarded up: two planks across a dark window
      for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) p.set(x + i, y + j, dark);
      for (let i = -1; i <= w; i++) {
        p.set(x + i, y + 2 + Math.floor(i / 3), "#7a6878");
        p.set(x + i, y + h - 3 - Math.floor(i / 4), "#6a5868");
      }
    } else {
      // cracked glass
      p.set(x + 2, y + 2, lite);
      p.set(x + 3, y + 3, lite);
      p.set(x + 3, y + 4, lite);
      p.set(x + 4, y + 4, lite);
    }
    if (opts.eyes) {
      // something is looking out...
      p.set(x + 2, y + h - 3, "#ffe14a");
      p.set(x + w - 3, y + h - 3, "#ffe14a");
    }
  }
  if (opts.box) {
    // flower box under the sill
    const by = y + h;
    p.hline(x - 1, x + w, by, t.base);
    p.hline(x - 1, x + w, by + 1, t.lo);
    for (let i = 0; i < w + 1; i++) {
      const c = look.cursed ? (i % 3 === 0 ? look.leaves[1] : null) : i % 2 === 0 ? look.flowers[(i + seed) % look.flowers.length] : look.leaves[2];
      if (c) p.set(x + i, by - 1, c);
    }
  }
}

/** An arched wooden door (or, when cursed, a glowing dungeon doorway). `cx` = centre column. */
function door(p: Pix, cx: number, bottom: number, look: Look, h = 12, w = 8): void {
  const x0 = cx - w / 2;
  const top = bottom - h + 1;
  for (let y = top; y <= bottom; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = x - x0;
      const j = y - top;
      // arch: trim the top corners
      if (j === 0 && (i < 2 || i > w - 3)) continue;
      if (j === 1 && (i === 0 || i === w - 1)) continue;
      const frame = i === 0 || i === w - 1 || j === 0 || (j === 1 && (i === 1 || i === w - 2));
      let c: string;
      if (look.cursed) {
        // a swirling portal of light: bright core, dark violet edges
        const dx = (i - (w - 1) / 2) / (w / 2);
        const dy = (j - h * 0.62) / (h * 0.62);
        const d = Math.sqrt(dx * dx + dy * dy);
        c = frame ? "#3a2448" : d < 0.35 ? GLOW[0] : d < 0.6 ? GLOW[1] : d < 0.85 ? GLOW[2] : GLOW[3];
        if (!frame && (i * 2 + j) % 7 === 0 && d > 0.4) c = GLOW[4];
      } else {
        c = frame ? look.door.lo2 : i % 3 === 0 ? look.door.lo : look.door.base;
        if (!frame && i === 1) c = look.door.hi;
      }
      p.set(x, y, c);
    }
  }
  if (!look.cursed) {
    p.set(x0 + w - 3, top + Math.floor(h / 2) + 1, "#ffd34d"); // knob
    p.set(x0 + w - 3, top + Math.floor(h / 2) + 2, "#c98a2b");
  }
  // doorstep
  p.hline(x0 - 1, x0 + w, bottom + 1, look.cursed ? "#4a3a5a" : look.stone.base);
}

/** Skull emblem (cursed buildings) with a tiny bug crawling on it. */
function skullEmblem(p: Pix, cx: number, y: number): void {
  const g = ["..bbb..", ".bwwwb.", "bwwwwwb", "bweweeb", ".bwwwb.", "..bmb.."];
  const s = Pix.fromGrid(g, { b: "#3a2448", w: "#e8dcf0", e: "#c43cff", m: "#3a2448" });
  s.set(3, 3, "#e8dcf0");
  s.set(2, 3, "#c43cff");
  s.set(4, 3, "#c43cff");
  p.paste(s, cx - 3, y);
}

/** Thorny vines creeping up from the ground (cursed). */
function vines(p: Pix, x0: number, x1: number, top: number, bottom: number, seed: number): void {
  const stems = 3 + Math.floor((x1 - x0) / 16);
  for (let s = 0; s < stems; s++) {
    let x = x0 + Math.floor(hash01(seed, s) * (x1 - x0));
    const height = 6 + Math.floor(hash01(seed, s, 2) * (bottom - top - 4));
    for (let k = 0; k < height; k++) {
      const y = bottom - k;
      if (y < top) break;
      p.set(x, y, k % 2 ? "#3c2a4c" : "#4f3a62");
      if (k % 4 === 2) p.set(x + (k % 8 < 4 ? 1 : -1), y, "#c9a8e0"); // thorn
      if (k % 5 === 4) p.set(x - 1, y, "#6a4a80"); // leaf
      if (hash01(seed, s, k) < 0.35) x += hash01(seed, k, s) < 0.5 ? -1 : 1;
    }
  }
}

/** Little flower clumps along the base (restored buildings). */
function flowerBed(p: Pix, x0: number, x1: number, y: number, look: Look, seed: number, avoid: [number, number]): void {
  for (let x = x0; x <= x1; x += 1) {
    if (x >= avoid[0] && x <= avoid[1]) continue;
    const r = hash01(seed, x);
    p.set(x, y, look.leaves[r < 0.5 ? 1 : 2]);
    if (x % 2 === 0) p.set(x, y - 1, look.leaves[2]);
    if (r < 0.45) p.set(x, y - 2, look.flowers[Math.floor(r * 10) % look.flowers.length]);
  }
}

function chimney(p: Pix, x: number, top: number, bottom: number, look: Look): void {
  const s = look.cursed ? ramp("#6a5a7a") : ramp(mix(look.stone.base, "#c9705a", 0.5));
  for (let y = top; y <= bottom; y++) {
    p.set(x, y, s.hi);
    p.set(x + 1, y, s.base);
    p.set(x + 2, y, s.base);
    p.set(x + 3, y, s.lo);
    if ((y - top) % 3 === 2) {
      p.set(x + 1, y, s.lo);
      p.set(x + 2, y, s.lo);
    }
  }
  p.hline(x - 1, x + 4, top, s.lo2);
  p.hline(x - 1, x + 4, top - 1, s.hi);
  if (look.cursed) p.set(x + 2, top + 2, s.lo2);
  if (look.snowy) p.hline(x - 1, x + 4, top - 2, SNOW[0]);
}

/** A little pennant flag on a pole (restored buildings, the tower). */
function pennant(p: Pix, x: number, top: number, color: string, poleLen = 7): void {
  for (let y = top; y < top + poleLen; y++) p.set(x, y, "#5a4a5a");
  p.set(x, top - 1, "#ffd34d");
  const f = ["cc", "ccc", "cccc", "ccc", "cc"];
  f.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) p.set(x + 1 + i, top + j, j === 0 || i === row.length - 1 ? shade(color, 0.1) : color);
  });
  p.set(x + 2, top + 2, "#ffffff");
}

function sparkles(p: Pix, W: number, H: number, seed: number): void {
  for (let i = 0; i < 4; i++) {
    const x = 3 + Math.floor(hash01(seed, i, 1) * (W - 6));
    const y = 4 + Math.floor(hash01(seed, i, 2) * (H - 20));
    if (p.has(x, y)) continue;
    p.set(x, y, "#ffffff");
    p.set(x - 1, y, "#fff3a8");
    p.set(x + 1, y, "#fff3a8");
    p.set(x, y - 1, "#fff3a8");
    p.set(x, y + 1, "#fff3a8");
  }
}

/** Warm light spilling from windows at night: lightens nearby wall pixels. */
function windowGlow(p: Pix, x: number, y: number, w: number, h: number): void {
  for (let j = -2; j < h + 2; j++) {
    for (let i = -2; i < w + 2; i++) {
      if (i >= 0 && j >= 0 && i < w && j < h) continue;
      const c = p.hexAt(x + i, y + j);
      if (c && (i + j) % 2 === 0) p.set(x + i, y + j, mix(c, "#ffd36b", 0.35));
    }
  }
}

// ───────────────────────────── kinds ─────────────────────────────

/** Outline + soft ground shadow; anchor at the bottom-centre of the footprint. */
function finish(p: Pix, W: number, H: number): PropArt {
  p.outline(INK);
  dropShadow(p, W / 2 - 0.5, H - 1, W / 2 - 1, 1.2, "#2b1d3430");
  return { pix: p, ax: W / 2, ay: H };
}

function houseLike(pal: ThemePalette, kind: "cottage" | "house" | "manor", state: BuildingState, v: number): PropArt {
  const size = BUILDING_SIZE[kind];
  const W = size.w * 16;
  const H = size.h * 16 + size.roof;
  const look = lookFor(pal, state, v);
  const p = new Pix(W, H);
  const wallTop = kind === "manor" ? H - 31 : H - 18;
  const roofTop = kind === "manor" ? 5 : kind === "house" ? 6 : 7;
  const doorCx = Math.floor((size.w - 1) / 2) * 16 + 8;
  const bottom = H - 2;
  const chimX = v % 2 ? W - 12 : 6;
  chimney(p, chimX, roofTop - 3, roofTop + 8, look);
  wall(p, 3, W - 4, wallTop, bottom, look, v);
  roof(p, 1, W - 2, roofTop, wallTop + 1, look, v, kind === "manor" ? 8 : 6);

  // small front gables ("dormers") with a round window: one over the door on a
  // house, two symmetric ones on a manor
  const gables = kind === "house" ? [doorCx] : kind === "manor" ? [16, W - 16] : [];
  for (const gx of gables) {
    const gBottom = wallTop - 1;
    const gTop = gBottom - (kind === "manor" ? 15 : 17);
    for (let y = gTop; y <= gBottom; y++) {
      const half = 1 + (y - gTop) * 0.62;
      for (let x = Math.round(gx - half - 0.5); x <= Math.round(gx + half - 0.5); x++) {
        p.set(x, y, y === gBottom - 1 ? look.timber.base : y === gBottom ? look.timber.lo : look.wall.base);
      }
      p.set(Math.round(gx - half - 1.5), y, look.roof.hi);
      p.set(Math.round(gx - half - 2.5), y, look.roof.base);
      p.set(Math.round(gx + half + 0.5), y, look.roof.lo);
      p.set(Math.round(gx + half + 1.5), y, look.roof.lo2);
    }
    p.set(gx - 1, gTop - 1, look.roof.hi);
    p.set(gx, gTop - 1, look.roof.base);
    windowAt(p, gx - 3, gBottom - 9, 6, 6, look, v + gx, { round: true });
    if (look.lit) windowGlow(p, gx - 3, gBottom - 9, 6, 6);
  }

  // windows
  const winW = 8;
  const winH = 7;
  const lowerY = bottom - 12;
  const cols: number[] = [];
  for (let c = 0; c < size.w; c++) if (c * 16 + 8 !== doorCx) cols.push(c * 16 + 4);
  cols.forEach((wx, i) => {
    windowAt(p, wx, lowerY, winW, winH, look, v + i, { box: !look.cursed || i === 0, eyes: look.cursed && i === cols.length - 1 });
    if (look.lit) windowGlow(p, wx, lowerY, winW, winH);
  });
  if (kind === "manor") {
    // upper floor: a window over every column, plus a balcony rail above the door
    for (let c = 0; c < size.w; c++) {
      const wx = c * 16 + 4;
      windowAt(p, wx, wallTop + 4, winW, winH, look, v + c + 7, { box: c * 16 + 8 !== doorCx && !look.cursed });
      if (look.lit) windowGlow(p, wx, wallTop + 4, winW, winH);
    }
    p.hline(3, W - 4, wallTop + 15, look.timber.base);
    p.hline(3, W - 4, wallTop + 16, look.timber.lo);
  }

  const doorH = kind === "manor" ? 13 : 12;
  door(p, doorCx, bottom - 1, look, doorH, kind === "manor" ? 10 : 8);
  if (look.cursed) {
    vines(p, 4, W - 5, wallTop + 2, bottom - 1, v + 1);
    skullEmblem(p, doorCx, bottom - doorH - 7);
  } else {
    // a little lamp / plaque next to the door
    p.set(doorCx + 6, bottom - 10, "#ffd34d");
    p.set(doorCx + 6, bottom - 9, look.lit ? "#fff4c2" : "#ffe08a");
  }
  if (state === "restored") {
    flowerBed(p, 4, W - 5, bottom - 1, look, v, [doorCx - 6, doorCx + 5]);
    pennant(p, W - (v % 2 ? 22 : 9), roofTop - 6, pal.flowers[1] === "#ffd65c" ? "#58c46a" : pal.flowers[0], 8);
  }
  const out = finish(p, W, H);
  if (state === "restored") sparkles(out.pix, W, H, v);
  return out;
}

function tower(pal: ThemePalette, state: BuildingState, v: number): PropArt {
  const size = BUILDING_SIZE.tower;
  const W = size.w * 16;
  const H = size.h * 16 + size.roof;
  const look = lookFor(pal, state, v);
  const p = new Pix(W, H);
  const st = look.cursed ? look.stone : ramp(mix(pal.stone, "#d8c8b0", 0.35));
  const bottom = H - 2;
  const bx0 = 1;
  const bx1 = 20;
  const bodyTop = 26;
  // a small wooden lean-to on the right with a practice target ("tests")
  const shedTop = bottom - 16;
  for (let y = shedTop; y <= bottom; y++) {
    for (let x = bx1 - 1; x <= W - 3; x++) {
      const roofRow = y - shedTop < 3 + Math.floor((x - bx1) / 4);
      let c: string;
      if (y - shedTop < 4 && roofRow) c = y - shedTop === 0 ? look.roof.hi : look.roof.base;
      else c = (x - bx1) % 3 === 0 ? look.timber.lo : look.timber.base;
      if (y - shedTop < 4 + Math.floor((x - bx1) / 4) - 4) continue;
      p.set(x, y, c);
    }
  }
  // target
  const tx = 26;
  const ty = bottom - 7;
  p.ellipse(tx, ty, 3, 3, look.cursed ? "#6a5a7a" : "#fff4e0");
  p.ellipse(tx, ty, 2, 2, look.cursed ? "#4a3a5a" : "#e5484d");
  p.set(tx, ty, look.cursed ? "#c43cff" : "#fff4e0");
  // stone body
  for (let y = bodyTop; y <= bottom; y++) {
    for (let x = bx0; x <= bx1; x++) {
      const row = Math.floor((y - bodyTop) / 4);
      const off = (row % 2) * 3;
      const mortarY = (y - bodyTop) % 4 === 3;
      const mortarX = (x + off) % 6 === 0;
      let c = hash01(Math.floor((x + off) / 6), row, v) < 0.3 ? st.hi : st.base;
      if (x <= bx0 + 1) c = st.hi;
      if (x >= bx1 - 2) c = st.lo;
      if (mortarY || mortarX) c = st.lo2;
      p.set(x, y, c);
    }
  }
  p.hline(bx0, bx1, bodyTop, st.lo2);
  // parapet with crenellations
  for (let y = bodyTop - 6; y < bodyTop; y++) {
    for (let x = bx0 - 1; x <= bx1 + 1; x++) {
      const merlon = Math.floor((x - bx0 + 1) / 3) % 2 === 0;
      if (y < bodyTop - 3 && !merlon) continue;
      p.set(x, y, y === bodyTop - 6 || (y === bodyTop - 3 && !merlon) ? st.hi : x > bx1 - 2 ? st.lo : st.base);
    }
  }
  p.hline(bx0 - 1, bx1 + 1, bodyTop - 1, st.lo2);
  // pointed roof rising behind the parapet
  const cx = (bx0 + bx1) / 2;
  for (let y = 3; y < bodyTop - 5; y++) {
    const half = ((y - 3) / (bodyTop - 8)) * 8.5;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const u = (x - cx) / (half + 0.01);
      let c = u < -0.3 ? look.roof.hi : u < 0.4 ? look.roof.base : look.roof.lo;
      if ((y % 3 === 2 && (x + y) % 2 === 0) || (look.cursed && hash01(v, x, y) < 0.04)) c = look.roof.lo2;
      p.set(x, y, c);
    }
  }
  if (look.snowy) {
    for (let y = 3; y < 9; y++) {
      const half = ((y - 3) / (bodyTop - 8)) * 8.5;
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) if (y < 8 || hash01(x, v) < 0.5) p.set(x, y, y > 6 ? SNOW[1] : SNOW[0]);
    }
    for (let x = bx0 - 1; x <= bx1 + 1; x++) if (Math.floor((x - bx0 + 1) / 3) % 2 === 0) p.set(x, bodyTop - 6, SNOW[0]);
  }
  // flag on top
  if (!look.cursed) pennant(p, Math.round(cx), 0, state === "restored" ? "#58c46a" : pal.roofs[(v + 1) % pal.roofs.length], 5);
  else {
    // a torn black flag
    p.vline(Math.round(cx), 0, 4, "#5a4a5a");
    p.set(Math.round(cx) + 1, 0, "#2a1a3a");
    p.set(Math.round(cx) + 2, 0, "#2a1a3a");
    p.set(Math.round(cx) + 1, 1, "#2a1a3a");
  }
  // arrow-slit windows (lit at night) and a round lookout window
  const slit = (x: number, y: number) => {
    p.rect(x, y, 2, 5, look.cursed ? look.glass[0] : look.glass[1]);
    p.set(x, y, look.cursed ? look.glass[2] : look.glass[2]);
    p.vline(x - 1, y, y + 4, st.lo2);
    p.vline(x + 2, y, y + 4, st.hi);
  };
  slit(14, bodyTop + 4);
  slit(5, bodyTop + 14);
  slit(14, bodyTop + 22);
  if (look.lit) windowGlow(p, 14, bodyTop + 4, 2, 5);
  if (look.cursed) {
    p.set(14, bodyTop + 6, "#ffe14a");
    p.set(15, bodyTop + 6, "#ffe14a");
  }
  // door (left tile, as the footprint rule requires)
  const doorCx = 8;
  door(p, doorCx, bottom - 1, look, 12, 8);
  if (look.cursed) {
    vines(p, 2, 19, bodyTop + 2, bottom - 1, v + 4);
    skullEmblem(p, doorCx, bottom - 19);
  }
  if (state === "restored") {
    flowerBed(p, 2, W - 3, bottom - 1, look, v, [doorCx - 6, doorCx + 5]);
    // a banner hanging on the tower
    for (let y = bodyTop + 2; y < bodyTop + 10; y++) for (let x = 3; x <= 6; x++) p.set(x, y, y === bodyTop + 9 && x % 2 ? null : x === 3 ? "#7ee08a" : "#58c46a");
    p.set(4, bodyTop + 5, "#ffffff");
    p.set(5, bodyTop + 4, "#ffffff");
  }
  const out = finish(p, W, H);
  if (state === "restored") sparkles(out.pix, W, H, v);
  return out;
}

/** Number of visual variants per kind (roof colour × wall colour × chimney side). */
export const BUILDING_VARIANTS = 12;

export function paintBuilding(pal: ThemePalette, kind: BuildingKind, state: BuildingState, v: number): PropArt {
  return kind === "tower" ? tower(pal, state, v) : houseLike(pal, kind, state, v);
}

/**
 * Where a building emits light, relative to its anchor (bottom-centre of the
 * footprint): lit windows (only worth drawing in dark themes) and, for
 * corrupted buildings, the eerie doorway glow (worth drawing always).
 * Use with glowSprite() and "lighter" blending.
 */
export function buildingLights(kind: BuildingKind, state: BuildingState): { dx: number; dy: number; radius: number; color: string; always?: boolean }[] {
  const size = BUILDING_SIZE[kind];
  const W = size.w * 16;
  const doorCx = Math.floor((size.w - 1) / 2) * 16 + 8;
  const out: { dx: number; dy: number; radius: number; color: string; always?: boolean }[] = [];
  if (state === "corrupted") out.push({ dx: doorCx - W / 2, dy: -8, radius: 18, color: "#c43cff", always: true });
  if (kind === "tower") {
    if (state !== "corrupted") out.push({ dx: 15 - W / 2, dy: -(size.h * 16) + 8, radius: 12, color: "#ffcf6b" });
    return out;
  }
  if (state === "corrupted") return out;
  for (let c = 0; c < size.w; c++) {
    if (c * 16 + 8 === doorCx) continue;
    out.push({ dx: c * 16 + 8 - W / 2, dy: -10, radius: 14, color: "#ffcf6b" });
  }
  return out;
}
