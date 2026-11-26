/**
 * Lair marks: the little signs that say "a boss (or a champion) lives here".
 *
 *   lairBadgeSprite(kind)          over a building's roof, bobbing (instead of the plain skull)
 *   lairBannerSprite(kind, frame)  a pennant standing on the roof, fluttering
 *   mapMarkSprite(kind)            on the minimap, the big map and the treemap
 *   championCrownSprite(frame)     on a champion monster's head
 *
 * A boss lair is RED with a horned skull; a champion's is GOLD with a crown,
 * everywhere, so the two read apart at a glance. Grids follow the usual
 * convention (uiKit.ts): drawn without their outer outline, `outlined()`
 * adds it. Everything is cached and nothing touches `document` until a
 * sprite is first requested.
 */
import { INK } from "./color";
import { cached, mod, Pix, type Sprite } from "./engine";
import { outlined } from "./uiKit";

export type LairMarkKind = "boss" | "champion";
export const LAIR_BANNER_FRAMES = 2;
export const CROWN_FRAMES = 2;

/** Bone white skull with red horns; r/R = red light / dark, e = a red glint in the eye. */
const SKULL_PAL = { w: "#f6efe0", W: "#d8ccb4", r: "#ff5a5a", R: "#b8283a", e: "#ff5a5a" };
/** Gold crown; g/G = gold light / dark, j/J = ruby / emerald, s = shine. */
const CROWN_PAL = { g: "#ffd34d", G: "#d99a2b", j: "#ff4a6a", J: "#4ad98a", s: "#fff8d0" };

/** The boss badge: a horned skull (9×8, 11×10 with its outline). */
const HORNED_SKULL = [
  "r.......r",
  "Rr.....rR",
  ".RwwwwwR.",
  ".wwwwwwwW",
  ".wkkwkkwW",
  ".wkewkewW",
  "..wwkwwW.",
  "..wkwkW..",
];

/** The champion badge: a crown (9×5, 11×7 with its outline). */
const BADGE_CROWN = ["g...g...g", "gg.gsg.gg", "gGgGjGgGg", "ggJgggjgg", "GGGGGGGGG"];

/** Map marks (5 px wide, 7 with the outline). */
const MAP_SKULL = ["r...r", ".www.", "wkwkw", ".www.", ".w.w."];
const MAP_CROWN = ["g.g.g", "ggggg", "gjgjg", "GGGGG"];

/** The crown a champion wears (7×5, 9×7 with its outline); the shine sits on one point per frame. */
const HEAD_CROWN = ["g..g..g", "gg.g.gg", "gGgggGg", "gjgJgjg", "GGGGGGG"];
const HEAD_CROWN_SHINE: readonly [number, number][] = [
  [0, 0],
  [3, 0],
];

const store = new Map<string, Sprite>();

/** A grid outlined in ink, anchored bottom-centre. */
function badge(rows: readonly string[], pal: Record<string, string>): Sprite {
  const pix = outlined(rows, pal);
  return pix.toSprite(Math.floor(pix.w / 2), pix.h);
}

/** Building badge over the roof: boss = red horned skull, champion = gold crown. Anchor bottom-centre. At most 11×10 px. */
export function lairBadgeSprite(kind: LairMarkKind): Sprite {
  return cached(store, `badge:${kind}`, () => (kind === "boss" ? badge(HORNED_SKULL, SKULL_PAL) : badge(BADGE_CROWN, CROWN_PAL)));
}

// ───────────────────────────── Banner ─────────────────────────────

const BANNER_W = 10;
const BANNER_H = 16;
/** The pole stands in this column; its foot (bottom of the canvas) is the anchor. */
const POLE_X = 2;
const POLE_TOP = 2;
const POLE_COLOR = "#7a5232";
const FINIAL_COLOR = "#ffd34d";
/** Pennant cloth: [main, shadow] per kind. */
const CLOTH: Record<LairMarkKind, [string, string]> = { boss: ["#e5484d", "#a8283a"], champion: ["#ffd34d", "#d99a2b"] };
/**
 * The pennant: a swallow-tailed flag, one row per pixel row starting at the
 * top of the pole, given as [first column, last column] (the notch is a gap).
 * Two frames: the tail lifts and drops in the wind.
 */
const PENNANT_ROWS: readonly (readonly [number, number][])[] = [
  [[3, 8], [3, 8], [3, 7], [3, 7], [3, 8], [3, 5]],
  [[3, 7], [3, 8], [3, 8], [3, 7], [3, 7], [3, 6]],
];
/** The emblem on the cloth (3×3, top-left corner at EMBLEM_AT): a skull for bosses, a crown for champions. */
const EMBLEM_AT = { x: 4, y: 3 };
const EMBLEMS: Record<LairMarkKind, { rows: string[]; pal: Record<string, string> }> = {
  boss: { rows: ["www", "kwk", "w.w"], pal: { w: "#f6efe0", k: INK } },
  champion: { rows: ["g.g", "ggg", "ggg"], pal: { g: "#8a5a1e" } },
};

/** A pennant on a short pole standing on a building's roof, fluttering. Anchor = foot of the pole (column POLE_X, bottom row). At most 10×16 px. */
export function lairBannerSprite(kind: LairMarkKind, frame: number): Sprite {
  const f = mod(frame, LAIR_BANNER_FRAMES);
  return cached(store, `banner:${kind}:${f}`, () => {
    const p = new Pix(BANNER_W, BANNER_H);
    const [cloth, fold] = CLOTH[kind];
    PENNANT_ROWS[f].forEach(([x0, x1], i) => {
      const y = POLE_TOP + i;
      p.hline(x0, x1, y, i % 2 === 0 ? cloth : fold);
      // the swallow tail: a notch in the middle of the fly end
      if (i === 2 || i === 3) p.erase(x1, y);
    });
    p.stamp(EMBLEMS[kind].rows, EMBLEMS[kind].pal, EMBLEM_AT.x, EMBLEM_AT.y);
    p.vline(POLE_X, POLE_TOP, BANNER_H - 1, POLE_COLOR);
    p.set(POLE_X, POLE_TOP - 1, FINIAL_COLOR);
    p.outline(INK);
    return p.toSprite(POLE_X, BANNER_H);
  });
}

/** Tiny icon for the minimap / big map / treemap. Anchor = centre. At most 7×7 px, readable on any terrain (ink outline). */
export function mapMarkSprite(kind: LairMarkKind): Sprite {
  return cached(store, `map:${kind}`, () => {
    const pix = kind === "boss" ? outlined(MAP_SKULL, SKULL_PAL) : outlined(MAP_CROWN, CROWN_PAL);
    return pix.toSprite(Math.floor(pix.w / 2), Math.floor(pix.h / 2));
  });
}

/** The small gold crown a champion monster wears on its head (a glint moves between frames). Anchor bottom-centre. At most 9×7 px. */
export function championCrownSprite(frame: number): Sprite {
  const f = mod(frame, CROWN_FRAMES);
  return cached(store, `crown:${f}`, () => {
    const [sx, sy] = HEAD_CROWN_SHINE[f];
    const rows = HEAD_CROWN.map((row, y) => (y === sy ? row.slice(0, sx) + "s" + row.slice(sx + 1) : row));
    return badge(rows, CROWN_PAL);
  });
}
