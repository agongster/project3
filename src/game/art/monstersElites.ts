/**
 * Elite monsters: Gremlin, Phantom, Mimic, Swallow Toad (16×16) and the
 * Spaghetti Beast (24×24).
 *
 * Grids face RIGHT and leave out the outer outline (`outlined()` adds it).
 * Shared letters: h highlight · b body · s shade · d deep shade · k ink · w white.
 */
import { INK } from "./color";
import { Pix } from "./engine";
import { litBlobs } from "./shapes";
import { outlined, patchRows, placeBottom } from "./uiKit";

// ───────────────────────────── Gremlin ─────────────────────────────

/** Green imp. p = pink inner ear, y = yellow eye. */
const GREM_PAL = { h: "#aee67e", b: "#6cc24a", s: "#4a9a3e", d: "#2f7038", p: "#ff9ec4", y: "#fff6a0" };
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

const WRENCH = ["r..r", "rrRR", ".rR.", ".rR.", ".qq."];

/** 2 frames: wrench held low, wrench raised (the gremlin rises on its toes). */
export function gremlin(frame: number): Pix {
  const up = frame % 2 === 1;
  const body = placeBottom(outlined(GREMLIN, GREM_PAL), 16, 16, up ? 1 : 0);
  body.paste(outlined(WRENCH, WRENCH_PAL), 10, up ? 7 : 9);
  return body;
}

// ───────────────────────────── Phantom ─────────────────────────────

/** Translucent teal ghost (real alpha). o = open mouth, c = blush. */
const PHANTOM_PAL = { h: "#d4fff8d8", b: "#7fe3d6c0", s: "#52bcc4b8", d: "#3a90a8b0", o: "#2b1d34e0", c: "#ffb3d0c0", k: "#2b1d34e8" };
const PHANTOM_LINE = "#1f4e64d8";

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

/** 3 frames: the wavy tail sways while the ghost bobs. */
export function phantom(frame: number): Pix {
  const rows = [...PHANTOM_TOP, ...PHANTOM_TAILS[frame % 3]];
  return placeBottom(outlined(rows, PHANTOM_PAL, { line: PHANTOM_LINE }), 16, 16, [2, 1, 2][frame % 3]);
}

// ───────────────────────────── Mimic ─────────────────────────────

/** Wood-and-gold chest. y/Y = gold, x = dark mouth / seam, e = glowing eye, t/T = tongue, l = keyhole. */
const MIMIC_PAL = { h: "#e0a06a", b: "#b8764a", s: "#8a5236", d: "#64382a", y: "#ffe27a", Y: "#e0a72e", x: "#3a1430", e: "#ffe94d", t: "#ff8ab4", T: "#e0558a", l: "#4a2a2a" };

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

/** 2 frames: jaws wide open, then CHOMP. Disguised: 2 frames of a chest whose glint shifts. */
export function mimic(frame: number, disguised: boolean): Pix {
  if (disguised) return placeBottom(outlined(disguisedRows(frame), MIMIC_PAL), 16, 16);
  return placeBottom(outlined(frame % 2 === 0 ? MIMIC_OPEN : MIMIC_CHOMP, MIMIC_PAL), 16, 16);
}

// ───────────────────────────── Swallow Toad ─────────────────────────────

/** Plump sea-green toad. c/C = cream belly, P = throat sac, x = mouth inside, t = tongue, f = feet. */
const TOAD_PAL = { h: "#8fe0b8", b: "#4cb88e", s: "#358f78", d: "#286a62", c: "#f6ecc0", C: "#dccf98", P: "#ffe0ea", x: "#5a1a3a", t: "#ff7aa8", f: "#358f78" };

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

/** 4 frames: idle → puff → bigger puff → mouth open (spit). */
export function swallowToad(frame: number): Pix {
  const rows = [TOAD, TOAD_PUFF1, TOAD_PUFF2, TOAD_OPEN][frame % 4];
  return placeBottom(outlined(rows, TOAD_PAL), 16, 16);
}

// ───────────────────────────── Spaghetti Beast ─────────────────────────────

