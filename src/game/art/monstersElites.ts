/**
 * Elite monsters: Gremlin, Phantom, Mimic, Swallow Toad (16×16) and the
 * Spaghetti Beast (24×24).
 *
 * Grids face RIGHT and leave out the outer outline (`outlined()` adds it).
 * Shared letters: h highlight · b body · s shade · d deep shade · k ink · w white.
 *
 * Each painter takes the monster's LOOK (src/lib/game/monsterLooks.ts):
 * `family` picks the palette (monstersPalettes.ts), `feature` swaps a few
 * grid rows (horns, sleepy eyes, a gold tooth, warts, a meatball hat) and
 * `marking` paints spots or stripes on the body (monstersMarkings.ts).
 */
import type { MonsterLook } from "@/lib/game/monsterLooks";
import { INK } from "./color";
import { Pix } from "./engine";
import { markBody } from "./monstersMarkings";
import { withRows } from "./monstersMinions";
import { GREMLIN_FAMILIES, MIMIC_FAMILIES, PASTA_FAMILIES, PHANTOM_FAMILIES, TOAD_FAMILIES, type PastaTones } from "./monstersPalettes";
import { litBlobs } from "./shapes";
import { outlined, patchRows, placeBottom } from "./uiKit";

// ───────────────────────────── Gremlin ─────────────────────────────

/** The wrench: r/R/q = light / mid / dark steel. */
const WRENCH_PAL = { r: "#f4f6fc", R: "#b8c0d8", q: "#7c84a8" };

const GREMLIN = [
  "hh....hhh....s",
  "hphh.hbbbbs.ps",
  ".hpphbbbbbbpps",
  "..hhbbbbbbbbs.",
  "..hbbbbbbbbbs.",
  "..hbyykbyykbs.",
  "..hbyykbyykbs.",
  "..hbkbbbbbkbs.",
  "..hbbkkkkkbbs.",
  "...sbbwbwbbs..",
  "....hbbbbbs...",
  "...hbbbbbbbs..",
  "...sbbbbbbss..",
  "...ss....ss...",
];

/** The head rows (0–2) per feature: big pointy ears (as drawn), or no ears and two little bone horns. */
const GREMLIN_HEADS: readonly (readonly string[])[] = [GREMLIN.slice(0, 3), ["...n........n.", "....nhbbbbsN..", "...hhbbbbbbbs."]];

const WRENCH = ["r..r", "rrRR", ".rR.", ".rR.", ".qq."];

/** 2 frames: wrench held low, wrench raised (the gremlin rises on its toes). */
export function gremlin(frame: number, _disguised: boolean, look: MonsterLook): Pix {
  const up = frame % 2 === 1;
  const pal = GREMLIN_FAMILIES[look.family];
  const grid = withRows(GREMLIN, 0, GREMLIN_HEADS[look.feature]);
  const body = markBody(placeBottom(outlined(grid, pal), 16, 16, up ? 1 : 0), look.marking, pal);
  body.paste(outlined(WRENCH, WRENCH_PAL), 10, up ? 7 : 9);
  return body;
}

// ───────────────────────────── Phantom ─────────────────────────────

const PHANTOM_TOP = [
  ".....hhhh.....",
  "...hhhbbbbb...",
  "..hhbbbbbbbb..",
  "..hbbbbbbbbbs.",
  ".hhbbbwkbwkbs.",
  ".hbbbbkkbkkbs.",
  ".hbbbcbbobbcs.",
  "hhbbbbbbbbbbbs",
  ".hbbbbbbbbbbs.",
  ".sbbbbbbbbbbs.",
];

/** Three tail poses (the tail trails behind, to the left). */
const PHANTOM_TAILS = [
  ["..sbbbbbbbss..", "..ssbbbbbss...", ".ss.sbbss.....", "s.....ss......"],
  ["..sbbbbbbbss..", "...sbbbbbss...", "...ssbbss.....", "..ss..........", ".s............"],
  ["..sbbbbbbbss..", "..sbbbbbbss...", ".ssbbbss......", "ss............"],
];

/** Row 4 per feature: wide-open eyes (as drawn), or sleepy eyes (only the lower lids of row 5 show). */
const PHANTOM_EYES: readonly string[] = [PHANTOM_TOP[4], ".hhbbbbbbbbbs."];
const PHANTOM_EYE_ROW = 4;
/** How high the ghost floats in each tail frame. */
const PHANTOM_BOB = [2, 1, 2];

