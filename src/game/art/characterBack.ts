/**
 * Things worn on the back. Seen from the front or the side most of the item
 * is hidden behind the hero (its BACK layer is drawn first, so only the
 * edges peek out), plus maybe a strap across the chest (FRONT layer). Seen
 * from behind ("up") the item covers the hero's back: it is all FRONT layer.
 * The FRONT layer is drawn over the hair too, so long hair tucks under a
 * cape instead of hiding it.
 */
import type { Layered } from "./characterParts";

export interface BackItemArt extends Layered {
  /** Grid key → colour; "@accent", "@hair", ... borrow the look's colours (characterPalette.ts). */
  pal: Record<string, string>;
}

const LEATHER = { a: "#a0683e", A: "#774a2e", z: "#c98d55", k: "#5a3a2a", g: "#ffd34d" };

export const BACK_ART: Record<string, BackItemArt> = {
  Cape: {
    pal: { a: "@accent", A: "@accentShade", z: "@accentLight", g: "#ffd34d" },
    down: {
      back: { y: 12, rows: ["....aaaaaaaa....", "...aaaaaaaaaa...", "...aaaaaaaaaaA..", "..zaaaaaaaaaaA..", "..zaaaaaaaaaaAA.", "..AaAAaAAaAAAA.."] },
      front: { y: 12, rows: [".....g...g......"] },
    },
    up: {
      front: { y: 12, rows: ["....zaaaaaaA....", "...zaaaaaaaaA...", "...zaAaaAaaAA...", "..zaaAaaAaaaAA..", "..zaaAaaAaaaAA..", "..AaAAaAAaAAAA.."] },
    },
    side: {
      back: { y: 12, rows: [".........aa.....", ".........aaA....", ".........aaaA...", "........zaaaA...", "........zaaaAA..", ".......AaAaAA..."] },
      front: { y: 12, rows: ["......ag........"] },
    },
  },
  Backpack: {
    pal: LEATHER,
    down: {
      back: { y: 12, rows: ["...aaaaaaaaaa...", "...aaaaaaaaaaA..", "...aaaaaaaaaaA..", "...AAAAAAAAAAA.."] },
      front: { y: 13, rows: [".....k....k.....", ".....k....k.....", ".....k....k....."] },
    },
    up: {
      front: { y: 12, rows: ["....zzaaaaaA....", "...zaaaaaaaaA...", "...zAAAAAAAAA...", "...zaaagaaaaA...", "....AAAAAAAA...."] },
    },
    side: {
      back: { y: 12, rows: [".........zaa....", "........zaaaA...", "........zAAAA...", "........zaagA...", ".........AAA...."] },
      front: { y: 12, rows: ["........k.......", ".......k........", ".......k........"] },
    },
  },
  Wings: {
    pal: { a: "#f4f0ff", A: "#c7bde8", z: "#ffffff" },
    down: {
      back: { x: -1, y: 8, rows: ["zz..............zz", "zaa............aaz", "zaaa..........aaaz", ".aaaa........aaaa.", ".AaaA........AaaA.", "..AAA........AAA..", "...A..........A..."] },
    },
    up: {
      front: { x: -1, y: 8, rows: ["zz..............zz", "zaa............aaz", "zaaa..........aaaz", ".aaaaa......aaaaa.", ".AaaaAa....aAaaaA.", "..AAAaa....aaAAA..", "...A..A....A..A..."] },
    },
    side: {
      back: { y: 8, rows: ["..............zz", ".............zaz", "...........zzaaa", "..........zaaaaA", ".........zaaaaA.", ".........aaaaA..", ".........AaaA...", "..........AA...."] },
    },
  },
  Quiver: {
    pal: { ...LEATHER, f: "#e5484d", F: "#fff4e6", t: "#d8c49a" },
    down: {
      back: { y: 7, rows: ["..............fF", "..............Ff", ".............tt.", ".............aa.", "............aaA.", "............aA.."] },
      front: { y: 12, rows: ["..........k.....", ".........k......", "........k.......", ".......k........", "......k........."] },
    },
    up: {
      front: { y: 7, rows: [".....Ff.........", ".....fF.........", "......tt........", "......azaA......", ".......azaA.....", "........azaA....", ".........azaA...", "..........aAA...", "...........A...."] },
    },
    side: {
      back: { y: 7, rows: ["..............fF", "..............Ff", ".............tt.", "............azA.", "...........azA..", "..........azA...", ".........azA....", ".........AA....."] },
      front: { y: 12, rows: [".......k........", "......k.........", ".....k.........."] },
    },
  },
  Tail: {
    pal: { a: "@hair", A: "@hairShade", z: "@hairLight", w: "#fff4e6" },
    down: {
      back: { y: 11, rows: [".............ww.", "............zaw.", "............aaA.", "...........aaA..", "...........aA..."] },
    },
    up: {
      front: { y: 11, rows: ["...........Aww..", "..........Azaw..", "..........AaaA..", ".........AaaA...", ".......AaaaA....", "......AaAA......"] },
    },
    side: {
      back: { y: 10, rows: ["............ww..", "...........zaw..", "...........aaA..", "..........aaA...", ".........aaA....", "........aAA....."] },
    },
  },
};
