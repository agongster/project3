/**
 * The building blocks every character picture is assembled from.
 *
 * Every part is a string grid (see engine.ts) placed on a shared "body
 * grid": 16 px wide, rows numbered from the top of the head (row 1) to the
 * shoes (row 18). Parts may start above row 0 (hair volume, hats) or stick
 * out sideways (wings, capes), so each part says where its top-left corner
 * goes: {x, y}. The body grid can reach from x = -1 to x = 16 and still keep
 * room for the outline inside the 20 px frame.
 *
 * Grids have NO outlines: the generator adds a coloured outline around the
 * finished silhouette automatically. Palette keys of the LOOK palette
 * (characterPalette.ts):
 *
 *   s skin   S skin shade   t skin highlight   o dark line (chin)
 *   e eye line   i iris (eye colour)   E eye shine / white
 *   m mouth  M mouth inside   T tongue
 *   n blush  f freckle  d beauty mark  j scar  q face paint  l/L bandage
 *   r hair   R hair shade   y hair highlight   x shaved-short hair   (S in hair = shadow on skin)
 *   c outfit C outfit shade h outfit highlight
 *   u second colour  U its shade  v its highlight
 *   w shirt  W its shade   p pants  P pants shade   b shoe  B shoe shade   g gold / trim
 *
 * Hats, eyewear and back items have their own small palettes (a value
 * "@name" borrows one of the look's named colours, e.g. "@hair").
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

/**
 * Something with a layer BEHIND the head and body and a layer drawn OVER
 * them, per view: long hair falls behind the shoulders, a backpack's
 * straps cross the chest. Either layer may be missing.
 */
export interface Layered {
  down: { back?: Part; front?: Part };
  up: { back?: Part; front?: Part };
  side: { back?: Part; front?: Part };
}

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

// ───────────────────────────── legs ─────────────────────────────

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

/** The top rows of most hair styles: a rounded cap with a highlight on the left. */
export const CAP_TOP = [
  "....rrrrrrr.....",
  "..rrryyyrrrrr...",
  ".rryyyrrrrrrrR..",
  ".ryyrrrrrrrrrrR.",
];

