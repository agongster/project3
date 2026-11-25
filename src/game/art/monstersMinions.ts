/**
 * Minion monsters (16×16): Dust Bunny, Todo Mite and Echo Bat.
 *
 * Every grid is drawn facing RIGHT and WITHOUT its outer outline
 * (`outlined()` adds it). Letters used in most monster grids:
 *   h highlight · b body · s shade · d deep shade · k ink · w white
 * plus a few per-monster accent letters listed next to each palette.
 */
import { INK } from "./color";
import { Pix } from "./engine";
import { BASE_PAL, outlined, placeBottom, squashRows, trim } from "./uiKit";

// ───────────────────────────── Dust Bunny ─────────────────────────────

/** Lilac-grey fluff. p = pink (inner ear, blush), m = mouth, c = eye reflection. */
const BUNNY_PAL = { h: "#f3eefa", b: "#cbc2e0", s: "#a39ac3", d: "#7d73a3", p: "#ff9ec4", m: "#a8507e", c: "#8a7fb8" };

const BUNNY = [
  "....hb....hb..",
  ".....hp..hp...",
  ".....hp..hp...",
  "..hhhhbbbbbbh.",
  ".hhhbbhbbbbbbs",
  "hhhbbbwkbbwkbs",
  "hhbbbbkkbbkkbs",
  "hhbhbbkcbbkcbs",
  "hbbbbpbbmbbpbs",
  "hbbbbbbbbbbbsd",
  "sbbsbbbbbbbbsd",
  ".sbbbbbsbbbsd.",
  "ss.ss.ss.ss.s.",
];

/** 2 frames: rest, squash (the body loses a row, so it looks like it is about to hop). */
export function dustBunny(frame: number): Pix {
  const rows = frame % 2 === 0 ? BUNNY : squashRows(BUNNY, 9);
  return placeBottom(outlined(rows, BUNNY_PAL), 16, 16);
}

// ───────────────────────────── Todo Mite ─────────────────────────────

/** Blue beetle carrying a stolen sticky note. y/Y/l = note, f = folded corner, e/E = head & legs, a = antennae. */
const MITE_PAL = {
  h: "#a6e2fa",
  b: "#4ea8dc",
  s: "#3577b8",
  d: "#2b4f8a",
  e: "#46386a",
  E: "#6a5a94",
  y: "#ffe46b",
  Y: "#f3c54a",
  l: "#d99a3a",
  f: "#fff6c2",
  a: INK,
};

const MITE = [
  "..yyyyyyyyf...",
  "..yllllyyYff..",
  "..yyyyyyyyYY..",
  "..ylllllyyYY..",
  "..yyyyyyyyYY..",
  "..YYYYYYYYYY..",
  "...e.....E..a.",
  "..hhbbs..EE.a.",
  ".hhbbbbsEEEEE.",
  ".hbhbbbsEwkwke",
  "sbbbbbbseEEEEe",
  ".ssssssdeeeee.",
  "..e.e.e..e.e..",
];

const MITE_LEGS_B = "...e.e.e.e.e..";

/** 2 frames: legs scuttle and the note bobs. */
export function todoMite(frame: number): Pix {
  const rows = frame % 2 === 0 ? MITE : [...MITE.slice(0, -1), MITE_LEGS_B];
  return placeBottom(outlined(rows, MITE_PAL, { after: "a" }), 16, 16, frame % 2);
}

// ───────────────────────────── Echo Bat ─────────────────────────────

/** Round purple bat. m = wing membrane, M = wing bones, f = fang, c = belly. */
const BAT_PAL = { h: "#c9a2f7", b: "#8f66d6", s: "#6a47b0", d: "#4e3390", m: "#a77ee8", M: "#5b3a9e", f: "#ffffff", c: "#dcc6fb" };

/** The round body with ears, eyes, mouth and two tiny fangs. */
const BAT_BODY = [
  ".h....h.",
  ".hb..hb.",
  "hhbbbbbs",
  "hbbbbbbs",
  "hbwkbwks",
  "hbkkbkks",
  "hbbkkkbs",
  "sbbfbfbs",
  ".sccccs.",
  "..ssss..",
];

/** The LEFT wing (the right one is the same grid mirrored), raised and lowered. */
const WING_UP = ["M....", "mM...", "mmM..", "mmmMM", ".mmmM", "..m.m"];
const WING_DOWN = ["....M", "..MMM", ".MmmM", "Mmmm.", "mmm..", "m.m.."];

/** 2 frames: wings up, wings down. Hovers 3 px above the ground (it flies). */
export function echoBat(frame: number): Pix {
  const up = frame % 2 === 0;
  const p = new Pix(16, 14);
  const pal = { ...BASE_PAL, ...BAT_PAL };
  const wing = up ? WING_UP : WING_DOWN;
  const wy = up ? 1 : 4;
  p.stamp(wing, pal, 1, wy);
  p.stamp(wing, pal, 10, wy, { flipX: true });
  p.stamp(BAT_BODY, pal, 4, up ? 2 : 3);
  p.outline(INK);
  return placeBottom(trim(p), 16, 16, up ? 3 : 2);
}
