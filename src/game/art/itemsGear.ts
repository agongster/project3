/**
 * Item icons, part 1: weapons and charms (16×16 each).
 *
 * Grids are at most 14×14 and leave out the outer outline (items.ts adds it
 * and centres the picture). Long weapons point diagonally up-right, the
 * classic inventory pose. Palettes reuse the in-hand weapon materials.
 */
import type { Palette } from "./engine";
import { DUCK, GOLD, GOLDEN_DUCK, STEEL, WOOD } from "./weaponsPalettes";

/** One icon: its grid, palette, and letters to paint after the outline (thin details). */
export interface IconArt {
  rows: string[];
  pal: Palette;
  after?: string;
  /** Outline colour override (null = no outline). */
  line?: string | null;
}

// ───────────────────────────── weapons ─────────────────────────────

const TWIG: IconArt = {
  rows: [
    "..........gg..",
    ".........gGGg.",
    "..........GG..",
    "........hb....",
    ".......hb.....",
    "......hbs.h...",
    ".....hb..hb...",
    "....hbbbbs....",
    "...hbs........",
    "..hbs.........",
    ".hbs..........",
    "hbs...........",
  ],
  pal: { ...WOOD, g: "#8fdc5a", G: "#4fa83e" },
};

const BUG_NET: IconArt = {
  rows: [
    "........rrrr..",
    "......rrnnnnR.",
    ".....rn.n.n.nR",
    ".....rnnnnnnnR",
    ".....rn.n.n.nR",
    ".....RnnnnnnnR",
    "......RnnnnnR.",
    ".....hbRRRRR..",
    "....hbs.......",
    "...hbs........",
    "..hbs.........",
    ".hbs..........",
    "hbs...........",
  ],
  pal: { ...WOOD, r: "#ff8fb1", R: "#d9577e", n: "#ffffffb0" },
};

const KEYBOARD: IconArt = {
  rows: [
    "hhhhhhhhhhhhhh",
    "hrgcgcgcgcgcgs",
    "hcgcgcgcgcgces",
    "hgcgcgcgcgceeb",
    "hcccgccccgcccs",
    "ssssssssssssss",
    "dddddddddddddd",
  ],
  pal: { h: "#a9a2c9", b: "#7d76a3", s: "#5a5480", d: "#433d66", c: "#f4f1ff", g: "#4a4470", r: "#ff5a6e", e: "#7dff8a" },
};

const LINT_ROLLER: IconArt = {
  rows: [
    ".hWWWWWWWWWs.",
    "hWWpWWWWfWWWs",
    "hWWWWWWWWWWWs",
    "hWWWWWfWWWpWs",
    ".sssssssssss.",
    "......bb.....",
    ".....Bcd.....",
    ".....Bcd.....",
    ".....Bcd.....",
    ".....Bcd.....",
    ".....Bcd.....",
    "......dd.....",
  ],
  pal: { B: "#8fc9ff", c: "#4a90e2", d: "#2f62a8", h: "#ffffff", W: "#efeaf6", s: "#b9b0d0", b: "#7d86a8", p: "#c9a6f2", f: "#ffb3cd" },
};

/** The rubber duck (also the golden duck, with another palette). */
const DUCK_ROWS = [
  "......wyyy....",
  ".....wyyyyy...",
  ".....yyykyy...",
  ".....yyyyyyoo.",
  ".....yyyyyOOo.",
  "y....Yyyyyy...",
  "yy..yyyyyyy...",
  "yyyyyyyyyyyy..",
  "yyyyyYYYyyyyy.",
  "YyyyyyYYYyyyY.",
  ".YYyyyyyyyYY..",
  "..YYYYYYYYY...",
];

const FORMATTER_BLADE: IconArt = {
  rows: [
    "............ww",
    "...........whb",
    "..........whbs",
    ".........whts.",
    "........whbs..",
    ".......whts...",
    "......whbs....",
    "..Y..whbs.....",
    "...YYhbs......",
    "....YYs.......",
    "...kYYY.......",
    "..kk..Y.......",
    ".kk...........",
    "oo............",
  ],
  pal: { ...STEEL, ...GOLD, w: "#ffffff", k: "#3a3450", t: "#7d86a8" },
};

const TYPE_BOW: IconArt = {
  rows: [
    "...hb.........",
    "...w.bb.......",
    "...w...b......",
    "...w....b.....",
    "...w....bs....",
    "...w.....b..H.",
    "ffaaaaaaaaaaHH",
    "...w.....g..H.",
    "...w....bs....",
    "...w....b.....",
    "...w...b......",
    "...w.bb.......",
    "...hb.........",
  ],
  pal: { h: "#9fd0ff", b: "#4a90e2", s: "#2f62a8", w: "#fff8e8", g: "#ffd34d", a: "#e8b274", H: "#e6ebf7", f: "#ff8fb1" },
};

const GIT_BOOMERANG: IconArt = {
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
};