/** 3 frames: the wavy tail sways while the ghost bobs. */
export function phantom(frame: number, _disguised: boolean, look: MonsterLook): Pix {
  const pal = PHANTOM_FAMILIES[look.family];
  const top = withRows(PHANTOM_TOP, PHANTOM_EYE_ROW, [PHANTOM_EYES[look.feature]]);
  const rows = [...top, ...PHANTOM_TAILS[frame % 3]];
  return markBody(placeBottom(outlined(rows, pal, { line: pal.line }), 16, 16, PHANTOM_BOB[frame % 3]), look.marking, pal);
}

// ───────────────────────────── Mimic ─────────────────────────────

const CHEST_CLOSED = [
  "..hhhhhhhhhh..",
  ".hhbbbbbbbbbs.",
  ".hbbbbbbbbbbs.",
  ".yyyyyyyyyyyY.",
  ".xxxxxyyxxxxx.",
  ".hbbbbylbbbbs.",
  ".hbbbbYYbbbbs.",
  ".hbbbbbbbbbbs.",
  ".sssssssssssd.",
];

/** The disguise: an innocent chest... with one tiny eye-glint peeking out of the seam. */
function disguisedRows(frame: number): string[] {
  return patchRows(CHEST_CLOSED, [frame % 2 === 0 ? ".........e" : "..........e"], 0, 4);
}

const MIMIC_OPEN = [
  ".hhhhhhhhhh...",
  "hhbbbbbbbbbs..",
  "yyyyyyyyyyyY..",
  ".w.w.w.w.w.w..",
  ".xxxxxxxxxxxx.",
  ".xxexxxxxexxx.",
  ".xxxxxxxxxxtt.",
  ".w.w.w.w.wtTtt",
  "yyyyyyyyyyyTt.",
  "hbbbbbYYbbbsT.",
  "hbbbbblYbbbs..",
  "hbbbbbbbbbbs..",
  "ssssssssssssd.",
];

const MIMIC_CHOMP = [
  ".hhhhhhhhhh...",
  "hhbbbbbbbbbs..",
  "yyyyyyyyyyyY..",
  ".w.w.w.w.w.w..",
  ".xxexxxxxexxt.",
  ".w.w.w.w.wtTt.",
  "yyyyyyyyyyyTt.",
  "hbbbbbYYbbbs..",
  "hbbbbblYbbbs..",
  "hbbbbbbbbbbs..",
  "ssssssssssssd.",
];

/** The "gold tooth" feature: three of the white teeth become gold (two on top, one below) in each open frame. */
const GOLD_TEETH = { open: [[5, 3], [7, 3], [3, 7]], chomp: [[5, 3], [7, 3], [3, 5]] } as const;
const GOLD_TOOTH_FEATURE = 1;

/** The open jaws (or the CHOMP) with the look's teeth. */
function mimicJaws(frame: number, feature: number): string[] {
  const chomp = frame % 2 === 1;
  const rows = chomp ? MIMIC_CHOMP : MIMIC_OPEN;
  if (feature !== GOLD_TOOTH_FEATURE) return [...rows];
  return (chomp ? GOLD_TEETH.chomp : GOLD_TEETH.open).reduce<string[]>((grid, [x, y]) => patchRows(grid, ["Y"], x, y), [...rows]);
}

/** 2 frames: jaws wide open, then CHOMP. Disguised: 2 frames of a chest whose glint shifts. */
export function mimic(frame: number, disguised: boolean, look: MonsterLook): Pix {
  const pal = MIMIC_FAMILIES[look.family];
  const rows = disguised ? disguisedRows(frame) : mimicJaws(frame, look.feature);
  return markBody(placeBottom(outlined(rows, pal), 16, 16), look.marking, pal);
}

// ───────────────────────────── Swallow Toad ─────────────────────────────

const TOAD = [
  "...hh...hh....",
  "..hwkh.hwkh...",
  "..hkkbbbkks...",
  ".hhbbbbbbbbs..",
  "hhbbhbbbbbbbs.",
  "hbbbbbbbbbdbs.",
  "hbbbkkkkkkkkk.",
  "hbbbbccccccs..",
  "hbbbcccccccs..",
  "sbbbcCccccs...",
  ".ssssssssss...",
  ".ff......ff...",
];

