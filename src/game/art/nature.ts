/**
 * Nature props: trees, bushes, rocks, flowers, mushrooms and stumps.
 *
 * Trees, bushes and rocks are procedural: a few overlapping lit "blobs"
 * (see shapes.ts) form a leafy clump, which is then outlined. Each theme
 * picks a tree SHAPE (oak, cherry, maple, pine, palm, ...) and colours, so
 * the six themes look different at a glance. Smaller props are string grids.
 *
 * All props are returned with their anchor at the bottom-centre of the tile
 * they stand on.
 */
import { light, mix, ramp, shade } from "./color";
import { hash01, Pix } from "./engine";
import { dropShadow, leafTexture, litBlobs, palmFrond, pineTiers, snowCap, type Blob } from "./shapes";
import type { ThemePalette, TreeShape } from "./themes";

export interface PropArt {
  pix: Pix;
  ax: number;
  ay: number;
}

export const SHADOW = "#2b1d3440";
export const SNOW: [string, string] = ["#ffffff", "#dce9f7"];

/** Draws a tapering trunk from `top` to `bottom` (inclusive) centred on cx, with flared roots. */
function trunk(p: Pix, cx: number, top: number, bottom: number, color: string, width = 6): void {
  const r = ramp(color);
  for (let y = top; y <= bottom; y++) {
    const flare = y >= bottom - 1 ? 1 : 0;
    const x0 = cx - width / 2 - flare;
    const x1 = cx + width / 2 - 1 + flare;
    for (let x = x0; x <= x1; x++) {
      let c = r.base;
      if (x === x0) c = r.hi;
      else if (x >= x1 - 1) c = r.lo;
      if ((y * 3 + x) % 7 === 0) c = r.lo2; // bark grooves
      p.set(x, y, c);
    }
  }
  // the canopy shades the top of the trunk
  for (let x = cx - width / 2; x < cx + width / 2; x++) p.set(x, top, r.lo2);
  for (let x = cx - width / 2; x < cx + width / 2; x++) p.set(x, top + 1, r.lo);
  p.outline(r.line);
}

/** Blob layouts (centres relative to a 32×40 tree) for the round-canopy trees. */
const ROUND_CANOPIES: Blob[][] = [
  [
    { x: 16, y: 9, rx: 8, ry: 7 },
    { x: 8.5, y: 14, rx: 6.5, ry: 6 },
    { x: 23.5, y: 14, rx: 6.5, ry: 6 },
    { x: 16, y: 16, rx: 8, ry: 7 },
    { x: 10.5, y: 21, rx: 6, ry: 4.5 },
    { x: 21.5, y: 21, rx: 6, ry: 4.5 },
  ],
  [
    { x: 15, y: 8, rx: 7, ry: 6 },
    { x: 21, y: 11, rx: 6, ry: 5 },
    { x: 9.5, y: 14, rx: 6, ry: 6 },
    { x: 22, y: 17, rx: 7, ry: 6 },
    { x: 13, y: 19, rx: 7, ry: 5 },
    { x: 17, y: 23, rx: 6, ry: 3.5 },
  ],
  [
    { x: 12, y: 10, rx: 7, ry: 6 },
    { x: 21, y: 9, rx: 7, ry: 6 },
    { x: 7, y: 16, rx: 5.5, ry: 5 },
    { x: 25, y: 16, rx: 5.5, ry: 5 },
    { x: 16, y: 17, rx: 9, ry: 6 },
    { x: 16, y: 22, rx: 7, ry: 3.5 },
  ],
];

/** Small round fruit / blossom dots on a canopy. */
function dots(p: Pix, colors: string[], seed: number, count: number, area: [number, number, number, number], size = 2): void {
  const [x0, y0, x1, y1] = area;
  let placed = 0;
  for (let i = 0; i < 80 && placed < count; i++) {
    const x = Math.floor(x0 + hash01(seed, i, 1) * (x1 - x0));
    const y = Math.floor(y0 + hash01(seed, i, 2) * (y1 - y0));
    if (!p.has(x, y) || !p.has(x + 1, y + 1) || !p.has(x - 1, y) || !p.has(x, y + 2)) continue;
    const c = colors[i % colors.length];
    if (size === 1) {
      p.set(x, y, c);
    } else {
      p.set(x, y, c);
      p.set(x + 1, y, shade(c, 0.1));
      p.set(x, y + 1, shade(c, 0.12));
      p.set(x + 1, y + 1, shade(c, 0.2));
      p.set(x, y, light(c, 0.12));
    }
    placed++;
  }
}

