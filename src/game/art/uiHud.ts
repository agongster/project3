/**
 * UI sprites, part 1: HUD and pickups — hearts, coins, chests, key-cap
 * prompts, badges, speech bubbles, gems. String grids, outlined in ink
 * (unless the grid draws its own outline).
 */
import { INK } from "./color";
import { Pix, type Palette } from "./engine";
import { outlined } from "./uiKit";

/** Heart reds (h highlight, r red, R shade), the empty heart's tones, and white shine. */
const HEART = { h: "#ffb3c0", r: "#ff5a6e", R: "#d0304a", e: "#5a4a6e", E: "#46385a", w: "#ffffff" };

/** 9×8 hearts (with outline). Grids are 7×6; the outline makes them 9×8. */
const HEART_FULL = [".rr.rr.", "rwhrrrR", "rhrrrrR", ".rrrrR.", "..rrR..", "...R..."];
const HEART_HALF = [".rr.ee.", "rwhreeE", "rhrreeE", ".rrreE.", "..rrE..", "...E..."];
const HEART_EMPTY = [".ee.ee.", "eEeeeeE", "eeeeeeE", ".eeeeE.", "..eeE..", "...E..."];
/** A 5×4 heart for trails and tiny effects (no outline). */
const HEART_TINY = ["rr.rr", "rhrrR", ".rrR.", "..R.."];
/** A juicier heart dropped by monsters (bobs: 2 frames). */
const HEART_PICKUP = ["..rr...rr..", ".rwhr.rrrR.", "rwhhrrrrrrR", "rhhrrrrrrrR", "rrrrrrrrrRR", ".rrrrrrrRR.", "..rrrrrRR..", "...rrrRR...", "....rRR....", ".....R....."];

export function heart(kind: "full" | "half" | "empty" | "tiny" | "pickup"): Pix {
  if (kind === "tiny") return Pix.fromGrid(HEART_TINY, HEART);
  const rows = { full: HEART_FULL, half: HEART_HALF, empty: HEART_EMPTY, pickup: HEART_PICKUP }[kind];
  return outlined(rows, HEART);
}

// ───────────────────────────── coins ─────────────────────────────

const COIN_PAL = { y: "#ffd34d", Y: "#fff1a0", o: "#e0a02a", O: "#b8741e", w: "#ffffff" };
/** 4-frame spin: face-on, turning, edge-on, turning back. Each is 6 px tall (8 with outline). */
const COIN_SPIN = [
  [".yyyy.", "yYwyyo", "yYyyoo", "yYyyoo", "yyyyoO", ".oooO."],
  [".yyy.", "yYwyo", "yYyoo", "yYyoo", "yyyoO", ".ooO."],
  [".y.", "yYo", "yYo", "yYo", "yYo", ".o."],
  [".yyy.", "yywYo", "yyYoo", "yyYoo", "yoooO", ".ooO."],
];
const COIN_BIG = ["...yyyy...", ".yyYYYYyy.", ".yYwyyyyoo", "yYwyoooyoO", "yYyyoyyyoO", "yYyyoyyyoO", "yYyyoyyyoO", "yyyyoooyoO", ".yyyyyyoO.", "..ooooOO.."];

export function coin(frame: number): Pix {
  return outlined(COIN_SPIN[frame % 4], COIN_PAL, { line: "#7a4a1e" });
}
export function coinBig(): Pix {
  return outlined(COIN_BIG, COIN_PAL, { line: "#7a4a1e" });
}

// ───────────────────────────── chests ─────────────────────────────

/** Classic wood-and-gold chest. h/b/s/d wood, y/Y/o gold, l keyhole, x dark inside, g glow. */
const CHEST_PAL = { h: "#e0a06a", b: "#b8764a", s: "#8a5236", d: "#64382a", y: "#fff1a0", Y: "#ffd34d", o: "#d99a2b", l: "#3a1e2a", x: "#3a1e2a", g: "#fff6c8", G: "#ffe27a", t: "#ff7ad0", T: "#7ae8ff" };

const CHEST_CLOSED = [
  "..hhhhhhhhhh..",
  ".hhbbbbbbbbbs.",
  "yhbbbbYbbbbbsy",
  "yhbbbbYbbbbbsy",
  "oYYYYYyyYYYYYo",
  "oddddYllYddddo",
  "yhbbbYlYYbbbsy",
  "yhbbbbYYbbbbsy",
  "yhbbbbbbbbbbsy",
  "oddddddddddddo",
];
/** The lid lifts a little and light spills out of the gap. */
const CHEST_OPENING = [
  "..hhhhhhhhhh..",
  ".hhbbbbbbbbbs.",
  "yhbbbbYbbbbbsy",
  "yhbbbbYbbbbbsy",
  "oYYYYYyyYYYYYo",
  "ogggGGGGGGgggo",
  "oYYYYYyyYYYYYo",
  "yhbbbYlYYbbbsy",
  "yhbbbbYYbbbbsy",
  "yhbbbbbbbbbbsy",
  "oddddddddddddo",
];
/** Lid flipped up (we see its dark inside), treasure glittering in the box. t/T = gems. */
const CHEST_OPEN = [
  ".hhhhhhhhhhhh.",
  "yhsssssssssssy",
  "ysddddddddddsy",
  "ysddddddddddsy",
  "oYYYYYYYYYYYYo",
  ".gyYyTgyYytYg.",
  "oYYYYYyyYYYYYo",
  "yhbbbbYYbbbbsy",
  "yhbbbYlYYbbbsy",
  "yhbbbbbbbbbbsy",
  "oddddddddddddo",
];

