/**
 * Outfits: the torso picture per view (rows 12+; the legs are LEGS in
 * characterParts.ts) and the "recipe" that colours it.
 *
 * Every outfit has a main colour (c/C/h) and a SECOND colour that paints one
 * part of it: the trousers, the shirt underneath, a trim (u/U/v) or the gold
 * details. When the player keeps the second colour on "Classic", each outfit
 * uses the pairing it was designed with, and the five original outfits look
 * exactly as they always did.
 */
import type { Part, View } from "./characterParts";

/** Which pixels an outfit's second colour paints. */
export type SecondRole = "pants" | "shirt" | "trim" | "gold";

export interface OutfitStyle {
  second: SecondRole;
  /**
   * The second colour on "Classic". Without it the role keeps its plain
   * default: trousers `pants`, the white shirt, the main colour (a
   * one-colour outfit) or gold.
   */
  classic?: string;
  /** What fills the leg pixels: trousers, the outfit colour, bare skin, or the robe's hem. */
  legs: "pants" | "outfit" | "skin" | "robe";
  /** Trouser colour (when the second colour does not choose it). */
  pants?: string;
  shoe: string;
  /** Gold details on [normal, very light] cloth, when the second colour does not choose them. */
  gold?: readonly [string, string];
}

export const DEFAULT_PANTS = "#4b5a8c";
export const DEFAULT_GOLD: readonly [string, string] = ["#ffd34d", "#ffd34d"];
const BROWN_SHOE = "#6b4a3a";

export const OUTFIT_STYLES: Record<string, OutfitStyle> = {
  Tee: { second: "pants", legs: "pants", pants: DEFAULT_PANTS, shoe: BROWN_SHOE },
  Hoodie: { second: "pants", legs: "pants", pants: "#3f4560", shoe: BROWN_SHOE },
  Overalls: { second: "shirt", legs: "outfit", shoe: BROWN_SHOE },
  Dress: { second: "trim", legs: "skin", shoe: "#c0405a", gold: ["#fff4f7", "#ff8fab"] },
  Robe: { second: "gold", legs: "robe", shoe: "#4a3a5a" },
  Jacket: { second: "shirt", legs: "pants", pants: "#3f4560", shoe: BROWN_SHOE },
  Sweater: { second: "trim", classic: "#f4ead8", legs: "pants", pants: DEFAULT_PANTS, shoe: BROWN_SHOE },
  Apron: { second: "trim", classic: "#f7f1e6", legs: "pants", pants: "#5a4a52", shoe: BROWN_SHOE },
  Armor: { second: "trim", classic: "#b9c2d4", legs: "pants", pants: "#4a4458", shoe: "#5a4650" },
  Cloak: { second: "trim", classic: "#e8d6b0", legs: "pants", pants: "#4a4458", shoe: BROWN_SHOE },
  Sporty: { second: "trim", classic: "#f7f7f7", legs: "skin", shoe: "#f1f3f5" },
  Kimono: { second: "trim", classic: "#f2c94c", legs: "robe", shoe: "#8a5a3a" },
  Tunic: { second: "trim", classic: "#7a5238", legs: "pants", pants: "#6b5a48", shoe: "#5a3e30" },
};

