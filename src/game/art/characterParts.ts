/**
 * The pictures the character generator is assembled from.
 *
 * Every part is a string grid (see engine.ts) placed on a shared "body
 * grid": 16 px wide, rows numbered from the top of the head (row 1) to the
 * shoes (row 18). Parts may start above row 0 (hair volume, hats) or stick
 * out sideways, so each part says where its top-left corner goes: {x, y}.
 *
 * Grids have NO outlines: the generator adds a coloured outline around the
 * finished silhouette automatically. Palette keys:
 *
 *   s skin   S skin shade   t skin highlight   o dark line (chin)
 *   e eye    E eye shine    m mouth            n blush    f freckle
 *   c outfit C outfit shade h outfit highlight  w shirt/white  W its shade
 *   p pants  P pants shade  b shoe   B shoe shade   g gold / buttons
 *   r hair   R hair shade   y hair highlight   S (in hair) = shadow on skin
 *   hats: a main  A shade  z highlight  x/X accent colours  k dark  g/G gold
 *
 * Side views face LEFT; the generator mirrors them for "right".
 */

export interface Part {
  rows: string[];
  /** Column of the grid's first character, in body-grid coordinates (default 0). */
  x?: number;
  /** Row of the grid's first line, in body-grid coordinates. */
  y: number;
}

export type View = "down" | "up" | "side";

// ───────────────────────────── head ─────────────────────────────

/** The round chibi head, same shape from every side. Rows 1–11. */
export const HEAD: Part = {
  y: 1,
  rows: [
    ".....tssss......",
    "...ttsssssss....",
    "..tssssssssss...",
    "..ssssssssssS...",
    "..ssssssssssS...",
    "..ssssssssssS...",
    "..ssssssssssS...",
    "..ssssssssssS...",
    "..ssssssssssS...",
    "...SsssssssS....",
    "....oooooooo....",
  ],
};

/** Head is 12 px wide (x 2..13); the face uses this layout. */
export const FACE: Record<View, Record<string, Part>> = {
  down: {
    Dot: { y: 6, rows: ["....e......e....", "....e......e...."] },
    Sparkle: { y: 5, rows: ["....ee....ee....", "....Ee....Ee....", "....ee....ee...."] },
    Sleepy: { y: 6, rows: ["...S........S...", "....ee....ee...."] },
  },
  side: {
    Dot: { y: 6, rows: ["...e............", "...e............"] },
    Sparkle: { y: 5, rows: ["..ee............", "..Ee............", "..ee............"] },
    Sleepy: { y: 6, rows: ["..S.............", "..ee............"] },
  },
  up: {},
};

export const MOUTH: Record<View, Part | null> = {
  down: { y: 9, rows: [".......mm......."] },
  side: { y: 9, rows: ["...m............"] },
  up: null,
};

export const ACCESSORY: Record<View, Record<string, Part>> = {
  down: {
    Glasses: { y: 5, rows: ["...kkkk..kkkk...", "...k..kkkk..k...", "...k..k..k..k...", "...kkkk..kkkk..."] },
    Blush: { y: 8, rows: ["..nn........nn.."] },
    Freckles: { y: 8, rows: ["...f.f....f.f...", "....f......f...."] },
  },
  side: {
    Glasses: { y: 5, rows: ["..kkkk..........", "kkk..kkkkk......", "..k..k..........", "..kkkk.........."] },
    Blush: { y: 8, rows: ["...nn..........."] },
    Freckles: { y: 8, rows: ["...f.f..........", "....f..........."] },
  },
  up: {},
};

// ──────────────────────────── outfits ────────────────────────────