/** The throat sac swelling up under the jaw (it bulges past the body outline). */
const TOAD_PUFF1 = patchRows(TOAD, ["hbbbbcPPPPs...", "hbbbcPPPPPPs..", "sbbbcPPwPPs..."], 0, 7);
const TOAD_PUFF2 = patchRows(TOAD, ["hbbbbPPPPPPs..", "hbbbPPPPPPPPs.", "sbbbPPPPPwPPs.", ".sssssPPPPPs.."], 0, 7);

/** Mouth wide open, about to spit. */
const TOAD_OPEN = [
  "...hh...hh....",
  "..hwkh.hwkh...",
  "..hkkbbbkks...",
  ".hhbbbbbbbbkk.",
  "hhbbhbbbkxxxx.",
  "hbbbbbkxxxxx..",
  "hbbbbkxxtttx..",
  "hbbbbkxxxxxxx.",
  "hbbbcckxxxxxxx",
  "sbbbcCckkkkkk.",
  ".ssssssssss...",
  ".ff......ff...",
];

/** The "warty" feature: dark bumps on the back, [column, row]; only placed where the grid has plain body. */
const WARTS: readonly [number, number][] = [[5, 3], [9, 3], [7, 4], [3, 5], [8, 5]];
const WARTY_FEATURE = 1;

/** A copy of the grid with warts on the body pixels of the back. */
function withWarts(rows: readonly string[]): string[] {
  return WARTS.reduce<string[]>((grid, [x, y]) => (grid[y]?.[x] === "b" ? patchRows(grid, ["d"], x, y) : grid), [...rows]);
}

/** 4 frames: idle → puff → bigger puff → mouth open (spit). */
export function swallowToad(frame: number, _disguised: boolean, look: MonsterLook): Pix {
  const pal = TOAD_FAMILIES[look.family];
  const pose = [TOAD, TOAD_PUFF1, TOAD_PUFF2, TOAD_OPEN][frame % 4];
  const rows = look.feature === WARTY_FEATURE ? withWarts(pose) : pose;
  return markBody(placeBottom(outlined(rows, pal), 16, 16), look.marking, pal);
}

// ───────────────────────────── Spaghetti Beast ─────────────────────────────

/** Noodle loops [cx, cy, radius] in heap coordinates: overlapping rings read as a tangle. */
const LOOPS: [number, number, number][] = [
  [4, 9, 3.2],
  [9, 6, 3.5],
  [15, 8, 3.2],
  [6, 13, 3],
  [12, 12, 3.4],
  [17, 13, 2.6],
  [2, 14, 2.2],
  [10, 9, 2.4],
];

/** Noodle ends dangling below the heap: [x, length]. */
const DANGLES: [number, number][] = [
  [3, 2],
  [8, 3],
  [13, 2],
  [16, 3],
];

/**
 * The noodle heap (20×19): a dome filled with the dark gap colour, covered
 * in overlapping 1 px noodle rings (lit from the top-left), with a few
 * noodle ends dangling underneath.
 */
function noodleHeap(wobble: number, noodle: PastaTones["noodle"]): Pix {
  const p = new Pix(20, 20);
  p.ellipse(9.5, 10.5, 9.5, 7, noodle[1]);
  p.ellipse(9.5, 13, 9.5, 4, noodle[1]);
  for (const [cx, cy, r] of LOOPS) {
    const c = { x: cx + (wobble ? Math.sign(cx - 9.5) * 0.4 : 0), y: cy };
    for (let y = Math.floor(c.y - r - 1); y <= c.y + r + 1; y++) {
      for (let x = Math.floor(c.x - r - 1); x <= c.x + r + 1; x++) {
        const d = Math.hypot(x - c.x, y - c.y);
        if (Math.abs(d - r) > 0.5 || !p.has(x, y)) continue;
        const up = (y - c.y) / r < -0.2 || (x - c.x) / r < -0.5; // the lit upper-left side of each ring
        p.set(x, y, up ? noodle[3] : noodle[2]);
        if (p.hexAt(x, y + 1) === noodle[1]) p.set(x, y + 1, noodle[0]);
      }
    }
  }
  for (const [x, len] of DANGLES) {
    for (let k = 0; k < len + (wobble && x % 2 ? 1 : 0); k++) p.set(x + (k % 2), 17 + k, k ? noodle[1] : noodle[2]);
  }
  return p;
}