function roundTree(pal: ThemePalette, shape: TreeShape, v: number, alt: boolean): PropArt {
  const p = new Pix(32, 40);
  const cherry = shape === "cherry";
  const tones = shape === "blossom" || (shape === "maple" && alt) ? pal.leavesAlt : pal.leaves;
  const line = shape === "blossom" || (shape === "maple" && alt) ? pal.leavesAltLine : pal.leavesLine;
  trunk(p, 16, 22, 37, pal.trunk, cherry ? 4 : 6);
  if (cherry) {
    // forked branches reaching into the canopy
    const r = ramp(pal.trunk);
    p.line(14, 24, 10, 18, r.base);
    p.line(18, 24, 22, 18, r.lo);
  }
  const canopy = new Pix(32, 40);
  const blobs = ROUND_CANOPIES[v % ROUND_CANOPIES.length];
  litBlobs(canopy, blobs, tones, { dither: 0.6 });
  leafTexture(canopy, tones, v + 3, 0.1);
  if (shape === "blossom") dots(canopy, pal.fruit, v + 9, 9, [4, 4, 28, 24], 1);
  if (shape === "glow") dots(canopy, pal.fruit, v + 5, 5, [4, 6, 28, 24]);
  if (shape === "oak" && v % 3 === 2) dots(canopy, [pal.fruit[0]], v, 6, [5, 6, 27, 24]);
  if (cherry) dots(canopy, ["#ffffff", tones[4]], v + 1, 8, [4, 3, 28, 24], 1);
  canopy.outline(line);
  p.paste(canopy, 0, 0);
  if (cherry || shape === "maple") {
    // a few petals / leaves drifting under the tree
    const fall = cherry ? [tones[3], tones[2]] : [tones[2], tones[3], pal.leavesAlt[2]];
    for (let i = 0; i < 4; i++) {
      const x = 5 + Math.floor(hash01(v, i, 3) * 22);
      const y = 30 + Math.floor(hash01(v, i, 4) * 8);
      if (!p.has(x, y)) p.set(x, y, fall[i % fall.length]);
    }
  }
  if (shape === "glow") {
    // glow-fruit get a soft halo
    const halo = new Pix(32, 40);
    p.forEach((x, y) => {
      if (p.hexAt(x, y) === pal.fruit[0]) for (const [dx, dy] of [[-1, 0], [0, -1], [2, 0], [0, 2]]) halo.set(x + dx, y + dy, mix(pal.fruit[0], tones[2], 0.55));
    });
    halo.forEach((x, y) => {
      if (p.has(x, y) && p.hexAt(x, y) !== pal.fruit[0]) p.set(x, y, halo.hexAt(x, y));
    });
  }
  if (pal.snowy) snowCap(p, SNOW, 2, v, 30);
  dropShadow(p, 16, 37, 10, 2.5, SHADOW);
  return { pix: p, ax: 16, ay: 40 };
}

function pineTree(pal: ThemePalette, v: number, alt: boolean): PropArt {
  const p = new Pix(32, 40);
  trunk(p, 16, 30, 37, pal.trunk, 4);
  const tones = alt ? pal.leavesAlt : pal.leaves;
  const line = alt ? pal.leavesAltLine : pal.leavesLine;
  const crown = new Pix(32, 40);
  const tall = v % 3;
  pineTiers(crown, 16, 1 + tall, 32 - tall, 22 + (v % 2) * 2, tones.slice(1), { tiers: 3 + (v % 2), snow: pal.snowy ? SNOW : undefined, seed: v });
  if (pal.lit) dots(crown, pal.fruit, v + 2, 4, [8, 8, 24, 30], 1);
  crown.outline(line);
  p.paste(crown, 0, 0);
  dropShadow(p, 16, 37, 8, 2.5, SHADOW);
  return { pix: p, ax: 16, ay: 40 };
}

