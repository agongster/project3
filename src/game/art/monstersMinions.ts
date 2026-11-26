/**
 * Minion monsters (16×16): Dust Bunny, Todo Mite and Echo Bat.
 *
 * Every grid is drawn facing RIGHT and WITHOUT its outer outline
 * (`outlined()` adds it). Letters used in most monster grids:
 *   h highlight · b body · s shade · d deep shade · k ink · w white
 * plus a few per-monster accent letters listed next to each palette
 * (monstersPalettes.ts).
 *
 * Each painter takes the monster's LOOK (src/lib/game/monsterLooks.ts):
 * `family` picks the palette, `feature` swaps a few rows of the grid
 * (ears, antennae, fangs), `marking` paints spots or stripes on the body.
 */
import type { MonsterLook } from "@/lib/game/monsterLooks";
import { INK } from "./color";
import { Pix } from "./engine";
import { markBody } from "./monstersMarkings";
import { BAT_FAMILIES, BUNNY_FAMILIES, MITE_FAMILIES } from "./monstersPalettes";
import { BASE_PAL, outlined, placeBottom, squashRows, trim } from "./uiKit";

/** A copy of `grid` whose rows from `start` on are replaced by `rows` (a feature variant). */
export function withRows(grid: readonly string[], start: number, rows: readonly string[]): string[] {
  const out = [...grid];
  rows.forEach((row, i) => (out[start + i] = row));
  return out;
}

// ───────────────────────────── Dust Bunny ─────────────────────────────

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

/** The ear rows (0–2) per feature: perky (as drawn), one ear flopped forward, little round nubs. */
const BUNNY_EARS: readonly (readonly string[])[] = [
  BUNNY.slice(0, 3),
  ["....hb........", ".....hp..hhbbs", ".....hp..hp..."],
  ["..............", "..............", "....hpb..hpb.."],
];

/** The squash frame loses this row of the body. */
const BUNNY_SQUASH_ROW = 9;

/** 2 frames: rest, squash (the body loses a row, so it looks like it is about to hop). */
export function dustBunny(frame: number, _disguised: boolean, look: MonsterLook): Pix {
  const pal = BUNNY_FAMILIES[look.family];
  const grid = withRows(BUNNY, 0, BUNNY_EARS[look.feature]);
  const rows = frame % 2 === 0 ? grid : squashRows(grid, BUNNY_SQUASH_ROW);
  return markBody(placeBottom(outlined(rows, pal), 16, 16), look.marking, pal);
}

// ───────────────────────────── Todo Mite ─────────────────────────────

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

/** Rows 3–7 per feature: short straight antennae (as drawn), or a tall antenna curling over like a question mark. */
const MITE_ANTENNAE: readonly (readonly string[])[] = [MITE.slice(3, 8), ["..ylllllyyYYaa", "..yyyyyyyyYY.a", "..YYYYYYYYYYa.", "...e.....E..a.", "..hhbbs..EE.a."]];
const MITE_ANTENNA_ROW = 3;

const MITE_LEGS_B = "...e.e.e.e.e..";

/** 2 frames: legs scuttle and the note bobs. */
export function todoMite(frame: number, _disguised: boolean, look: MonsterLook): Pix {
  const pal = MITE_FAMILIES[look.family];
  const grid = withRows(MITE, MITE_ANTENNA_ROW, MITE_ANTENNAE[look.feature]);
  const rows = frame % 2 === 0 ? grid : [...grid.slice(0, -1), MITE_LEGS_B];
  return markBody(placeBottom(outlined(rows, pal, { after: "a" }), 16, 16, frame % 2), look.marking, pal);
}

// ───────────────────────────── Echo Bat ─────────────────────────────

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

/** The body per feature: pointy ears (as drawn), round mouse-like ears, fangs that reach over the belly. */
const BAT_BODIES: readonly (readonly string[])[] = [BAT_BODY, withRows(BAT_BODY, 0, [".hh..hh.", "hbb..bbs"]), withRows(BAT_BODY, 8, [".scfcfs."])];

/** The LEFT wing (the right one is the same grid mirrored), raised and lowered. */
const WING_UP = ["M....", "mM...", "mmM..", "mmmMM", ".mmmM", "..m.m"];
const WING_DOWN = ["....M", "..MMM", ".MmmM", "Mmmm.", "mmm..", "m.m.."];

/** 2 frames: wings up, wings down. Hovers 3 px above the ground (it flies). */
export function echoBat(frame: number, _disguised: boolean, look: MonsterLook): Pix {
  const up = frame % 2 === 0;
  const p = new Pix(16, 14);
  const pal = { ...BASE_PAL, ...BAT_FAMILIES[look.family] };
  const wing = up ? WING_UP : WING_DOWN;
  const wy = up ? 1 : 4;
  p.stamp(wing, pal, 1, wy);
  p.stamp(wing, pal, 10, wy, { flipX: true });
  p.stamp(BAT_BODIES[look.feature], pal, 4, up ? 2 : 3);
  p.outline(INK);
  return markBody(placeBottom(trim(p), 16, 16, up ? 3 : 2), look.marking, pal);
}
