/**
 * The colour families of every monster species, as plain palettes.
 *
 * A family is how a player learns what KIND of bug a monster is: the same
 * rule always wears the same colours (which rule wears which family is data
 * in src/lib/game/monsterLooks.ts, LOOK_FAMILIES; the lists below follow its
 * order exactly, and family 0 is always the species' classic look).
 *
 * The grid species are re-coloured for free by swapping their palette (see
 * engine.ts, "palette swap"): each family below only lists the letters it
 * changes; `family()` fills in the rest from the classic palette. The
 * procedurally drawn species (Spaghetti Beast and the bosses) get named tone
 * ramps their painters take as a parameter.
 */
import { INK } from "./color";
import type { Palette } from "./engine";

/** The classic palette with some letters replaced. */
function family(base: Palette, changes: Palette): Palette {
  return { ...base, ...changes };
}

// ───────────────────────────── Minions ─────────────────────────────

/** Lilac-grey fluff. p = pink (inner ear, blush), m = mouth, c = eye reflection. */
const BUNNY = { h: "#f3eefa", b: "#cbc2e0", s: "#a39ac3", d: "#7d73a3", p: "#ff9ec4", m: "#a8507e", c: "#8a7fb8" };

/** Import (lilac dust) · Variable (sandy) · Loop (mint-grey). */
export const BUNNY_FAMILIES: readonly Palette[] = [
  BUNNY,
  family(BUNNY, { h: "#fff3e0", b: "#f2c99a", s: "#d9a273", d: "#b07a52", p: "#ff8f8f", m: "#a0504a", c: "#b88a60" }),
  family(BUNNY, { h: "#effaf4", b: "#b9dcc9", s: "#8fbaa6", d: "#64907f", p: "#ffb0c8", m: "#4a7a68", c: "#6e9c8a" }),
];

/** Blue beetle with a stolen sticky note. y/Y/l = note, f = folded corner, e/E = head & legs, a = antennae. */
const MITE = { h: "#a6e2fa", b: "#4ea8dc", s: "#3577b8", d: "#2b4f8a", e: "#46386a", E: "#6a5a94", y: "#ffe46b", Y: "#f3c54a", l: "#d99a3a", f: "#fff6c2", a: INK };

/** TODO (blue, yellow note) · FIXME (red, pink note) · Hack (purple, orange note) · Fossil (grey-green, white note). */
export const MITE_FAMILIES: readonly Palette[] = [
  MITE,
  family(MITE, { h: "#ffb3a8", b: "#e5554d", s: "#b83a3e", d: "#842a3a", e: "#4a2236", E: "#7a3a50", y: "#ffc4dc", Y: "#f59ac0", l: "#c0507e", f: "#ffe6f0" }),
  family(MITE, { h: "#dcc2ff", b: "#9a6ae0", s: "#7448b8", d: "#523090", y: "#ffc070", Y: "#f0a040", l: "#c06a20", f: "#ffe4bc" }),
  family(MITE, { h: "#d4e0c8", b: "#94a888", s: "#6e8466", d: "#4e6048", e: "#3e4438", E: "#5e6656", y: "#f4f2ea", Y: "#dcd8cc", l: "#9a968a", f: "#ffffff" }),
];

/** Round purple bat. m = wing membrane, M = wing bones, f = fang, c = belly. */
const BAT = { h: "#c9a2f7", b: "#8f66d6", s: "#6a47b0", d: "#4e3390", m: "#a77ee8", M: "#5b3a9e", f: "#ffffff", c: "#dcc6fb" };

/** Simplify (purple) · Compare (teal) · Twin (pink) · Idle (orange). */
export const BAT_FAMILIES: readonly Palette[] = [
  BAT,
  family(BAT, { h: "#a2f0e8", b: "#3fbfb4", s: "#2a9690", d: "#1e6e70", m: "#6edcd0", M: "#21706e", c: "#d2fbf5" }),
  family(BAT, { h: "#ffc2e2", b: "#e66aa8", s: "#bd4a88", d: "#8f3468", m: "#f590c4", M: "#9a3a72", c: "#ffe0ef" }),
  family(BAT, { h: "#ffd7a0", b: "#e8913c", s: "#bd6a2a", d: "#8a4a22", m: "#f5ad62", M: "#94501f", c: "#ffeccc" }),
];