function palmTree(pal: ThemePalette, v: number, bushy: boolean): PropArt {
  const p = new Pix(32, 44);
  const lean = v % 2 ? -1 : 1;
  const r = ramp(pal.trunk);
  const baseY = 41;
  const height = bushy ? 14 : 28 - (v % 3) * 2;
  const top = baseY - height;
  const crownX = 16 + lean * (bushy ? 1 : 4);
  // a curved trunk made of ringed segments
  for (let y = baseY; y >= top; y--) {
    const t = (baseY - y) / height;
    const cx = Math.round(16 + lean * (bushy ? 1 : 4) * t * t);
    const ring = (baseY - y) % 3 === 0;
    for (let dx = -2; dx <= 1; dx++) p.set(cx + dx, y, ring ? r.lo : dx === -2 ? r.hi : dx === 1 ? r.lo : r.base);
    if (ring) p.set(cx - 2, y, r.base);
  }
  const trunkPix = p.clone();
  trunkPix.outline(r.line);
  trunkPix.paste(p, 0, 0);
  const crown = new Pix(32, 44);
  const fr = pal.leaves;
  const frondTones = [fr[1], fr[2], fr[3]];
  const backTones = [fr[0], fr[1], fr[2]];
  const cy = top + 1;
  const fronds: [number, number, number, boolean][] = [
    // angle (deg), length, droop, back layer?
    [-160, 11, 1.1, true],
    [-25, 11, 1.1, true],
    [-120, 8, 0.4, true],
    [-70, 8, 0.5, true],
    [180, 13, 1.4, false],
    [0, 13, 1.4, false],
    [150, 10, 2.2, false],
    [30, 10, 2.2, false],
  ];
  for (const [deg, len, droop, back] of fronds) {
    palmFrond(crown, crownX, cy, (deg * Math.PI) / 180, bushy ? len * 0.95 : len, droop, back ? backTones : frondTones);
  }
  crown.outline(pal.leavesLine);
  p.data.fill(0);
  p.paste(trunkPix, 0, 0);
  p.paste(crown, 0, 0);
  // coconuts
  const nut = pal.fruit[0];
  for (const [dx, dy] of [[-2, 2], [1, 2], [-1, 3]]) {
    p.set(crownX + dx, cy + dy, nut);
    p.set(crownX + dx + 1, cy + dy, shade(nut, 0.15));
  }
  p.set(crownX - 2, cy + 2, light(nut, 0.15));
  dropShadow(p, 16 + lean * 2, 41, 9, 2.5, SHADOW);
  return { pix: p, ax: 16, ay: 44 };
}

function frostTree(pal: ThemePalette, v: number): PropArt {
  const p = new Pix(32, 40);
  trunk(p, 16, 24, 37, pal.trunk, 4);
  const canopy = new Pix(32, 40);
  const blobs = ROUND_CANOPIES[v % ROUND_CANOPIES.length];
  // dark evergreen underneath, then frost clumps on top
  litBlobs(canopy, blobs, pal.leaves.slice(0, 4), { dither: 0.5 });
  const frost = blobs.map((b) => ({ x: b.x - 1, y: b.y - 1.5, rx: b.rx - 1.2, ry: (b.ry ?? b.rx) - 2 }));
  litBlobs(canopy, frost, pal.leavesAlt, { dither: 0.6, rim: false });
  dots(canopy, [pal.fruit[0]], v, 3, [6, 8, 26, 24], 1);
  canopy.outline(pal.leavesLine);
  p.paste(canopy, 0, 0);
  dropShadow(p, 16, 37, 10, 2.5, SHADOW);
  return { pix: p, ax: 16, ay: 40 };
}

/** `tree` and `treeAlt` for any theme. Three variants each. */
export function treeArt(pal: ThemePalette, alt: boolean, v: number): PropArt {
  const shape = pal.trees[alt ? 1 : 0];
  switch (shape) {
    case "pine":
      return pineTree(pal, v, alt && pal.id !== "night" && pal.id !== "snow");
    case "palm":
      return palmTree(pal, v, false);
    case "bushyPalm":
      return palmTree(pal, v, true);
    case "frost":
      return frostTree(pal, v);
    default:
      return roundTree(pal, shape, v, alt);
  }
}