/** Torso (and skirt) per outfit and view. Rows 12+. Legs are separate (LEGS). */
export const OUTFIT_PARTS: Record<string, Record<View, Part>> = {
  Tee: {
    down: { y: 12, rows: [".....cCCCc......", "....hccccccc....", "....sccccccs....", "....sCCCCCCs....", ".....pppppp....."] },
    up: { y: 12, rows: [".....cccccc.....", "....hccccccc....", "....scccccCs....", "....sCCCCCCs....", ".....pppppp....."] },
    side: { y: 12, rows: [".....ccCc.......", "....hhcccc......", "....cscccC......", "....CsCCCC......", ".....pppP......."] },
  },
  Hoodie: {
    down: { y: 12, rows: [".....CwCwC......", "....hcwccwcc....", "....hccccccc....", "....sCccccCs....", ".....pppppp....."] },
    up: { y: 12, rows: [".....CCCCCC.....", "....hCCCCCCc....", "....hccCCccc....", "....sccccccs....", ".....pppppp....."] },
    side: { y: 12, rows: [".....cCCCC......", "....hhccccC.....", "....chcccC......", "....sCCCCC......", ".....pppP......."] },
  },
  Overalls: {
    down: { y: 12, rows: [".....wcwwc......", "....hwgccgwW....", "....swccccws....", "....scccccCs....", ".....ccccCC....."] },
    up: { y: 12, rows: [".....wcwwc......", "....hwwccwwW....", "....swcwwcws....", "....scccccCs....", ".....ccccCC....."] },
    side: { y: 12, rows: [".....wwWw.......", "....hwcccC......", "....wsccgC......", "....WscccC......", ".....cccC......."] },
  },
  Dress: {
    down: { y: 12, rows: [".....cCCCc......", "....hcccccCc....", "....sccgcccs....", "...hhcccccccC...", "..hccccccccccC..", "..CCcCCcCCcCCC.."] },
    up: { y: 12, rows: [".....cccccc.....", "....hcccccCc....", "....sccgggcs....", "...hhccgcccC....", "..hccccccccccC..", "..CCcCCcCCcCCC.."] },
    side: { y: 12, rows: [".....ccCc.......", "....hhccc.......", "....csgccC......", "...hcsccccC.....", "..hcccccccC.....", "..CcCCcCCCC....."] },
  },
  Robe: {
    down: { y: 12, rows: [".....hcCCc......", "...hhhcccccc....", "...cscggggcsC...", "...ccccgcccCC...", "....hccgcccC....", "....CCCCCCCC...."] },
    up: { y: 12, rows: [".....cccccc.....", "...hhcccccccc...", "...csggggggsC...", "...ccccccccCC...", "....hcccccccC...", "....CCCCCCCC...."] },
    side: { y: 12, rows: [".....hcCc.......", "....hhcccc......", "...hccsgcC......", "...cccsccC......", "....hcccccC.....", "....CCCCCC......"] },
  },
};

/** What fills the `p` (leg) colour for each outfit. */
export const OUTFIT_LEGS: Record<string, "pants" | "outfit" | "skin" | "robe"> = {
  Tee: "pants",
  Hoodie: "pants",
  Overalls: "outfit",
  Dress: "skin",
  Robe: "robe",
};

/**
 * Legs + shoes for [stand, stepA, stepB]. On the two step frames the whole
 * upper body is drawn 1 px higher (a little bounce), so those leg grids
 * start one row earlier: the planted leg reaches the ground, the lifted leg
 * stops a pixel short.
 */
export const LEGS: Record<View, Part[]> = {
  down: [
    { y: 17, rows: [".....pp..pp.....", ".....bb..bb....."] },
    { y: 16, rows: [".....pp..pp.....", ".....bb..pp.....", ".........bb....."] },
    { y: 16, rows: [".....pp..pp.....", ".....pp..bb.....", ".....bb........."] },
  ],
  up: [
    { y: 17, rows: [".....pp..pp.....", ".....bb..bb....."] },
    { y: 16, rows: [".....pp..pp.....", ".....bb..pp.....", ".........bb....."] },
    { y: 16, rows: [".....pp..pp.....", ".....pp..bb.....", ".....bb........."] },
  ],
  side: [
    { y: 17, rows: [".....ppP........", "....bbbB........"] },
    { y: 16, rows: [".....ppPP.......", "....pp..PP......", "...bb....BB....."] },
    { y: 16, rows: [".....PPpp.......", "....PP..pp......", "...BB....bb....."] },
  ],
};

