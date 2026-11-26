/**
 * Short and textured hair styles added in round four: Buzz, Pixie,
 * Undercut, Mohawk, Afro and Puffs. Same layout as characterHair.ts
 * (`x` = the shaved-short "stubble" tone between skin and hair colour).
 */
import { CAP_TOP, type Layered } from "./characterParts";

export const HAIR_SHORT: Record<string, Layered> = {
  Buzz: {
    down: { front: { y: 0, rows: [".....rrrrr......", "...rryyrrrrr....", "..ryyrrrrrrrR...", "..rrrrrrrrrrR...", "..rRrRrRrRrRR...", "..x.........x..."] } },
    up: { front: { y: 0, rows: [".....rrrrr......", "...rrrrrrrrr....", "..rrrrrrrrrrR...", "..rrrrrrrrrrR...", "..rrrrrrrrrrR...", "..rrrrrrrrrRR...", "..rrrrrrrrrRR...", "..rrrrrrrrRRR...", "...RrRrRrRrR...."] } },
    side: { front: { y: 0, rows: [".....rrrrr......", "...rryyrrrrr....", "..ryyrrrrrrrR...", "..rRrrrrrrrrR...", "....xrrrrrrrR...", "......rrrrrrR...", "......xRrrrRR...", "........RrRR....", "........xRR....."] } },
  },
  Pixie: {
    down: {
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".rrrrrrrrRRSRRR.", ".rrrrRRRS....RR.", ".rRS..........R.", ".r............R."],
      },
    },
    up: { front: { y: -1, rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrRRR.", ".rrrrrrrrrrrRRR.", "..rrrrrrrrrRRR..", "..RrrRrrRrRRR...", "...R..R..R......"] } },
    side: { front: { y: -1, rows: [...CAP_TOP, "rrrrrrrrrrrrrRR.", "rrRRrrrrrrrrrRR.", ".RS.SrrrrrrrRRR.", "....SrRrrrrRRR..", ".....sRrrrrRR...", ".....SRRrRRR...."] } },
  },
  Undercut: {
    down: {
      front: {
        y: -2,
        rows: ["....rrrrrr......", "...ryyyyrrrr....", "..ryyyrrrrrrrr..", ".ryrrrrrrrrrrrR.", ".rrrrrrrrrrrRRR.", "..xrrrrrrRRRRx..", "..xxRRRRS....x..", "..x..........x..", "..x............."],
      },
    },
    up: { front: { y: -2, rows: ["....rrrrrr......", "...rrrrrrrrr....", "..rrrrrrrrrrrr..", ".rrrrrrrrrrrrrR.", ".rrrrrrrrrrrRRR.", "..xrrrrrrrrRRx..", "..xxxxxxxxxxx...", "..xxxxxxxxxxx...", "..xxxxxxxxxxx...", "..xxxxxxxxxxx...", "..xxxxxxxxxxx...", "...xxxxxxxxx...."] } },
    side: {
      front: {
        y: -2,
        rows: ["....rrrrrr......", "..rryyyrrrrr....", ".ryyyrrrrrrrrr..", "rrrrrrrrrrrrrrR.", "rRrrrrrrrrrrRRR.", ".SRRrrxxxxxxxx..", "....Sxxxxxxxxx..", ".....xxxxxxxxx..", ".....sxxxxxxxx..", ".....Sxxxxxxx...", "......xxxxxx...."],
      },
    },
  },
  Mohawk: {
    down: {
      front: {
        y: -5,
        rows: ["......r..r......", "......rr.rR.....", "......ryrrR.....", ".....ryyrrR.....", ".....ryrrRR.....", ".....rrrrRR.....", "....xrrrrRRx....", "...xxxrrrRxxx...", "..xxxxxRRxxxx...", "..xx.......xx...", "..x.........x..."],
      },
    },
    up: { front: { y: -5, rows: [".......r........", "......rrR.......", "......rrRR......", ".....rrrrR......", ".....rrrrRR.....", ".....rrrrRR.....", "....xrrrrRRx....", "...xxxrrrRxxx...", "..xxxxrrrRxxxx..", "..xxxxrrRRxxx...", "..xxxxrrRRxxx...", "..xxxxrrRxxxx...", "..xxxxxrRxxxx...", "...xxxxRRxxx....", "...xxxxxxxxx...."] } },
    side: {
      front: {
        y: -5,
        rows: ["......r..r......", ".....ry.rr.r....", "....ryyrryrr.r..", "...ryyrrrrrrrr..", "...rrrrrrrrrrrR.", "..xrrrrrrrrrrRR.", "..xxxxxxxxxxRRR.", "..xxxxxxxxxxxRR.", ".....xxxxxxxxR..", ".....xxxxxxxxx..", ".....sxxxxxxxx..", ".....Sxxxxxxx...", "......xxxxxx...."],
      },
    },
  },
  Afro: {
    down: {
      front: {
        x: -1,
        y: -4,
        rows: [
          "....rr.rrr.rr.....",
          "...ryyrryyrrrrr...",
          "..ryyrrryrrrrRrr..",
          ".rryrrRrrrrRrrrRr.",
          ".ryrrrrrrRrrrRrRR.",
          "rryrRrrrrrrRrrrRRr",
          "rrrrrrRrrRrrrRrRRR",
          ".rrRrrrrrrrrRrrRRR",
          "rrrrRrrRRrrRrRRRRr",
          "rrRS..........RRR.",
          "rrr...........RRRR",
          ".rR...........RrR.",
          "rrr...........RRR.",
          ".rR...........RR..",
          "..R...........R...",
        ],
      },
    },
    up: {
      front: {
        x: -1,
        y: -4,
        rows: [
          "....rr.rrr.rr.....",
          "...rrrrrryrrrrr...",
          "..rrrRrrrrrrrRrr..",
          ".rrrrrrrRrrrrrrRr.",
          ".rrRrrrrrrrRrrrRR.",
          "rrrrrrRrrrrrrrRRRr",
          "rrrrrrrrrRrrrRrRRR",
          ".rrRrrrrrrrrrrrRRR",
          "rrrrrrRrrrRrrRRRRr",
          "rrrrRrrrrrrrrRRRR.",
          ".rrrrrrrRrrrRrRRRR",
          ".rRrrrrrrrrrrRRRR.",
          "..rrrRrrrRrrRRRR..",
          "...RrRRrRRrRRRR...",
          ".....R..R..R......",
        ],
      },
    },
    side: {
      front: {
        x: -1,
        y: -4,
        rows: [
          ".....rr.rrr.rr....",
          "...rryyrryrrrrr...",
          "..ryyrrryrrrRrrr..",
          ".ryrrrRrrrrrrRrrr.",
          ".ryrrrrrRrrrRrrRR.",
          "rrrrRrrrrrrRrrrRRr",
          "rRrrrrRrrRrrrRrRRR",
          "rRRSSRrrrrrrRrrRRR",
          ".S..SRrrrRrrrRRRRr",
          "......sRrrrRrRRRR.",
          "......SRrRrrrRRRRR",
          ".......RrrrRrRRRR.",
          "........RRrRRRRR..",
          ".........RRRRR....",
        ],
      },
    },
  },
  Puffs: {
    down: {
      front: {
        x: -1,
        y: -5,
        rows: [
          ".rrrr........rrrR.",
          "ryyrrR......ryrrRR",
          "ryrrrR......rrrrRR",
          "rrrrRR......rrrRRR",
          ".rRRR.rrrrrr.RRRR.",
          "....rryyrrrrrr....",
          "...ryyrrrrrrrrR...",
          "...rrrrrrrrrrrR...",
          "...rrRrrrrRrrRR...",
          "...r..........R...",
        ],
      },
    },
    up: {
      front: {
        x: -1,
        y: -5,
        rows: [
          ".rrrr........rrrR.",
          "ryyrrR......ryrrRR",
          "ryrrrR......rrrrRR",
          "rrrrRR......rrrRRR",
          ".rRRR.rrrrrr.RRRR.",
          "....rrrrrrrrrr....",
          "...rrrrrrrrrrrR...",
          "...rrrrrrrrrrrR...",
          "...rrrrrrrrrrrR...",
          "...rrrrrrrrrrRR...",
          "...rrrrrrrrrrRR...",
          "...rrrrrrrrrRRR...",
          "....RrRrRrRrRR....",
        ],
      },
    },
    side: {
      back: { x: 9, y: -5, rows: [".rrrr..", "ryyrrR.", "ryrrrRR", "rrrrRRR", ".rRRRR."] },
      front: { y: 0, rows: [".....rrrrr......", "...rryyrrrrr....", "..ryyrrrrrrrR...", "..rRrrrrrrrrR...", "....SrrrrrrrR...", "......rrrrrrR...", "......sRrrrRR...", "......SRrrRR....", "........RRR....."] },
    },
  },
};