const REFACTOR_HAMMER: IconArt = {
  rows: [
    "......hmmmmmmM",
    "......hmkmmkmM",
    "......YyyyyyyY",
    "......hmkmmkmM",
    ".......MMMMMM.",
    "........hb....",
    ".......hbs....",
    "......hbs.....",
    ".....hbs......",
    "....hbs.......",
    "...hbs........",
    "..hbs.........",
    ".hbs..........",
  ],
  pal: { ...WOOD, ...GOLD, m: "#c9d0e6", M: "#7d86a8", k: "#5d6488" },
};

const DEBUG_WAND: IconArt = {
  rows: [
    "...........x..",
    "........rrr...",
    ".......rwrRr.x",
    ".......rrRRR..",
    "..x....RRRRq..",
    "........qqq...",
    ".......hb.....",
    "......hb......",
    ".....hb.......",
    "....hb........",
    "...hb.........",
    "..hb..........",
    ".hb...........",
  ],
  pal: { h: "#a990e0", b: "#5c4bb0", r: "#ff7a8a", R: "#e83a50", q: "#a8283c", x: "#fff1a0" },
  after: "x",
};

const PYTHON_WHIP: IconArt = {
  rows: [
    ".......yyy....",
    "......yyyky.rr",
    ".....byyyyyr..",
    "....bb.yy.....",
    "...bY.........",
    "...by...bbyy..",
    "...yb..by..yb.",
    "....bybY....y.",
    "............b.",
    "...........yY.",
    ".hh.....bybY..",
    "hdd..byyb.....",
    "dd.bYY........",
    ".dd...........",
  ],
  pal: { h: "#c58a5a", d: "#7a4a32", b: "#4a7ae2", Y: "#2f52a8", y: "#ffd84a", r: "#ff5a8a" },
  after: "r",
};

const MERGE_SABER: IconArt = {
  rows: [
    "...........aav",
    "..........awwv",
    ".........awwv.",
    "........awwv..",
    ".......awwv...",
    "......awwv....",
    ".....awwv.....",
    "..Y.awwv......",
    "...YYwv.......",
    "....YYv.......",
    "...kYYY.......",
    "..kk..Y.......",
    ".kk...........",
    "kk............",
  ],
  pal: { k: "#3a3450", Y: "#ffd34d", a: "#5cf2e0", v: "#c77dff", w: "#ffffff" },
  line: "#3a2a60",
};

const ZEN_STAFF: IconArt = {
  rows: [
    ".........jjjj.",
    "........jJ..Jj",
    "........j....J",
    "........J....J",
    ".........JhJJ.",
    "........hbt...",
    ".......hb.t...",
    "......hb..tt..",
    ".....hb.......",
    "....hb........",
    "...hb.........",
    "..hb..........",
    ".hb...........",
    "hb............",
  ],
  pal: { ...WOOD, j: "#8ff0c8", J: "#3fb889", t: "#ff7a8a" },
};

export const WEAPON_ICONS: Record<string, IconArt> = {
  twig: TWIG,
  bugNet: BUG_NET,
  keyboard: KEYBOARD,
  lintRoller: LINT_ROLLER,
  rubberDuck: { rows: DUCK_ROWS, pal: DUCK },
  formatterBlade: FORMATTER_BLADE,
  typeBow: TYPE_BOW,
  gitBoomerang: GIT_BOOMERANG,
  refactorHammer: REFACTOR_HAMMER,
  debugWand: DEBUG_WAND,
  snakeWhip: PYTHON_WHIP,
  mergeSaber: MERGE_SABER,
  zenStaff: ZEN_STAFF,
  goldenDuck: {
    rows: [".x....c.c.c...", "xxx...cjccc...", ".x.." + DUCK_ROWS[0].slice(4), ...DUCK_ROWS.slice(1)],
    pal: { ...GOLDEN_DUCK, x: "#ffffff", c: "#fff0a0", j: "#ff5a8a" },
    after: "x",
  },
};

// ───────────────────────────── charms ─────────────────────────────

/** A cosy mug of coffee with curls of steam. v = steam (thin, painted after the outline). */
const HOT_COFFEE: IconArt = {
  rows: [
    "...v..v.....",
    "..v..v......",
    "...v..v.....",
    "............",
    ".hmmmmmmmM..",
    ".cCCcccccM..",
    ".hmmmmmmmMMM",
    ".hmmrrmmmM.M",
    ".hmrrrrmmM.M",
    ".hmmrrmmmMMM",
    ".hmmmmmmmM..",
    "..MMMMMMM...",
  ],
  pal: { h: "#ffffff", m: "#fff1e0", M: "#d9c4b0", c: "#7a4a32", C: "#a86a42", r: "#ff7a8a", v: "#ffffffd0" },
  after: "v",
};

/** A horseshoe magnet pulling a coin. r/R = red, s = silver tips, y/Y = coin, x = pull lines. */
const COIN_MAGNET: IconArt = {
  rows: [
    "......x.......",
    "....yyyy...x..",
    "...yYyyYy.....",
    "...yYyyYy.....",
    "....YYYY......",
    "..x...........",
    "..ss....ss....",
    "..ss....ss....",
    "..rr....rR....",
    "..rr....rR....",
    "..rrr..rrR....",
    "...rrrrrR.....",
    "....RRRR......",
  ],
  pal: { r: "#ff5a6e", R: "#c0304a", s: "#e6ebf7", y: "#ffd34d", Y: "#fff4b0", x: "#fff1a0" },
  after: "x",
};