/** Vertical offset of everything above the legs, per step (the walking bounce). */
export const BOB = [0, -1, -1];

// ──────────────────────────── hair ────────────────────────────

/**
 * Each hair style has, per view, an optional BACK layer (drawn behind the
 * head and body: long hair falling behind the shoulders) and a FRONT layer
 * (drawn over the head). In the "up" view (seen from behind) everything is
 * a single front layer.
 */
export interface HairArt {
  down: { back?: Part; front?: Part };
  up: { back?: Part; front?: Part };
  side: { back?: Part; front?: Part };
}

const CAP_TOP = [
  "....rrrrrrr.....",
  "..rrryyyrrrrr...",
  ".rryyyrrrrrrrR..",
  ".ryyrrrrrrrrrrR.",
];

export const HAIR: Record<string, HairArt> = {
  Short: {
    down: {
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".rrRrrrRrrrRrRR.", ".rrRSSrRSSrRSRR.", ".rr..........RR.", ".r............R."],
      },
    },
    up: { front: { y: -1, rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrRRR.", "..rrrrrrrrrRRR..", "..RRrRRrRRrRRR..", "...R.R..R..R...."] } },
    side: {
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".RrRrrrrrrrrrRR.", ".SR.SrrrrrrrrRR.", "....SrRrrrrrRRR.", ".....sRrrrrrRR..", ".....SRrrrrRRR..", "......RRRRRRR..."],
      },
    },
  },
  Bob: {
    down: {
      front: {
        y: -1,
        rows: [
          ...CAP_TOP,
          ".rrrrrrrrrrrrRR.",
          ".rrrrrrrrrrrrRR.",
          ".rrRRRRRRRRRRRR.",
          ".rrS........SRR.",
          ".rr..........RR.",
          ".rr..........RR.",
          ".rR..........RR.",
          ".RR..........RRR",
          "RRR..........RRR",
        ],
      },
    },
    up: {
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrRRR.", ".rrrrrrrrrrRRRR.", ".RrRrrRrRRrRRRR.", "RRR.RR.RR.RR.RRR"],
      },
    },
    side: {
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrrRR.", ".RRRRSrrrrrrrRR.", ".S...SrrrrrrrRR.", ".....sRrrrrrrRR.", ".....SRrrrrrRRR.", ".....RRrrrrrRRR.", "......RRrrrRRRR.", ".....RRR.RRRRRR."],
      },
    },
  },
  Long: {
    down: {
      back: { y: 7, rows: [".rr..........RR.", ".rr..........RR.", ".rr..........RR.", ".rr..........RR.", "rrr..........RRR", "rrR..........RRR", "rRR..........RRR", "rRR..........RRR", ".RR..........RR.", ".R.R........R.R."] },
      front: {
        y: -1,
        rows: [
          "....rrrrrrr.....",
          "..rrryyRyrrrr...",
          ".rryyyrRrrrrrR..",
          ".ryyrrrRRrrrrrR.",
          ".rrrrrRSSRrrrRR.",
          ".rrrrRS..SRrrRR.",
          ".rrrRS....SRrRR.",
          ".rrR........RRR.",
          ".rr..........RR.",
        ],
      },
    },
    up: {
      front: {
        y: -1,
        rows: [
          ...CAP_TOP,
          ".rrrrrrrrrrrrRR.",
          ".rrrrrrrrrrrrRR.",
          ".rrrrrrrrrrrrRR.",
          ".rrrrrrrrrrrrRR.",
          ".rryrrrrrrrrrRR.",
          ".rryrrrrrrrrrRR.",
          ".rrrrrrrrrrrRRR.",
          ".rrrrrrrrrrrRRR.",
          "rrrrrrrrrrrrRRRR",
          "rrryrrrrrrrRRRRR",
          "rrrrrrrrrrrRRRRR",
          ".rrrrrrrrrrRRRR.",
          ".rrrrrrrrrRRRRR.",
          ".rRrRrrRrRRRRRR.",
          "..R.R..R..R.R...",
        ],
      },
    },
    side: {
      back: { y: 6, rows: ["..........rRR...", "..........rRRR..", "..........rRRR..", "..........rrRRR.", "..........rrRRR.", "..........rrRRR.", "..........rrRRR.", "..........rrRRR.", "...........rRRR.", "...........RR.R."] },
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".RRRrrrrrrrrrRR.", ".S..SRrrrrrrrRR.", ".....sRrrrrrrRR.", ".....SRrrrrrrRR.", "......RrrrrrrRR.", "......RrrrrrRRR."],
      },
    },
  },
  Ponytail: {
    down: {
      back: { x: 12, y: 1, rows: ["...kk", "..rRR", ".rrRR", ".rrRR", "..rRR", "..rRR", "...RR", "...R."] },
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".rRRRRRrrrrrRRR.", ".rS..SSRRrrRSRR.", ".r.......SRS.RR.", ".r............R."],
      },
    },
    up: {
      front: {
        y: -1,
        rows: [
          ...CAP_TOP,
          ".rrrrrrrrrrrrRR.",
          ".rrrrrrkkrrrrRR.",
          ".rrrrrkkkkrrrRR.",
          ".rrrrryrrRrrrRR.",
          ".rrrrryrrRrrRRR.",
          "..rrryyrrRRrRR..",
          "..RRRyrrrRRRRR..",
          "......yrrR......",
          "......yrrR......",
          "......rrRR......",
          ".......rR.......",
        ],
      },
    },
    side: {
      back: { x: 10, y: 1, rows: ["..kk...", ".krrR..", ".rrrRR.", "..rrRRR", "...rRRR", "...rRRR", "....RRR", "....RR.", ".....R."] },
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".RRrrrrrrrrrRRR.", ".SRSSrrrrrrrRRR.", "....SRrrrrrRRR..", ".....sRrrrRRR...", ".....SRRRRRR...."],
      },
    },
  },
  Spiky: {
    down: {
      front: {
        y: -3,
        rows: [
          "...r....r..r....",
          "...rr..yr.rr..r.",
          "..rrr.yyrrrr.rr.",
          "..rryyyyrrrrrrR.",
          ".rryyyrrrrrrrrR.",
          "rryyrrrrrrrrrrRR",
          ".rrrrrrrrrrrrRR.",
          "rrrRrrRrrrRrrRRR",
          ".rRSRrSRrRSRrRR.",
          ".rS.S..S..S..RR.",
          ".r............R.",
        ],
      },
    },
    up: {
      front: {
        y: -3,
        rows: [
          "...r....r..r....",
          "...rr..rr.rr..r.",
          "..rrr.rrrrrr.rr.",
          "..rrrrrrrrrrrrR.",
          ".rrrrrrrrrrrrrR.",
          "rrrrrrrrrrrrrrRR",
          ".rrrrrrrrrrrrRR.",
          "rrrrrrrrrrrrrRRR",
          ".rrrrrrrrrrrrRR.",
          "rrrrrrrrrrrrRRRR",
          ".rrrrrrrrrrrRRR.",
          "..RrRRrRRrRRRR..",
          "..R..R..R..R....",
        ],
      },
    },
    side: {
      front: {
        y: -3,
        rows: [
          "......r..r..r...",
          ".....rr.rr.rr...",
          "....rrryrrrrr.r.",
          "...ryyyyrrrrrrr.",
          "..ryyrrrrrrrrrRr",
          ".ryrrrrrrrrrrrRR",
          ".rrrrrrrrrrrrRR.",
          "rRrrrrrrrrrrrRRR",
          ".RSRrrrrrrrrrRR.",
          ".S..SRrrrrrrRRRR",
          ".....sRrrrrrRRR.",
          ".....SRRrrRRRR..",
          "......R.RR.RR...",
        ],
      },
    },
  },
  Curly: {
    down: {
      back: { y: 6, rows: ["rr............RR", "rRr..........RRr", ".rR..........RR.", "rRr..........rRR", ".RR..........RR."] },
      front: {
        y: -2,
        rows: [
          "...rr.rr.rr.....",
          "..ryyrryyrrrr...",
          ".ryyrrrrrrrRrr..",
          "rryrrRrryrrrRrR.",
          ".rrrRRrrrrrRRrrr",
          "rryrrrrRrryrrRR.",
          ".rrrRrrRRrrrRRrr",
          "rrRSSrRSSrRSSRRR",
          ".rS..........RR.",
          "rr............RR",
          ".R............R.",
        ],
      },
    },
    up: {
      front: {
        y: -2,
        rows: [
          "...rr.rr.rr.....",
          "..ryyrryyrrrr...",
          ".ryyrrrrrrrRrr..",
          "rryrrRrryrrrRrR.",
          ".rrrRRrrrrrRRrrr",
          "rryrrrrRrryrrRR.",
          ".rrrRrrRRrrrRRrr",
          "rryrrrryrrrRrRRR",
          ".rrRRrrRRrrRRRr.",
          "rrrrrRrrrRRrRRRR",
          ".rRrRRrRRrRRRRR.",
          "..RR.RR.RR.RRR..",
        ],
      },
    },
    side: {
      back: { y: 6, rows: ["..........RRr...", "..........rRRR..", ".........rRRrr..", "..........RRR..."] },
      front: {
        y: -2,
        rows: [
          "...rr.rr.rr.....",
          "..ryyrryyrrrr...",
          ".ryyrrrrrrrRrr..",
          "rryrrRrryrrrRrR.",
          ".rrrRRrrrrrRRrrr",
          "rryrrrrRrryrrRR.",
          ".rRrRrrRRrrrRRrr",
          ".RSSrRrrrrrRrRRR",
          ".S..SRrRrrRRRRR.",
          ".....sRrrRrRRRRR",
          ".....SRRrRRRRRR.",
          "......RR.RR.RR..",
        ],
      },
    },
  },
  Buns: {
    down: {
      front: {
        y: -4,
        rows: [
          ".rrr........RRR.",
          "ryyrR......rrrRR",
          "ryrrR......rrRRR",
          ".rRR........RRR.",
          "....rrrrrrr.....",
          "..rrryyyrrrrr...",
          ".rryyyrrrrrrrR..",
          ".ryyrrrrrrrrrrR.",
          ".rrrrrrrrrrrrRR.",
          ".rrRrRrrRrRrRRR.",
          ".rS.SRS..SRS.RR.",
          ".r............R.",
        ],
      },
    },
    up: {
      front: {
        y: -4,
        rows: [
          ".rrr........RRR.",
          "ryyrR......rrrRR",
          "ryrrR......rrRRR",
          ".rRR........RRR.",
          "....rrrrrrr.....",
          "..rrryyyrrrrr...",
          ".rryyyrrrrrrrR..",
          ".ryyrrrrrrrrrrR.",
          ".rrrrrrrrrrrrRR.",
          ".rrrrrrrrrrrrRR.",
          ".rrrrrrrrrrrrRR.",
          ".rrrrrrrrrrrRRR.",
          "..rrrrrrrrrRRR..",
          "..RRrRRrRRrRRR..",
        ],
      },
    },
    side: {
      back: { x: 9, y: -4, rows: [".rrr...", "ryyrR..", "ryrrRR.", ".rRRR.."] },
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".RRrrrrrrrrrRRR.", ".SRSSrrrrrrrRRR.", "....SRrrrrrRRR..", ".....sRrrrRRR...", ".....SRRRRRR...."],
      },
    },
  },
  Bald: {
    down: { front: { y: 2, rows: ["....tt..........", "...t............"] } },
    up: { front: { y: 2, rows: ["....tt..........", "...t............"] } },
    side: { front: { y: 2, rows: ["....tt..........", "...t............", ".........SS.....", ".........sS....."] } },
  },
};