// ───────────────────────────── Elites ─────────────────────────────

/** Green imp. p = pink inner ear, y = yellow eye, n/N = bone horns (light / dark). */
const GREMLIN = { h: "#aee67e", b: "#6cc24a", s: "#4a9a3e", d: "#2f7038", p: "#ff9ec4", y: "#fff6a0", n: "#fbf3dc", N: "#c8b48a" };

/** Pyflakes (green) · Gotcha (orange) · Crash (red) · Network (steel blue). */
export const GREMLIN_FAMILIES: readonly Palette[] = [
  GREMLIN,
  family(GREMLIN, { h: "#ffc98a", b: "#ec8a3c", s: "#c0652c", d: "#8a4422", p: "#ffb0c4" }),
  family(GREMLIN, { h: "#ff9e9e", b: "#de4a5a", s: "#b03048", d: "#7a2238", p: "#ffd0dc", y: "#fff07a" }),
  family(GREMLIN, { h: "#b8d4f4", b: "#6a92c8", s: "#4c6ea4", d: "#334e7e", p: "#ffb0c8", y: "#c8fff4" }),
];

/** Translucent ghost (real alpha). o = open mouth, c = blush; `line` is its soft outline. */
const PHANTOM = { h: "#d4fff8d8", b: "#7fe3d6c0", s: "#52bcc4b8", d: "#3a90a8b0", o: "#2b1d34e0", c: "#ffb3d0c0", k: "#2b1d34e8", line: "#1f4e64d8" };

/** Nameless (teal) · Export (lavender) · Early (amber). `line` is not a grid letter: it is the outline colour. */
export const PHANTOM_FAMILIES: readonly Palette[] = [
  PHANTOM,
  family(PHANTOM, { h: "#efe4ffd8", b: "#bfa2f0c0", s: "#9a7ad4b8", d: "#7656b0b0", line: "#3a2a64d8" }),
  family(PHANTOM, { h: "#fff6d0d8", b: "#f2cd6ac0", s: "#d0a448b8", d: "#a07a34b0", line: "#5a3a14d8" }),
];

/** Wood-and-gold chest. y/Y = gold trim, x = dark mouth / seam, e = glowing eye, t/T = tongue, l = keyhole. */
const MIMIC = { h: "#e0a06a", b: "#b8764a", s: "#8a5236", d: "#64382a", y: "#ffe27a", Y: "#e0a72e", x: "#3a1430", e: "#ffe94d", t: "#ff8ab4", T: "#e0558a", l: "#4a2a2a" };

/** Default (wood) · Builtin (white marble, gold trim) · Loop (mossy) · Vault (iron, silver trim, red-eyed). */
export const MIMIC_FAMILIES: readonly Palette[] = [
  MIMIC,
  family(MIMIC, { h: "#fbfbff", b: "#d8d8e6", s: "#aaaac2", d: "#80809c" }),
  family(MIMIC, { h: "#a8d070", b: "#6e9a48", s: "#4e7638", d: "#36542a" }),
  family(MIMIC, { h: "#8a94a4", b: "#55606e", s: "#3c4452", d: "#282e3a", y: "#c8ced8", Y: "#8a94a4", e: "#ff5a5a" }),
];

/** Plump toad. c/C = cream belly, P = throat sac, x = mouth inside, t = tongue, f = feet. */
const TOAD = { h: "#8fe0b8", b: "#4cb88e", s: "#358f78", d: "#286a62", c: "#f6ecc0", C: "#dccf98", P: "#ffe0ea", x: "#5a1a3a", t: "#ff7aa8", f: "#358f78" };

/** Bare (sea-green) · Blind (mustard) · Silent (slate blue) · Lost (pink). */
export const TOAD_FAMILIES: readonly Palette[] = [
  TOAD,
  family(TOAD, { h: "#f4e08a", b: "#d4b040", s: "#a88a30", d: "#7a6428", f: "#a88a30" }),
  family(TOAD, { h: "#a8c0e8", b: "#6a86c0", s: "#4e669c", d: "#3a4c78", f: "#4e669c" }),
  family(TOAD, { h: "#ffbcd8", b: "#e47aa8", s: "#ba5888", d: "#8c4068", f: "#ba5888" }),
];