/**
 * A flailing noodle arm: a 1 px strand from (x0, y0) heading out at `angle`,
 * wiggling side to side (`wave` shifts the wiggle per frame), with a curl.
 */
function noodleArm(p: Pix, x0: number, y0: number, angle: number, len: number, wave: number, noodle: PastaTones["noodle"]): void {
  let last: [number, number] = [x0, y0];
  const steps = len * 3;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * len;
    const side = Math.sin(t * 1.3 + wave) * 1.2 * (t / len);
    const x = Math.round(x0 + Math.cos(angle) * t - Math.sin(angle) * side);
    const y = Math.round(y0 + Math.sin(angle) * t + Math.cos(angle) * side);
    p.set(x, y, t / len < 0.5 ? noodle[2] : noodle[3]);
    last = [x, y];
  }
  // a little curl at the tip
  const dir = Math.sign(Math.cos(angle)) || 1;
  p.set(last[0] + dir, last[1], noodle[3]);
  p.set(last[0] + dir, last[1] + 1, noodle[2]);
}

/** A meatball: an outlined, lit brown ball (7×7 with its outline). */
function meatball(meat: PastaTones["meat"]): Pix {
  const p = new Pix(7, 7);
  litBlobs(p, [{ x: 3, y: 3, rx: 2 }], [meat[2], meat[1], meat[0]], { dither: 0.3, rim: false });
  p.outline(INK);
  return p;
}

/** A meatball eye: a meatball with a big pupil looking right and a shine. */
function meatEye(meat: PastaTones["meat"]): Pix {
  const p = meatball(meat);
  p.rect(3, 2, 2, 2, INK);
  p.set(3, 2, "#ffffff");
  return p;
}

/** The "meatball hat" feature: one more meatball sits on the crown, with a dollop of sauce on top. */
const MEATBALL_HAT_FEATURE = 1;
const HAT_AT = { x: 9, y: 0 };
const HAT_DOLLOP: readonly [number, number][] = [[12, 1], [13, 1], [12, 2]];

/** 3 frames: the noodle arms flail and the heap wobbles. */
export function spaghetti(frame: number, _disguised: boolean, look: MonsterLook): Pix {
  const tones = PASTA_FAMILIES[look.family];
  const f = frame % 3;
  const p = new Pix(24, 24);
  const bob = f === 1 ? 1 : 0;
  p.paste(noodleHeap(f === 2 ? 1 : 0, tones.noodle), 2, 3 + bob);
  // two noodle arms waving up out of the shoulders (drawn over the heap's edge)
  const waves = [0, 1.8, 3.6];
  noodleArm(p, 5, 9 + bob, -Math.PI * (0.78 + f * 0.05), 6, waves[f], tones.noodle);
  noodleArm(p, 18, 9 + bob, -Math.PI * (0.22 - f * 0.05), 6, waves[(f + 1) % 3], tones.noodle);
  // a lopsided splat of tomato sauce on the crown, with two drips
  const splat: [number, number, number][] = [
    [10, 5, 0], [11, 5, 0], [12, 5, 1],
    [8, 6, 1], [9, 6, 0], [10, 6, 0], [11, 6, 1], [12, 6, 1], [13, 6, 1], [14, 6, 2],
    [9, 7, 2], [10, 7, 1], [11, 7, 2], [13, 7, 2], [14, 7, 1], [14, 8, 2],
  ];
  for (const [x, y, c] of splat) p.set(x, y + bob, tones.sauce[c]);
  p.outline(tones.line);
  if (look.feature === MEATBALL_HAT_FEATURE) {
    p.paste(meatball(tones.meat), HAT_AT.x, HAT_AT.y + bob);
    for (const [x, y] of HAT_DOLLOP) p.set(x, y + bob, tones.sauce[1]);
  }
  // meatball eyes peek out of the tangle, then a wobbly grin
  p.paste(meatEye(tones.meat), 5, 8 + bob);
  p.paste(meatEye(tones.meat), 13, 8 + bob);
  for (const [x, y] of [[10, 16], [11, 17], [12, 17], [13, 17], [14, 16]]) p.set(x, y + bob, tones.meat[2]);
  return p;
}