export function bushArt(pal: ThemePalette, v: number): PropArt {
  const p = new Pix(18, 16);
  const useAlt = pal.id === "sakura" || pal.id === "beach" || pal.id === "snow";
  const tones = useAlt && pal.id !== "snow" ? pal.leavesAlt : pal.leaves;
  const line = useAlt && pal.id !== "snow" ? pal.leavesAltLine : pal.leavesLine;
  const layouts: Blob[][] = [
    [
      { x: 6, y: 7, rx: 4.5, ry: 4 },
      { x: 12, y: 6.5, rx: 4.5, ry: 4 },
      { x: 9, y: 10, rx: 6.5, ry: 3.5 },
    ],
    [
      { x: 9, y: 6, rx: 5, ry: 4.5 },
      { x: 5, y: 9.5, rx: 4, ry: 3.5 },
      { x: 13, y: 9.5, rx: 4, ry: 3.5 },
    ],
    [
      { x: 7, y: 7, rx: 5, ry: 4.5 },
      { x: 12.5, y: 8.5, rx: 4, ry: 4 },
      { x: 8, y: 11, rx: 6, ry: 2.5 },
    ],
  ];
  litBlobs(p, layouts[v % 3], tones, { dither: 0.6 });
  leafTexture(p, tones, v + 17, 0.12);
  if (v % 3 === 1) dots(p, pal.id === "sakura" ? pal.fruit : ["#e8404f", "#ff6b7a"], v, 4, [2, 3, 16, 12], 1);
  if (v % 3 === 2) dots(p, [pal.flowers[v % pal.flowers.length]], v + 3, 3, [3, 3, 15, 11], 1);
  p.outline(line);
  if (pal.snowy) snowCap(p, SNOW, 2, v);
  dropShadow(p, 9, 14, 7, 1.5, SHADOW);
  return { pix: p, ax: 9, ay: 16 };
}

export function rockArt(pal: ThemePalette, v: number): PropArt {
  const p = new Pix(18, 14);
  const s = pal.stone;
  const tones = [shade(s, 0.3), shade(s, 0.18), shade(s, 0.07), light(s, 0.04), light(s, 0.12)];
  const layouts: Blob[][] = [
    [
      { x: 9, y: 8.5, rx: 6.5, ry: 3.5 },
      { x: 7.5, y: 6.5, rx: 4.5, ry: 3 },
    ],
    [
      { x: 6.5, y: 7.5, rx: 4.5, ry: 3.5 },
      { x: 12.5, y: 9.5, rx: 3, ry: 2.2 },
    ],
    [
      { x: 9, y: 9, rx: 7, ry: 2.8 },
      { x: 10, y: 7, rx: 3.5, ry: 2 },
    ],
  ];
  litBlobs(p, layouts[v % 3], tones, { dither: 0.3 });
  // a flat, sunlit top face and a crack make it read as stone, not an egg
  const top = Math.min(...[...Array(18).keys()].flatMap((x) => [...Array(14).keys()].filter((y) => p.has(x, y))));
  for (let x = 0; x < 18; x++) {
    for (let y = top; y < top + 2; y++) if (p.has(x, y) && p.has(x, y - 1) === false && x > 3 && x < 12) p.set(x, y, tones[4]);
  }
  for (const [x, y] of [[10, 7], [11, 8], [11, 9]]) if (p.has(x, y)) p.set(x, y, tones[0]);
  if (v % 3 === 2 && !pal.snowy) {
    for (const [x, y] of [[5, 7], [6, 6], [7, 6], [6, 7], [8, 6]]) if (p.has(x, y)) p.set(x, y, pal.id === "night" ? "#5aa08a" : "#7bb35a");
  }
  p.outline(ramp(s).line);
  if (pal.snowy) snowCap(p, SNOW, 2, v + 1);
  dropShadow(p, 9, 12, 7, 1.5, SHADOW);
  return { pix: p, ax: 9, ay: 14 };
}

const FLOWER_GRIDS = [
  [
    "..............",
    "...a.......b..",
    "..aca.....bcb.",
    "...a.......b..",
    "...g...a...g..",
    "...g..aca..g..",
    "..gg...a..gg..",
    "...g...g..g...",
    "...gl..g.lg...",
    "....g.lg.g....",
    "....g..gg.....",
    ".....ggg......",
  ],
  [
    "..............",
    ".....aaa......",
    "....aacaa.....",
    ".....aaa..b...",
    "......g..bcb..",
    "....l.g...b...",
    "....lgg...g...",
    "......g..lg...",
    "......g.lgg...",
    ".......gg.....",
  ],
];

export function flowerArt(pal: ThemePalette, v: number): PropArt {
  const grid = FLOWER_GRIDS[v % 2];
  const a = pal.flowers[v % pal.flowers.length];
  const b = pal.flowers[(v + 2) % pal.flowers.length];
  const stem = pal.id === "snow" ? "#5a9a7a" : pal.id === "night" ? "#4a8a8a" : shade(pal.leaves[2], 0.05);
  const leaf = pal.id === "night" ? "#5aa0a0" : pal.leaves[3];
  const src = Pix.fromGrid(grid, { a, b, c: pal.flowerCenter, g: stem, l: leaf });
  src.outline(mix(shade(stem, 0.35), "#2b1d34", 0.5));
  const p = new Pix(16, 16);
  p.paste(src, 1, 16 - src.h - 1);
  if (pal.snowy) p.set(4, 16 - src.h, "#ffffff");
  return { pix: p, ax: 8, ay: 16 };
}

