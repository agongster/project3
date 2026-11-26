/**
 * Long hair styles and the head covering added in round four: Braids, Locs,
 * Wavy, Twintails and Hijab. Same layout as characterHair.ts. The Hijab is
 * drawn in the "hair colour" (the creator calls it the scarf colour) and
 * drapes over the collar, so it lives in the front layer down to row 14.
 */
import { CAP_TOP, type Layered } from "./characterParts";

/** The top of a long style with a centre parting (as in Long). */
const PARTED_TOP = [
  "....rrrrrrr.....",
  "..rrryyRyrrrr...",
  ".rryyyrRrrrrrR..",
  ".ryyrrrRRrrrrrR.",
  ".rrrrrRSSRrrrRR.",
  ".rrrrRS..SRrrRR.",
  ".rrrRS....SRrRR.",
  ".rrR........RRR.",
];

export const HAIR_LONG: Record<string, Layered> = {
  Braids: {
    down: {
      front: {
        y: -1,
        rows: [...PARTED_TOP, ".rR..........Rr.", ".Rr..........rR.", ".rR..........Rr.", ".Rr..........rR.", "..rR........Rr..", "..Rr........rR..", "..rR........Rr..", "..kk........kk..", "..r..........r.."],
      },
    },
    up: {
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrrRR.", ".rrRrrrrrrrrRRR.", ".rR.RrrrrrrR.RR.", ".Rr..RrrrrR..rR.", ".rR...RRRR...Rr.", ".Rr..........rR.", "..rR........Rr..", "..Rr........rR..", "..rR........Rr..", "..kk........kk..", "..r..........r.."],
      },
    },
    side: {
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".RRRrrrrrrrrrRR.", ".S..SRrrrrrrrRR.", ".....sRrrrrrrRR.", ".....rRrrrrrRR..", ".....Rr.RRRRR...", ".....rR.........", ".....Rr.........", ".....rR.........", ".....Rr.........", ".....kk.........", ".....r.........."],
      },
    },
  },
  Locs: {
    down: {
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", "rrRrrRrrRrrRrRRR", "rRrSrRSSRrSRrRRR", "rRr.R......R.RrR", "rRr..........RrR", "rRr..........RrR", "rRr..........RrR", "rRr..........RrR", "rRr..........RrR", ".R.r........r.R.", ".r.R........R.r."],
      },
    },
    up: {
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", "rrRrrRrrRrrRrRRR", "rRrRrRrRrRrRrRRR", "rRrRrRrRrRrRrRrR", "rRrRrRrRrRrRrRrR", "rRrRrRrRrRrRrRrR", "rRrRrRrRrRrRrRrR", "rRrRrRrRrRrRrRrR", "rRrRrRrRrRrRrRrR", ".RrR.RrR.RrR.RR.", ".r.R.r.R.r.R.R.R", "...r...R...r...."],
      },
    },
    side: {
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", "rRRrRrRrrRrRrRRR", "RS.SRrRrRrRrRrRR", ".....rRrRrRrRrRR", ".....sRrRrRrRrRR", ".....SRrRrRrRrRR", "......RrRrRrRrRR", "......rRrRrRrRrR", "......R.RrRrRrR.", "........r.R.r.R."],
      },
    },
  },
  Wavy: {
    down: {
      back: { y: 7, rows: ["rr...........RR.", ".rr..........RRR", "..rr........RRR.", ".rr..........RR.", "rrr..........RRR", ".rr..........RRR", "..rR........RRR.", ".rR..........RR.", "rR...........RR.", ".R............R."] },
      front: {
        y: -1,
        rows: ["....rrrrrrr.....", "..rrryyyyrrrr...", ".rryyyrrrrrrrR..", ".ryyrrrrrRrrrrR.", ".rrrrrRRRSRrrRR.", ".rryRRS...SRrRR.", "rryRS......SRrR.", ".rrS........RRR", "rr...........RR."],
      },
    },
    up: {
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".rrryrrrrrrrrRR.", ".rrrryrrrrrrrRR.", ".rrrrryrrrrrrRR.", ".rrrryrrrrrrrRR.", ".rrryrrrrrrrrRR.", "rrrryrrrrrrrRRRR", ".rrrryrrrrrrRRRR", "..rrrryrrrrrRRR.", ".rrrryrrrrrrRRR.", "rrrryrrrrrrRRRRR", ".rrryrrrrrRRRRR.", ".rRrRrrRrRRRRRR.", "..R.R..R..R.R..."],
      },
    },
    side: {
      back: { y: 6, rows: ["..........rRR...", "...........rRR..", "..........rRRR..", ".........rrRRR..", "..........rrRRR.", "...........rRRR.", "..........rrRR..", ".........rrRRR..", "..........rRRR..", "...........RR.R."] },
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".RRRrrrrrrrrrRR.", ".S..SRrrrrrrrRR.", ".....sRrrrrrrRR.", ".....SRrrrrrRR..", "......RrrrrrrRR.", "......RrrrrrRRR."],
      },
    },
  },
  Twintails: {
    down: {
      front: {
        x: -1,
        y: -1,
        rows: [
          ".....rrrrrrr......",
          "...rrryyyrrrrr....",
          "..rryyyrrrrrrrR...",
          ".kryyrrrrrrrrrrRk.",
          "rrrrrrrrrrrrrrRRRR",
          "ryrrRrrrRrrrRrRRRR",
          "ryrrRSSrRSSrRSRRRR",
          "rR..............RR",
          "rR..............RR",
          "rR..............RR",
          "rR..............RR",
          ".R..............R.",
          ".R..............R.",
        ],
      },
    },
    up: {
      front: {
        x: -1,
        y: -1,
        rows: [
          ".....rrrrrrr......",
          "...rrrrrrrrrrr....",
          "..rrrrrrrrrrrrR...",
          ".krrrrrrrrrrrrrRk.",
          "rrrrrrrrrrrrrrRRRR",
          "ryrrrrrrrrrrrrRRRR",
          "ryrrrrrrrrrrrrRRRR",
          "rR.rrrrrrrrrrRR.RR",
          "rR.rrrrrrrrrRRR.RR",
          "rR..rrrrrrrRRR..RR",
          "rR..RRrRRrRRRR..RR",
          ".R...R..R..R....R.",
          ".R..............R.",
        ],
      },
    },
    side: {
      back: { x: 8, y: 1, rows: ["..kk...", ".rrrR..", "rrrrRR.", "rrrrRRR", ".rrrRRR", "..rrRRR", "..rrRRR", "...rRRR", "...rRR.", "...RRR.", "....R.."] },
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".RRrrrrrrrrrRRR.", ".SRSSrrrrrrrRRR.", "....SRrrrrrRRR..", ".....sRrrrRRR...", ".....SRRRRRR...."],
      },
    },
  },
  Hijab: {
    down: {
      front: {
        y: -1,
        rows: [...CAP_TOP, ".ryrrrrrrrrrrRR.", ".rrrRRRRRRRRrRR.", ".rrR........RRR.", ".rr..........RR.", ".rr..........RR.", ".rr..........RR.", ".rrR........RRR.", ".rrrR......RRRR.", "..rrrRRRRRRRRR..", "..rrrrrrrrrrrR..", ".rrrrrrrrrrrrRR.", ".RRrrrrrrrrrRRR.", "..RRRRRRRRRRRR.."],
      },
    },
    up: {
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrrRR.", ".rrrrrrrrrrrRRR.", "..rrrrrrrrrrRR..", "..rrrrrrrrrrRR..", ".rrrrrrrrrrrRRR.", ".rrrrrrrrrrRRRR.", "..RRRRRRRRRRRR.."],
      },
    },
    side: {
      front: {
        y: -1,
        rows: [...CAP_TOP, ".rrrrrrrrrrrrRR.", ".rRRRrrrrrrrrRR.", ".R...RrrrrrrrRR.", ".....RrrrrrrrRR.", ".....rrrrrrrrRR.", ".....rrrrrrrrRR.", ".R...RrrrrrrrRR.", ".rR.RrrrrrrrRRR.", "..rrrrrrrrrrRR..", "...rrrrrrrrrRR..", "...rrrrrrrrrRRR.", "...RrrrrrrrRRRR.", "....RRRRRRRRR..."],
      },
    },
  },
};
