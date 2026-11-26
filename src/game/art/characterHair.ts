/**
 * The eight original hair styles. Each style has, per view, an optional
 * BACK layer (drawn behind the head and body: long hair falling behind the
 * shoulders) and a FRONT layer (drawn over the head). In the "up" view
 * (seen from behind) everything is a single front layer.
 * More styles: characterHairShort.ts and characterHairLong.ts.
 */
import { CAP_TOP, type Layered } from "./characterParts";
import { HAIR_LONG } from "./characterHairLong";
import { HAIR_SHORT } from "./characterHairShort";

const HAIR_CLASSIC: Record<string, Layered> = {
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

/** Every hair style by name (the names are HAIR_STYLES in catalog.ts). */
export const HAIR: Record<string, Layered> = { ...HAIR_CLASSIC, ...HAIR_SHORT, ...HAIR_LONG };

/**
 * How many pixels a style's top rises above an ordinary head of hair. Hats
 * that perch on the hair (party hat, cat ears, halo) sit that much higher.
 */
export const HAIR_VOLUME: Record<string, number> = { Afro: 3 };