const MUSHROOM_GRID = [
  ".....cccc.......",
  "...ccwcccc......",
  "..ccccccwcc.....",
  "..cwccccccc.....",
  ".CCCCcccCCCC....",
  "..RRRRRRRRR.....",
  "....ssss...cc...",
  "....ssss..cwcc..",
  "....sSss.CCCCC..",
  "...ssssss.sss...",
];

const PUMPKIN_GRID = [
  "......sl........",
  ".....sll........",
  "..oooso.oo......",
  ".oOooooooOo.....",
  "oOoOoOooOoOo..l.",
  "oOoOoOooOoOo.olo",
  "oOoOoOooOoOoooOo",
  "oOoOoOooOoOoOoOo",
  ".oOoOooOoOoooOo.",
  "..dddddddddd.dd.",
];

const SHELL_GRID = [
  "......pp........",
  ".....pwpp.......",
  "....pwpppp......",
  "...pwpPpppp.....",
  "..pwppPpppPp....",
  "..pppppPppPpp...",
  "..ppPppPpppPpp..",
  "...PPpPpPPpp....",
  ".....PPP........",
  "..........sss...",
  ".........ss.ss..",
];

export function mushroomArt(pal: ThemePalette, v: number): PropArt {
  let src: Pix;
  switch (pal.mushroom) {
    case "pumpkin":
      src = Pix.fromGrid(PUMPKIN_GRID, { o: "#f08a2e", O: "#d0601f", s: "#6a8a3a", l: "#8ab84a", d: "#a8481c" });
      src.outline("#5a2a1e");
      break;
    case "shell":
      src = Pix.fromGrid(SHELL_GRID, { p: "#ffc6c6", P: "#f08a9a", w: "#ffffff", s: "#ff9b6a" });
      src.outline("#8a4a5a");
      break;
    default: {
      const caps: Record<string, [string, string]> = {
        toadstool: ["#e8463c", "#fff8ee"],
        pinkcap: ["#f27aa8", "#fff0f5"],
        frost: ["#5aa6e0", "#ffffff"],
        glowcap: ["#3ce0d0", "#e8fff8"],
      };
      const [cap, spot] = caps[pal.mushroom] ?? caps.toadstool;
      src = Pix.fromGrid(MUSHROOM_GRID, { c: cap, C: shade(cap, 0.14), w: spot, R: "#c9b39a", s: "#fff1dc", S: "#e2cfb6" });
      if (pal.mushroom === "glowcap") src.forEach((x, y) => src.hexAt(x, y) === spot && src.set(x, y, "#ffffff"));
      src.outline(mix(shade(cap, 0.4), "#2b1d34", 0.5));
      if (pal.snowy) snowCap(src, SNOW, 1, v);
    }
  }
  const p = new Pix(16, 14);
  p.paste(v % 2 ? src.flippedX() : src, 0, 14 - src.h - 1);
  dropShadow(p, 8, 12, 6, 1.5, SHADOW);
  return { pix: p, ax: 8, ay: 14 };
}

const STUMP_GRID = [
  "...bbbbbbbb....",
  "..brrrrrrrrb...",
  ".brrRRRRRrrrb..",
  ".brRrrrrrRrrB..",
  ".brrRRRRRrrrB..",
  "..brrrrrrrrB...",
  ".hbbbbbbbbbBB..",
  ".hbbbdbbbbbBB..",
  ".hbbbdbbbdbBB..",
  ".hbbbbbbbdbBB..",
  "hhbbbbbbbbbBBB.",
  "hb..hbbbbb..BB.",
];

export function stumpArt(pal: ThemePalette, v: number): PropArt {
  const r = ramp(pal.trunk);
  const ring = mix(pal.trunk, "#f4d9a8", 0.55);
  const src = Pix.fromGrid(STUMP_GRID, { r: ring, R: shade(ring, 0.16), b: r.base, B: r.lo, h: r.hi, d: r.lo2 });
  src.outline(r.line);
  if (pal.snowy) snowCap(src, SNOW, 2, v);
  const p = new Pix(16, 14);
  p.paste(v % 2 ? src.flippedX() : src, 1, 14 - src.h - 1);
  dropShadow(p, 8, 12, 6, 1.5, SHADOW);
  return { pix: p, ax: 8, ay: 14 };
}