// ───────────────────────────── hats ─────────────────────────────

/**
 * Hats sit on top of the hair. `clip`: hair rows above this body-grid row
 * are erased first, so spikes and buns do not poke through a beanie
 * (undefined = keep all hair, e.g. a halo floats above it).
 */
export interface HatArt {
  down: Part;
  up?: Part;
  side?: Part;
  clip?: number;
  pal: Record<string, string>;
}

export const HAT_ART: Record<string, HatArt> = {
  beanie: {
    clip: 2,
    pal: { a: "#e5484d", A: "#b8323f", z: "#ff7a7a", x: "#fff4e6", X: "#e0d6cc" },
    down: { y: -5, rows: ["......xx........", ".....xXxX.......", "....aazaaa......", "..aazzaaaaaA....", ".azzaaaaaaaaA...", ".aaaaaaaaaaaAA..", ".aaaaaaaaaaaAA..", "XxXxXxXxXxXxXxX.", "xXxXxXxXxXxXxXX."] },
    side: { y: -5, rows: ["........xx......", ".......xXxX.....", "....aaazaa......", "..aazzaaaaaA....", ".azzaaaaaaaaA...", ".aaaaaaaaaaaAA..", ".aaaaaaaaaaaAA..", "XxXxXxXxXxXxXxX.", "xXxXxXxXxXxXxXX."] },
  },
  strawHat: {
    clip: 1,
    pal: { a: "#f2d27a", A: "#d6ad55", z: "#fff0b3", x: "#e5484d", X: "#b8323f" },
    down: { x: -2, y: -4, rows: ["......aazzaa........", ".....azzaaaaA.......", "....aaaaaaaaaA......", "....xxxxxxxxxX......", ".zzaaaaaaaaaaaaaAA..", "aaaaaaaaaaaaaaaaaAA.", ".AAAAAAAAAAAAAAAAA.."] },
  },
  partyHat: {
    pal: { a: "#4dabf7", A: "#2f86d6", z: "#a5d8ff", x: "#ffd43b", X: "#ff6b9a" },
    down: { x: 2, y: -8, rows: ["....XX......", "....xX......", "....aa......", "...zaxa.....", "...axaaA....", "..zaaxaa....", "..xaaaxaA...", ".aaxaaaxaA..", ".XxXxXxXxX.."] },
  },
  headphones: {
    pal: { a: "#3d3a52", A: "#2a2838", z: "#6a6688", x: "#3cc7c0", X: "#2a9a94" },
    down: { y: -2, rows: ["....zaaaaaa.....", "..za......aA....", ".za.........A...", ".a..........A...", "", "", "xxa.........axx.", "xXa.........aXX.", "xXa.........aXX.", ".xx..........xx."] },
    side: { y: -2, rows: ["....zaaaaaa.....", "...a......aA....", "..a.........A...", "..a.........A...", "........aa......", ".......xxxX.....", ".......xXXX.....", ".......xXXX.....", "........xX......"] },
  },
  catEars: {
    pal: { a: "@hair", A: "@hairShade", z: "#ff9ab5", x: "#ffd0dd" },
    down: { y: -4, rows: ["..a.........A...", "..aa.......AA...", "..azA.....AzA...", "..azzA...AzzA..."] },
    side: { y: -4, rows: ["......a....A....", "......aa..AA....", "......azAAzA....", "......azzAzzA..."] },
  },
  flowerCrown: {
    pal: { a: "#58b368", A: "#3d8a4f", z: "#ff8fab", x: "#fff4f7", X: "#ffd43b", k: "#ffb3c6" },
    down: { y: -1, rows: ["..zk.xX.zk.Xx...", ".aAazaaxaaXaaA..", ".kz...........A."] },
    side: { y: -1, rows: ["...zk.xX.zk.Xx..", "..aAazaaxaaXaaA.", "..............A."] },
  },
  topHat: {
    clip: 2,
    pal: { a: "#3a3550", A: "#25223a", z: "#5c5680", x: "#c77dff", X: "#9a5ad8" },
    down: { x: 1, y: -9, rows: ["...zaaaaaaA...", "...zaaaaaaA...", "...zaaaaaaA...", "...zaaaaaaA...", "...zaaaaaaA...", "...xxxxxxxX...", "...xxxxxxxX...", "zzzaaaaaaaaaAA", "AAAAAAAAAAAAAA"] },
  },
  wizardHat: {
    clip: 2,
    pal: { a: "#5a4bd6", A: "#3c2fa8", z: "#8a7dff", x: "#ffd43b", X: "#fff4b3" },
    down: { x: -1, y: -11, rows: ["...........A......", "..........aA......", ".........zaA......", "........zaaA......", "........zaaA......", ".......zaxaaA.....", ".......zaaaaA.....", "......zaaaaaxA....", "......zaxaaaaA....", ".....zaaaaaaaaA...", ".....zaaaaaaaaA...", "....xxxxXxxxXxxx..", ".zzaaaaaaaaaaaaaAA", "AAAAAAAAAAAAAAAAA."] },
  },
  snakeHood: {
    clip: 3,
    pal: { a: "#58b368", A: "#3d8a4f", z: "#8ce09a", x: "#ffd43b", X: "#e5484d", k: "#24302a" },
    down: { y: -5, rows: [".....zzaaa......", "...zzaaaaaaA....", "..zaaxkaaxkaA...", ".zaaaaaaaaaaaA..", ".aaaaaaXXaaaaA..", "zaaaaaaaaaaaaAA.", "zaaAAAAAAAAAaAA.", "aaA.........AaA.", "aA...........AA.", "aA...........AA.", "aA...........AA."] },
    up: { y: -5, rows: [".....zzaaa......", "...zzaaaaaaA....", "..zaaaaaaaaaA...", ".zaaaaxaaxaaaA..", ".aaaaaaaaaaaaA..", "zaaaaxaaxaaaaAA.", "zaaaaaaaaaaaaAA.", "aaaaaxaaxaaaaAA.", "aaaaaaaaaaaaaAA.", "aaaaaaaaaaaaAAA.", ".aAaAaAaAaAAAA.."] },
    side: { y: -5, rows: ["......zzaaa.....", "....zzaaaaaaA...", "..xkaaaaaaaaaA..", ".zaaaaaaaaaaaA..", "XXaaaaaaaaaaaaA.", ".aaaaaaaaaaaaaA.", ".aAAaaaaaaaaaAA.", "..A..aaaaaaaaAA.", ".....aaaaaaaAAA.", ".....aaaaaaAAA..", ".....AAAAAAAA..."] },
  },
  halo: {
    pal: { a: "#ffd43b", A: "#e0a91c", z: "#fff4b3" },
    down: { y: -5, rows: ["....zzaaaaa.....", "...zA.....aA....", "....aAAAAAA....."] },
  },
  crown: {
    clip: 0,
    pal: { a: "#ffd43b", A: "#d99a2b", z: "#fff4b3", x: "#e5484d", X: "#4dabf7" },
    down: { y: -4, rows: ["...z...a...A....", "...za.zaa.aA....", "...zaaaxaaaA....", "...zaXaaaXaA....", "...AAAAAAAAA...."] },
  },
};