/** A heart-shaped cookie with pink icing and sprinkles. */
const HEART_COOKIE: IconArt = {
  rows: [
    ".hcc....hcc..",
    "hcccc..hcccC.",
    "hcpppcccpppcC",
    "hcppppppppwcC",
    "ccpppppppppcC",
    ".cppsppppspC.",
    "..cpppppppC..",
    "...cppppsC...",
    "....cpppC....",
    ".....cCC.....",
    "......C......",
  ],
  pal: { h: "#f6d29a", c: "#dca060", C: "#a86a3a", p: "#ff9ec4", w: "#ffffff", s: "#7dd8ff" },
};

/** A four-leaf clover. */
const LUCKY_CLOVER: IconArt = {
  rows: [
    "..hhg..hgg..",
    ".hggggggggG.",
    ".hgggGGgggG.",
    "..ggGllGgg..",
    "hhggglgggggg",
    "hggglllgggGG",
    "hgggGllGgggG",
    ".ggGGggGGgG.",
    ".hggGggggGG.",
    "..ggg.bggg..",
    "......b.....",
    ".....b......",
    "....b.......",
  ],
  pal: { h: "#a8f08a", g: "#58c858", G: "#3d9a48", l: "#c8ffb0", b: "#3d8a4f" },
};

/** A boot on a big coil spring. b/B/d = boot, l = laces, s/S = spring steel. */
const SPRING_BOOTS: IconArt = {
  rows: [
    "....hbbbB...",
    "....hblbB...",
    "....hbbbB...",
    "....hblbB...",
    "....hbbbBB..",
    "...hbbbbbbBB",
    "...hbbbbbbbB",
    "...dddddddd.",
    "....sssss...",
    ".....SSSS...",
    "....sssss...",
    ".....SSSS...",
    "....sssss...",
  ],
  pal: { h: "#ff9a6a", b: "#e8604c", B: "#b83a32", d: "#5a3424", l: "#fff4e6", s: "#e6ebf7", S: "#8f98b8" },
};

/** A smiling cactus in a terracotta pot, with a pink flower. */
const CACTUS_BUDDY: IconArt = {
  rows: [
    ".....ff.....",
    "....fFFf....",
    "....hggG....",
    ".h..hggG..G.",
    "hg..hkgk..gG",
    "hg..hggGh.gG",
    "hgggpkkpgggG",
    ".hgghggGggG.",
    "....hggG....",
    "..cccccccc..",
    "..CccccccC..",
    "...CccccC...",
    "...CCCCCC...",
  ],
  pal: { h: "#a8f08a", g: "#5cc070", G: "#3d8a4f", f: "#ff8fb1", F: "#ffd0e0", p: "#ff9ec4", c: "#e8865a", C: "#b85a3a" },
};

/** A cosy striped scarf with tassels (the stripes say """ like a docstring). */
const DOC_SCARF: IconArt = {
  rows: [
    "..hbbbbbbbb...",
    ".hbqbqbqbbbB..",
    "hbbbbbbbbbbbB.",
    "hbB.......hbB.",
    "hbBB.....hbbB.",
    ".hbbB....hcB..",
    "..ccc....hbB..",
    "..hbB....hqB..",
    "..hqB....hbB..",
    "..hbB....hcB..",
    "..ccc....ccc..",
    "..t.t....t.t..",
  ],
  pal: { h: "#8ff0d8", b: "#3cc7b0", B: "#2a8f88", c: "#fff4e6", q: "#ffffff", t: "#ffd34d" },
};

/** The legendary green checkmark on a round badge. */
const GREEN_CHECK: IconArt = {
  rows: [
    "....gggggg....",
    "..gghhhhhhgg..",
    ".ghhhhhhhwwhg.",
    ".ghhhhhhhwwwg.",
    "ghhhhhhhwwwhgG",
    "ghwwhhhwwwhhgG",
    "ghwwwhwwwhhhgG",
    "ghhwwwwwhhhhgG",
    "ghhhwwwhhhhggG",
    ".ghhhwhhhhggG.",
    ".gghhhhhhggGG.",
    "..ggggggggGG..",
    "....GGGGGG....",
  ],
  pal: { g: "#3ddc84", G: "#22a060", h: "#6ef0a4", w: "#ffffff" },
};

export const CHARM_ICONS: Record<string, IconArt> = {
  hotCoffee: HOT_COFFEE,
  coinMagnet: COIN_MAGNET,
  heartCookie: HEART_COOKIE,
  luckyClover: LUCKY_CLOVER,
  springBoots: SPRING_BOOTS,
  cactusBuddy: CACTUS_BUDDY,
  docScarf: DOC_SCARF,
  greenCheck: GREEN_CHECK,
};