/** The Spaghetti Beast's tones: noodles (gap → shade → base → glint), sauce and meatballs (light → dark), outline. */
export interface PastaTones {
  noodle: readonly [string, string, string, string];
  sauce: readonly [string, string, string];
  meat: readonly [string, string, string];
  line: string;
}

const MARINARA: PastaTones = {
  noodle: ["#e8b060", "#ffd47a", "#ffeaa8", "#fffbea"],
  sauce: ["#ff9a7a", "#ec5a40", "#b83a32"],
  meat: ["#c98256", "#9a5636", "#6a3424"],
  line: "#5a3424",
};

/** Marinara (red sauce) · Pesto (spinach noodles, green sauce) · Alfredo (white, pale fettuccine) · Squid ink (black pasta). */
export const PASTA_FAMILIES: readonly PastaTones[] = [
  MARINARA,
  { ...MARINARA, noodle: ["#7aa048", "#a8cc68", "#cce890", "#f0ffd8"], sauce: ["#e8ffb0", "#3f9a3e", "#22602a"], line: "#2f4a1e" },
  { ...MARINARA, noodle: ["#d8c090", "#f2e2b4", "#fbf2d6", "#ffffff"], sauce: ["#ffffff", "#ece4d4", "#bdb09a"], line: "#6a5636" },
  { noodle: ["#14141e", "#2c2c3c", "#464660", "#7a7aa0"], sauce: ["#d8d8f0", "#9a9ac0", "#5a5a82"], meat: ["#c98256", "#9a5636", "#6a3424"], line: INK },
];

// ───────────────────────────── Bosses ─────────────────────────────

/** The Key Thief's hood, dark → light (as `litBlobs` expects). */
export const THIEF_HOODS: readonly (readonly string[])[] = [
  ["#2e2460", "#463a8c", "#6656b8", "#8a7ad8"], // Password: purple
  ["#143e44", "#22646a", "#348e90", "#5cbcb4"], // Argument: teal
  ["#4a1626", "#742636", "#a2384a", "#cc6068"], // Default: crimson
  ["#101016", "#22222c", "#363644", "#525266"], // Eavesdropper: black
];

/** The Eval Serpent's tones: scales (dark → light), belly, the code glyphs (two brightnesses) and the eye. */
export interface SerpentTones {
  scales: readonly [string, string, string, string];
  belly: readonly [string, string, string];
  glyph: readonly [string, string];
  eye: string;
}

const EVAL: SerpentTones = {
  scales: ["#262a6e", "#3a46a8", "#5568d8", "#8a9cf4"],
  belly: ["#d9a42e", "#ffd86a", "#fff2b0"],
  glyph: ["#5cf2ff", "#c8fbff"],
  eye: "#d6ff5c",
};

/** Eval (blue) · Shell (terminal green) · SQL (amber) · Pickle (purple with pickle-green glyphs). */
export const SERPENT_FAMILIES: readonly SerpentTones[] = [
  EVAL,
  { scales: ["#123a1e", "#1e6034", "#2e9a4c", "#66d880"], belly: ["#2a2a2a", "#3e3e3e", "#5a5a5a"], glyph: ["#b6ff5a", "#eaffc8"], eye: "#ffd24a" },
  { scales: ["#5a3410", "#8a5418", "#c0801e", "#f0b44a"], belly: ["#c8b890", "#eee2c0", "#fffaf0"], glyph: ["#5cf2ff", "#c8fbff"], eye: "#d6ff5c" },
  { scales: ["#3a1a5a", "#5a2a8a", "#8040b8", "#b47ae6"], belly: ["#d9a42e", "#ffd86a", "#fff2b0"], glyph: ["#7dff9a", "#d0ffe0"], eye: "#7dff6a" },
];

/** The Glitch King's body. b/B/s/d = body ramp, x = face screen, e = eye, z = zigzag mouth, c/C = missing-texture checker. */
const KING = { h: "#8a7ae0", b: "#5c4bb0", s: "#3f3288", d: "#2a2060", x: "#1c1838", e: "#ffffff", z: "#5cf2ff", c: "#ff3ad8", C: "#1c1838" };

/** Glitch (purple) · Compile (teal with a gold checker). */
export const KING_FAMILIES: readonly Palette[] = [KING, family(KING, { h: "#7ae0d0", b: "#2f9e92", s: "#226e6a", d: "#164a48", x: "#0c2626", z: "#ffd23a", c: "#ffd23a", C: "#0c2626" })];
