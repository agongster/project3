/**
 * In-hand weapons: what the hero holds and swings.
 *
 *   const s = weaponSprite("bugNet");
 *   drawSprite(ctx, s, handX, handY, { rotation: aim, flipX: facingLeft });
 *
 * Every weapon is drawn POINTING RIGHT (handle on the left, business end on
 * the right). Its anchor (ax, ay) is the GRIP — the pixel the hero's fist
 * closes around — so `rotation` swings it around the hand.
 *
 * Projectiles (thrown ducks, arrows, sparks...) live in weaponsProjectiles.ts
 * and are re-exported from here.
 */
import { INK } from "./color";
import { cached, Pix, type Palette, type Sprite } from "./engine";
import { BASE_PAL } from "./uiKit";
import { DUCK, GOLD, GOLDEN_DUCK, STEEL, WOOD } from "./weaponsPalettes";

export { PROJECTILE_FRAMES, projectileSprite, type ProjectileName } from "./weaponsProjectiles";

/** A weapon drawing: grid + palette + grip position (in grid coordinates). */
interface WeaponArt {
  rows: string[];
  pal: Palette;
  grip: [number, number];
  /** Outline colour (defaults to ink); glowing blades use a soft colour instead. */
  line?: string;
}

// ───────────────────────────── the weapons ─────────────────────────────

/** A crooked stick with one brave leaf. g/G = leaf. */
const TWIG: WeaponArt = {
  rows: [
    "...........gG..",
    "..........gGG..",
    ".........h.....",
    "hhhhhhhhhbhhh..",
    "bbbbbbbbbbbbbbs",
    "ss.sss..ssss...",
  ],
  pal: { ...WOOD, g: "#8fdc5a", G: "#4fa83e" },
  grip: [2, 4],
};

/** A long handle and a big round net. n = mesh, r/R = hoop. */
const BUG_NET: WeaponArt = {
  rows: [
    "..............rrrr...",
    "............rrnnnnRR.",
    "...........rn.n.n.nR.",
    "...........rnnnnnnnnR",
    "..........rn.n.n.n.nR",
    "hhhhhhhhhhRnnnnnnnnnR",
    "bbbbbbbbbbbRn.n.n.nR.",
    "sssssssssss.RnnnnnR..",
    "..............RRR....",
  ],
  pal: { ...WOOD, r: "#ff8fb1", R: "#d9577e", n: "#ffffffb0" },
  grip: [2, 6],
};

/** A clacky keyboard held by one end. c = keycap, g = gap, r = red Esc, e = green Enter. */
const KEYBOARD: WeaponArt = {
  rows: [
    "hhhhhhhhhhhhhhhhh",
    "hrgcgcgcgcgcgcgcs",
    "hcgcgcgcgcgcgceeb",
    "hgcgcgcgcgcgcgces",
    "hcccgccccccgcccgs",
    "sssssssssssssssss",
  ],
  pal: { h: "#a9a2c9", b: "#7d76a3", s: "#5a5480", c: "#f4f1ff", g: "#4a4470", r: "#ff5a6e", e: "#7dff8a" },
  grip: [1, 3],
};

/** A lint roller: plastic handle and a sticky paper roll (with a few caught fuzzballs). */
const LINT_ROLLER: WeaponArt = {
  rows: [
    "...........hhhhh.",
    "..........hWWpWWs",
    "..........hWWWWWs",
    "BBBBBBBBBBbWWWWWs",
    "ccccccccccbWWWfWs",
    "dddddddddd.WWWWWs",
    "..........hWpWWWs",
    "...........sssss.",
  ],
  pal: { B: "#8fc9ff", c: "#4a90e2", d: "#2f62a8", h: "#ffffff", W: "#efeaf6", s: "#b9b0d0", b: "#7d86a8", p: "#c9a6f2", f: "#ffb3cd" },
  grip: [2, 4],
};

/** The rubber duck, held up proudly. k = eye. */
const DUCK_ROWS = [
  "...wyy...",
  "..wyyyy..",
  "..yykyyoo",
  "y.yyyyyOo",
  "yyyyyyyy.",
  "yYyyyyYy.",
  ".YYYYYY..",
];
const RUBBER_DUCK: WeaponArt = { rows: DUCK_ROWS, pal: DUCK, grip: [2, 5] };
const GOLDEN_DUCK_W: WeaponArt = { rows: DUCK_ROWS, pal: GOLDEN_DUCK, grip: [2, 5] };

/** A crisp black-handled sword with ruler ticks on the blade (88 columns of consistency). */
const FORMATTER_BLADE: WeaponArt = {
  rows: [
    ".......Y...........",
    ".......YWhhhhhhhhh.",
    "okkkkkkYhbtbbtbbtbbh",
    ".......Ybbbbbbbbbs.",
    ".......Ysssssssss..",
    ".......o...........",
  ],
  pal: { ...STEEL, ...GOLD, k: "#3a3450", t: "#7d86a8" },
  grip: [3, 2],
};

/** A bow drawn back, arc bulging forward (right). The string is on the left. */
const TYPE_BOW: WeaponArt = {
  rows: [
    "hb....",
    "w.bb..",
    "w...b.",
    "w...bs",
    "w....b",
    "w....b",
    "w...gg",
    "w...gg",
    "w....b",
    "w....b",
    "w...bs",
    "w...b.",
    "w.bb..",
    "hb....",
  ],
  pal: { h: "#9fd0ff", b: "#4a90e2", s: "#2f62a8", w: "#fff8e8", g: "#ffd34d" },
  grip: [4, 7],
};