/** Noodle tones: gap (between strands) → shade → base → glint. */
const NOODLE = ["#e8b060", "#ffd47a", "#ffeaa8", "#fffbea"];
const SAUCE = ["#ff9a7a", "#ec5a40", "#b83a32"];
const MEAT = ["#c98256", "#9a5636", "#6a3424"];

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
function noodleHeap(wobble: number): Pix {
  const p = new Pix(20, 20);
  p.ellipse(9.5, 10.5, 9.5, 7, NOODLE[1]);
  p.ellipse(9.5, 13, 9.5, 4, NOODLE[1]);
  for (const [cx, cy, r] of LOOPS) {
    const c = { x: cx + (wobble ? Math.sign(cx - 9.5) * 0.4 : 0), y: cy };
    for (let y = Math.floor(c.y - r - 1); y <= c.y + r + 1; y++) {
      for (let x = Math.floor(c.x - r - 1); x <= c.x + r + 1; x++) {
        const d = Math.hypot(x - c.x, y - c.y);
        if (Math.abs(d - r) > 0.5 || !p.has(x, y)) continue;
        const up = (y - c.y) / r < -0.2 || (x - c.x) / r < -0.5; // the lit upper-left side of each ring
        p.set(x, y, up ? NOODLE[3] : NOODLE[2]);
        if (p.hexAt(x, y + 1) === NOODLE[1]) p.set(x, y + 1, NOODLE[0]);
      }
    }
  }
  for (const [x, len] of DANGLES) {
    for (let k = 0; k < len + (wobble && x % 2 ? 1 : 0); k++) p.set(x + (k % 2), 17 + k, k ? NOODLE[1] : NOODLE[2]);
  }
  return p;
}

/**
 * A flailing noodle arm: a 1 px strand from (x0, y0) heading out at `angle`,
 * wiggling side to side (`wave` shifts the wiggle per frame), with a curl.
 */
function noodleArm(p: Pix, x0: number, y0: number, angle: number, len: number, wave: number): void {
  let last: [number, number] = [x0, y0];
  const steps = len * 3;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * len;
    const side = Math.sin(t * 1.3 + wave) * 1.2 * (t / len);
    const x = Math.round(x0 + Math.cos(angle) * t - Math.sin(angle) * side);
    const y = Math.round(y0 + Math.sin(angle) * t + Math.cos(angle) * side);
    p.set(x, y, t / len < 0.5 ? NOODLE[2] : NOODLE[3]);
    last = [x, y];
  }
  // a little curl at the tip
  const dir = Math.sign(Math.cos(angle)) || 1;
  p.set(last[0] + dir, last[1], NOODLE[3]);
  p.set(last[0] + dir, last[1] + 1, NOODLE[2]);
}

/** A meatball eye: an outlined brown ball with a big pupil looking right and a shine. */
function meatEye(): Pix {
  const p = new Pix(7, 7);
  litBlobs(p, [{ x: 3, y: 3, rx: 2 }], [MEAT[2], MEAT[1], MEAT[0]], { dither: 0.3, rim: false });
  p.rect(3, 2, 2, 2, INK);
  p.set(3, 2, "#ffffff");
  p.outline(INK);
  return p;
}

/** 3 frames: the noodle arms flail and the heap wobbles. */
export function spaghetti(frame: number): Pix {
  const f = frame % 3;
  const p = new Pix(24, 24);
  const bob = f === 1 ? 1 : 0;
  p.paste(noodleHeap(f === 2 ? 1 : 0), 2, 3 + bob);
  // two noodle arms waving up out of the shoulders (drawn over the heap's edge)
  const waves = [0, 1.8, 3.6];
  noodleArm(p, 5, 9 + bob, -Math.PI * (0.78 + f * 0.05), 6, waves[f]);
  noodleArm(p, 18, 9 + bob, -Math.PI * (0.22 - f * 0.05), 6, waves[(f + 1) % 3]);
  // a lopsided splat of tomato sauce on the crown, with two drips
  const splat: [number, number, number][] = [
    [10, 5, 0], [11, 5, 0], [12, 5, 1],
    [8, 6, 1], [9, 6, 0], [10, 6, 0], [11, 6, 1], [12, 6, 1], [13, 6, 1], [14, 6, 2],
    [9, 7, 2], [10, 7, 1], [11, 7, 2], [13, 7, 2], [14, 7, 1], [14, 8, 2],
  ];
  for (const [x, y, c] of splat) p.set(x, y + bob, SAUCE[c]);
  p.outline("#5a3424");
  // meatball eyes peek out of the tangle, then a wobbly grin
  p.paste(meatEye(), 5, 8 + bob);
  p.paste(meatEye(), 13, 8 + bob);
  for (const [x, y] of [[10, 16], [11, 17], [12, 17], [13, 17], [14, 16]]) p.set(x, y + bob, MEAT[2]);
  return p;
}
