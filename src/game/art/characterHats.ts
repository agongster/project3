/**
 * Hat pictures (the hats themselves are items in catalog.ts: gacha and chest loot).
 * A hat is drawn last, on top of the hair, and must sit right on every hair
 * style and next to every back item: /dev/art?section=heroes shows them all.
 */
import type { Part } from "./characterParts";

/**
 * Hats sit on top of the hair. `clip`: hair rows above this body-grid row
 * are erased first, so spikes and buns do not poke through a beanie
 * (undefined = keep all hair, e.g. a halo floats above it).
 * Views a hat does not draw reuse its `down` picture.
 * `perch`: the hat rests ON the hair instead of squashing it, so it rises
 * on a voluminous hair style (HAIR_VOLUME in characterHair.ts).
 */
export interface HatArt {
  down: Part;
  up?: Part;
  side?: Part;
  clip?: number;
  perch?: boolean;
  /** Grid key → colour; "@hair" / "@hairShade" borrow the hero's hair colours. */
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
    perch: true,
    pal: { a: "#4dabf7", A: "#2f86d6", z: "#a5d8ff", x: "#ffd43b", X: "#ff6b9a" },
    down: { x: 2, y: -8, rows: ["....XX......", "....xX......", "....aa......", "...zaxa.....", "...axaaA....", "..zaaxaa....", "..xaaaxaA...", ".aaxaaaxaA..", ".XxXxXxXxX.."] },
  },
  headphones: {
    pal: { a: "#3d3a52", A: "#2a2838", z: "#6a6688", x: "#3cc7c0", X: "#2a9a94" },
    down: { y: -2, rows: ["....zaaaaaa.....", "..za......aA....", ".za.........A...", ".a..........A...", "", "", "xxa.........axx.", "xXa.........aXX.", "xXa.........aXX.", ".xx..........xx."] },
    side: { y: -2, rows: ["....zaaaaaa.....", "...a......aA....", "..a.........A...", "..a.........A...", "........aa......", ".......xxxX.....", ".......xXXX.....", ".......xXXX.....", "........xX......"] },
  },
  catEars: {
    perch: true,
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
    perch: true,
    pal: { a: "#ffd43b", A: "#e0a91c", z: "#fff4b3" },
    down: { y: -5, rows: ["....zzaaaaa.....", "...zA.....aA....", "....aAAAAAA....."] },
  },
  crown: {
    clip: 0,
    pal: { a: "#ffd43b", A: "#d99a2b", z: "#fff4b3", x: "#e5484d", X: "#4dabf7" },
    down: { y: -4, rows: ["...z...a...A....", "...za.zaa.aA....", "...zaaaxaaaA....", "...zaXaaaXaA....", "...AAAAAAAAA...."] },
  },
};