export function chest(state: "closed" | "opening" | "open"): Pix {
  const rows = { closed: CHEST_CLOSED, opening: CHEST_OPENING, open: CHEST_OPEN }[state];
  return outlined(rows, CHEST_PAL);
}

// ───────────────────────────── key prompts ─────────────────────────────

const KEY_PAL = { c: "#fff8ec", C: "#d9cfe8", s: "#a89cc0", k: INK };
/** "E" on a little key cap with a pressed-down edge. */
const KEY_E = [".ccccccc.", "cCkkkkkCs", "cCkCCCCCs", "cCkkkkCCs", "cCkCCCCCs", "cCkkkkkCs", "cCCCCCCCs", ".sssssss."];
/** A wide space-bar cap with a tiny "␣" mark. */
const KEY_SPACE = [".cccccccccccccc.", "cCCCCCCCCCCCCCCs", "cCCkCCCCCCCCkCCs", "cCCkkkkkkkkkkCCs", "cCCCCCCCCCCCCCCs", ".ssssssssssssss."];

export function keyCap(which: "E" | "Space"): Pix {
  return outlined(which === "E" ? KEY_E : KEY_SPACE, KEY_PAL);
}

// ───────────────────────────── badges & bubbles ─────────────────────────────

/** A cute skull badge (bug counter on cursed buildings). */
const SKULL = [".bbbbbb.", "bhhbbbbs", "hkkbbkks", "hkkbbkks", "bbbbkbbs", ".sbbbbs.", ".bsbsbs."];
const SKULL_PAL = { h: "#ffffff", b: "#f1ecf7", s: "#c4bad8", k: "#5a2a6a" };

/** A speech bubble holding a symbol: alert "!", question "?", sleepy "z". */
function bubble(symbol: string[]): Pix {
  const rows = [".wwwwwww.", "wwwwwwwww", "wwwwwwwww", "wwwwwwwww", "wwwwwwwww", "wwwwwwwww", ".wwwwwww.", "..ww.....", ".w......."];
  const p = outlined(rows, { w: "#ffffff" });
  const ox = Math.floor((p.w - symbol[0].length) / 2);
  symbol.forEach((row, y) => [...row].forEach((ch, x) => ch !== "." && p.set(ox + x, 2 + y, ch === "r" ? "#ff5a6e" : ch === "b" ? "#5a68c0" : INK)));
  return p;
}
const ALERT = ["r", "r", "r", ".", "r"];
const QUESTION = [".bb.", "b..b", "..b.", "....", "..b."];

/** A green checkmark badge. */
const CHECK = [".......gg", "......ggG", "gg...ggG.", "Ggg.ggG..", ".GgggG...", "..GgG....", "...G....."];
const CHECK_PAL = { g: "#6ef0a4", G: "#22a060" };

/** XP gem: a faceted mint crystal, 2 twinkle frames. */
const GEM = ["..hh..", ".hwbb.", "hwbbbs", "hbbbss", ".bbss.", "..ss.."];
const GEM_PAL = { h: "#c8ffe0", w: "#ffffff", b: "#5cf2a8", s: "#22a070" };

/** A bobbing "look here" arrow. */
const ARROW_DOWN = ["..yyy..", "..yyy..", "..yYy..", "yyyYyyy", ".yyYyy.", "..yyy..", "...y..."];
const ARROW_PAL = { y: "#ffe46b", Y: "#fff6c8" };

/** A plump 5-point star. */
const STAR = ["....y....", "...yyy...", "...yYy...", "yyyyYyyyy", ".yyYYYyy.", "..yyyyy..", "..yy.yy..", ".yy...yy."];
const STAR_PAL = { y: "#ffd34d", Y: "#fff4b0" };

export function badge(name: "skull" | "alert" | "question" | "checkmark" | "xpGem" | "arrowDown" | "star", frame = 0): Pix {
  switch (name) {
    case "skull":
      return outlined(SKULL, SKULL_PAL);
    case "alert":
      return bubble(ALERT);
    case "question":
      return bubble(QUESTION);
    case "checkmark":
      return outlined(CHECK, CHECK_PAL, { line: "#1a5a3a" });
    case "xpGem": {
      const p = outlined(GEM, GEM_PAL);
      if (frame % 2) p.set(2, 2, "#ffffff");
      if (frame % 2) p.set(5, 0, "#ffffff");
      return p;
    }
    case "arrowDown":
      return outlined(ARROW_DOWN, ARROW_PAL, { line: "#7a4a1e" });
    case "star":
      return outlined(STAR, STAR_PAL, { line: "#8a5a1e" });
  }
}

/** "Zzz" for sleeping NPCs / monsters: three Zs getting bigger. */
export function zzz(): Pix {
  const p = new Pix(13, 12);
  const pal: Palette = { z: "#c9d8ff" };
  p.stamp(["zzz", ".z.", "zzz"], pal, 1, 8);
  p.stamp(["zzz", "..z", ".z.", "zzz"], pal, 4, 4);
  p.stamp(["zzzz", "...z", "..z.", ".z..", "zzzz"], pal, 8, 1);
  p.outline("#3a3a6a");
  return p;
}