/** A git-orange boomerang with a little commit graph painted on it. c = commit dot, l = branch line. */
const GIT_BOOMERANG: WeaponArt = {
  rows: [
    "hhh.......",
    "hbbb......",
    ".bcbb.....",
    "..blbbb...",
    "...bcbbbb.",
    "...bblcbbs",
    "...bcbbbs.",
    "..blbss...",
    ".bcbs.....",
    "bbss......",
    "ss........",
  ],
  pal: { h: "#ffc08a", b: "#f08c3a", s: "#c0602a", c: "#ffffff", l: "#fff1d6" },
  grip: [1, 1],
};

/** A big refactoring mallet. m/M = steel head, Y = gold band, k = "{ }" engraving. */
const REFACTOR_HAMMER: WeaponArt = {
  rows: [
    "...........hhhhh.",
    "..........hmmmmmM",
    "..........hmkmkmM",
    "..........hmkmkmM",
    "hhhhhhhhhhYYYYYYY",
    "bbbbbbbbbbYyyyyyY",
    "sssssssssshmmmmmM",
    "..........hmkmkmM",
    "..........hmmmmmM",
    "...........MMMMM.",
  ],
  pal: { ...WOOD, ...GOLD, m: "#b9c2db", M: "#7d86a8", k: "#5d6488" },
  grip: [2, 5],
};

/** A slim wand topped with a red "breakpoint" orb. r/R/q = orb, x = sparkle. */
const DEBUG_WAND: WeaponArt = {
  rows: [
    "...........x...",
    "..........rrr..",
    "..........rrrRx",
    "hhhhhhhhhhqrRR.",
    "bbbbbbbbbbbqRq.",
    "...........x...",
  ],
  pal: { h: "#a990e0", b: "#5c4bb0", r: "#ff7a8a", R: "#e83a50", q: "#a8283c", x: "#fff1a0" },
  grip: [2, 4],
};

/** A whip whose lash is a blue-and-yellow python, ending in a smiling snake head. */
const PYTHON_WHIP: WeaponArt = {
  rows: [
    "................yyy..",
    "..............bbyykyr",
    "hhhhhh..bbyy.byyyyy..",
    "dddddddbbyybbyyY.....",
    "dddddd.Byy.BBY.......",
    "........YY...........",
  ],
  pal: { h: "#c58a5a", d: "#7a4a32", b: "#4a7ae2", B: "#2f52a8", y: "#ffd84a", Y: "#d9a42e", r: "#ff5a8a" },
  grip: [2, 3],
};

/** A curved saber whose blade glows in two colours that merge at the tip. a/A = teal, v/V = violet, w = white-hot core. */
const MERGE_SABER: WeaponArt = {
  rows: [
    "........aaaaaaa.......",
    "......Yawwwwwwwaaa....",
    "kkkkkkYwwwwwwwwwwwvvv.",
    "......YvvwwwwwwwwwvvV.",
    "........vvvvvvvvvV....",
  ],
  pal: { k: "#3a3450", Y: "#ffd34d", a: "#5cf2e0", A: "#2fb8c0", v: "#c77dff", V: "#9a4ae0", w: "#ffffff" },
  grip: [3, 2],
  line: "#3a2a60",
};

/** A tall wooden staff with a jade ring (an ensō) and a tassel. j/J = jade, t = tassel. */
const ZEN_STAFF: WeaponArt = {
  rows: [
    "..................jjj..",
    ".................jJ.Jj.",
    "hhhhhhhhhhhhhhhhhj...J.",
    "bbbbbbbbbbbbbbbbbJ...J.",
    "sssssssssssssss.t.JJJ..",
    "................t......",
    "...............ttt.....",
  ],
  pal: { ...WOOD, j: "#8ff0c8", J: "#3fb889", t: "#ff7a8a" },
  grip: [4, 3],
};

const WEAPON_ART: Record<string, WeaponArt> = {
  twig: TWIG,
  bugNet: BUG_NET,
  keyboard: KEYBOARD,
  lintRoller: LINT_ROLLER,
  rubberDuck: RUBBER_DUCK,
  formatterBlade: FORMATTER_BLADE,
  typeBow: TYPE_BOW,
  gitBoomerang: GIT_BOOMERANG,
  refactorHammer: REFACTOR_HAMMER,
  debugWand: DEBUG_WAND,
  snakeWhip: PYTHON_WHIP,
  mergeSaber: MERGE_SABER,
  zenStaff: ZEN_STAFF,
  goldenDuck: GOLDEN_DUCK_W,
};

/** Every weapon id that has in-hand art (the same ids as WEAPONS in the catalog). */
export const WEAPON_IDS = Object.keys(WEAPON_ART);

const store = new Map<string, Sprite>();

/** Paints a weapon with a 1 px outline; the anchor is its grip. Unknown ids get the twig. */
export function weaponSprite(id: string): Sprite {
  return cached(store, id, () => {
    const art = WEAPON_ART[id] ?? TWIG;
    const w = Math.max(...art.rows.map((r) => r.length));
    const p = new Pix(w + 2, art.rows.length + 2);
    p.stamp(art.rows, { ...BASE_PAL, ...art.pal }, 1, 1);
    p.outline(art.line ?? INK);
    return p.toSprite(art.grip[0] + 1, art.grip[1] + 1);
  });
}