/** Torso (and skirt) per outfit and view. */
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
    down: { y: 12, rows: [".....uUUUu......", "....hcccccCc....", "....sccgcccs....", "...hhcccccccC...", "..hccccccccccC..", "..UUuUUuUUuUUU.."] },
    up: { y: 12, rows: [".....uuuuuu.....", "....hcccccCc....", "....sccgggcs....", "...hhccgcccC....", "..hccccccccccC..", "..UUuUUuUUuUUU.."] },
    side: { y: 12, rows: [".....uuUu.......", "....hhccc.......", "....csgccC......", "...hcsccccC.....", "..hcccccccC.....", "..UuUUuUUUU....."] },
  },
  Robe: {
    down: { y: 12, rows: [".....hcCCc......", "...hhhcccccc....", "...cscggggcsC...", "...ccccgcccCC...", "....hccgcccC....", "....CCCCCCCC...."] },
    up: { y: 12, rows: [".....cccccc.....", "...hhcccccccc...", "...csggggggsC...", "...ccccccccCC...", "....hcccccccC...", "....CCCCCCCC...."] },
    side: { y: 12, rows: [".....hcCc.......", "....hhcccc......", "...hccsgcC......", "...cccsccC......", "....hcccccC.....", "....CCCCCC......"] },
  },
  // ── added in round four: the second colour shows on each of these by default ──
  Jacket: {
    down: { y: 12, rows: [".....cwwwc......", "....hcwwwwCc....", "....scwWwwCs....", "....sCwwwWCs....", ".....CppppC....."] },
    up: { y: 12, rows: [".....cCCCc......", "....hccccccC....", "....scccccCs....", "....sCCcCCCs....", ".....CCCCCC....."] },
    side: { y: 12, rows: [".....wcCc.......", "....hwcccC......", "....wscccC......", "....CsCCCC......", ".....CpPC......."] },
  },
  Sweater: {
    down: { y: 12, rows: [".....UuuuU......", "....hccccccc....", "....uuuuuuuu....", "....sCcCcCCs....", ".....UuUuUU....."] },
    up: { y: 12, rows: [".....UuuuuU.....", "....hccccccc....", "....uuuuuuuu....", "....scCcCcCs....", ".....UuUuUU....."] },
    side: { y: 12, rows: [".....UuuU.......", "....hhcccc......", "....uuuuuu......", "....CsCcCC......", ".....UuUU......."] },
  },
  Apron: {
    down: { y: 12, rows: [".....cuUuc......", "....hcuuuucc....", "....scuUuucs....", "....suuuuuUs....", ".....uuUuuU....."] },
    up: { y: 12, rows: [".....cccccc.....", "....hcucccuc....", "....sccucucs....", "....suuuuuus....", ".....ppuUpp....."] },
    side: { y: 12, rows: [".....ucCc.......", "....hucccC......", "....uscccC......", "....usCCCC......", "....uupppP......"] },
  },
  Armor: {
    down: { y: 12, rows: [".....UvvvU......", "...vvuvvvuuUU...", "....suvvuuUs....", "....sUuuuUUs....", ".....cCcCcC....."] },
    up: { y: 12, rows: [".....UuuuU......", "...vvuuuuuuUU...", "....suvuuuUs....", "....sUUUUUUs....", ".....cCcCcC....."] },
    side: { y: 12, rows: [".....UvuU.......", "....vvvuuU......", "....usvuuU......", "....UsUUUU......", ".....cCcC......."] },
  },
  Cloak: {
    down: { y: 12, rows: ["....hccgccC.....", "...hcccuucccC...", "...hccuwwuccC...", "...cccuwwuccCC..", "...ccCuppuCcCC..", "...CCCC..CCCC..."] },
    up: { y: 12, rows: [".....cccccc.....", "...hcccccccCC...", "...hccccccccC...", "...hcccccccCCC..", "...ccCccCccCCC..", "...CCCCCCCCCC..."] },
    side: { y: 12, rows: [".....ccgc.......", "....hccccC......", "...hcccccCC.....", "...ucccccCC.....", "...uccccCCC.....", "...CCCCCCC......"] },
  },
  Sporty: {
    down: { y: 12, rows: [".....uUUUu......", "....ucccccCu....", "....scuuuucs....", "....sCccccCs....", ".....uCCCCu....."] },
    up: { y: 12, rows: [".....UUUUUU.....", "....ucccccCu....", "....scccccCs....", "....sCccccCs....", ".....uCCCCu....."] },
    side: { y: 12, rows: [".....uuUu.......", "....uccccC......", "....cscccC......", "....CsCCCC......", ".....uCCC......."] },
  },
  Kimono: {
    down: { y: 12, rows: [".....cwcwc......", "...hhccwcccCC...", "...hccccccccC...", "...suuuguuuus...", "....cccccccC....", "....CcCCCcCC...."] },
    up: { y: 12, rows: [".....cccccc.....", "...hhccccccCC...", "...hcccccccCC...", "...suuuuuuuus...", "....cccuUcccC...", "....CcCCCcCC...."] },
    side: { y: 12, rows: [".....wcCc.......", "...hhcccC.......", "...hccsccC......", "...uuuuuuU......", "....ccccccC.....", "....CcCCCC......"] },
  },
  Tunic: {
    down: { y: 12, rows: [".....cCsCc......", "....hccsccCc....", "....sccccccs....", "....suuuguus....", "....hcCcCcCC...."] },
    up: { y: 12, rows: [".....cccccc.....", "....hccccccC....", "....scccccCs....", "....suuuuuus....", "....hcCcCcCC...."] },
    side: { y: 12, rows: [".....sCc........", "....hhcccC......", "....cscccC......", "....usuguU......", "....hcCcCC......"] },
  },
};
