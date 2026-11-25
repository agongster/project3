/**
 * Item icons, part 2: hats, pets and trails (16×16 each).
 *
 * Hats copy the look of the hats the hero wears (characterParts.ts): the
 * icon grids use the same letters, and the colours come straight from
 * HAT_ART, so recolouring a hat there recolours its icon too.
 * Pets are big-headed portraits in the same colours as the pet sprites.
 * Trails are a little swirl of their particle shape in their own colours.
 */
import { TRAILS } from "@/lib/game/catalog";
import { INK, withAlpha } from "./color";
import { HAT_ART } from "./characterParts";
import { Pix, type Palette } from "./engine";
import type { IconArt } from "./itemsGear";
import { PET_PAL } from "./pets";
import { outlined } from "./uiKit";

// ───────────────────────────── hats ─────────────────────────────

/** Hat grids. Letters (as in characterParts.ts): a main · A shade · z highlight · x/X accents · k dark. */
const HAT_ROWS: Record<string, string[]> = {
  beanie: ["......xx......", ".....xXxX.....", "....zaaaaA....", "..zzaaaaaaaA..", ".zaaaaaaaaaaA.", ".zaaaaaaaaaaA.", "zaaaaaaaaaaaAA", "zaaaaaaaaaaaAA", "XxXxXxXxXxXxXx", "xXxXxXxXxXxXxX"],
  strawHat: ["....zzaaaa....", "...zaaaaaaA...", "...zaaaaaaaA..", "...xxxxxxxxX..", ".zzaaaaaaaaaA.", "zaaaaaaaaaaaaA", ".AAAAAAAAAAAA."],
  partyHat: ["......XX......", "......XX......", "......aa......", ".....zaxa.....", ".....axaaA....", "....zaaxaa....", "....xaaaxaA...", "...zaxaaaxa...", "...aaaxaaaxA..", "..zaaaaxaaaaA.", "..XxXxXxXxXxX."],
  headphones: ["....zaaaaaa...", "..zaa.....aA..", ".za.........A.", ".a..........A.", ".a..........A.", "xxa........axx", "xXa........aXX", "xXa........aXX", ".xx........xx."],
  catEars: ["..a........A..", "..aa......AA..", "..azA....AzA..", "..azzA..AzzA..", ".azzzaaaazzzA.", "kkkkkkkkkkkkkk", "k............k", "k............k"],
  flowerCrown: ["....zk.xX.....", "..aAazaaxaXk..", ".aA........Xa.", ".zk.........A.", ".aA........aA.", "..aXaaxaazaA..", "....AAAAAA...."],
  topHat: ["...zaaaaaaA...", "...zaaaaaaA...", "...zaaaaaaA...", "...zaaaaaaA...", "...zaaaaaaA...", "...xxxxxxxX...", "...xxxxxxxX...", "zzzaaaaaaaaaAA", "AAAAAAAAAAAAAA"],
  wizardHat: ["........A.....", ".......aA.....", "......zaA.....", ".....zaaA.....", ".....zxaaA....", "....zaaaaA....", "....zaaaxaA...", "...zaxaaaaA...", "...zaaaaaaaA..", "..xxxxXxxxXx..", "zzaaaaaaaaaaAA", "AAAAAAAAAAAAA."],
  snakeHood: ["....zzaaa.....", "..zzaaaaaaA...", ".zaaxkaaxkaA..", "zaaaaaaaaaaaA.", "aaaaaaaaaaaaA.", "zaaaaaXXaaaaAA", "zaaAAAAAAAAaAA", "aaA........AaA", "aA..........AA", "aA..........AA"],
  halo: ["...zzaaaaaA...", ".zzA......aAA.", "zA..........aA", ".aAA......AAA.", "...AAAAAAAA..."],
  crown: [".z....a....A..", ".za..zaa..aA..", ".zaa.zaa.aaA..", ".zaaazaaaaaA..", ".zaXaaaxaaXA..", ".zaaaaaaaaaA..", ".AAAAAAAAAAA.."],
};

/** Cat ears take the wearer's hair colour; the icon shows them in a friendly brown. */
const HAIR_FOR_ICON = { "@hair": "#8d5a3a", "@hairShade": "#6b3f2a" } as Record<string, string>;

function hatPal(id: string): Palette {
  const src = HAT_ART[id]?.pal ?? { a: "#c9a6f2", A: "#9a7ad0", z: "#e8d8ff", x: "#ffd34d", X: "#ff8fab" };
  const pal: Palette = { k: "#3d3a52" };
  for (const [k, v] of Object.entries(src)) pal[k] = HAIR_FOR_ICON[v] ?? v;
  return pal;
}

export const HAT_ICONS: Record<string, IconArt> = Object.fromEntries(Object.entries(HAT_ROWS).map(([id, rows]) => [id, { rows, pal: hatPal(id) }]));

// ───────────────────────────── pets ─────────────────────────────

/** Pet portraits: big heads, big eyes. w = eye shine, f = fang. */
const PET_HEADS: Record<string, string[]> = {
  duckling: [".....hb......", "......hb.....", "...hhhbbbb...", "..hhbbbbbbb..", ".hhbbbbbbbbs.", ".hbbwkbbwkbs.", ".hbbkkbbkkbs.", ".hbpbooooobps", ".sbbbbOOObbs.", "..sbbbbbbss..", "...ssssss...."],
  snek: ["...hhbbbb....", "..hbbbbbbbb..", ".hbbwkbbwkbb.", ".hbbkkbbkkbbs", ".hbbbbbbbbbbs", ".hbpbbbbbbpbs", "..syyyyyyyys.", "...sYYYYYYs..", "......r......", ".....r.r....."],
  byteBat: ["...h.....h....", "...hb...hb....", "..hbbbbbbbs...", "M.hbeebeebs.M.", "mMhbeebeebsMm.", "mmMbbbbbbbMmm.", "mmmsbfbfbsmmm.", ".mm.sbpbs.mm..", "..m..sss..m..."],
  pixelCat: [".b.........b.", ".bb.......bb.", ".bpb.....bpb.", ".bbbbbbbbbbb.", "bbbbbbbbbbbbs", "bbbeebbbeebbs", "bbbwebbbwebbs", "bcccbbpbbcccs", ".ccccekecccs.", "..sbbbbbbbs.."],
  cloudPuff: ["....hhh......", "..hhhbbhhh...", ".hhbbbbbbbh..", "hhbbbbbbbbbh.", "hbbbkbbbkbbbh", "hbbbkbbbkbbbs", "hbbpbbkbbpbbs", ".sbbbbbbbbbs.", "..ssdsssdss.."],
  starSprite: ["......h......", ".....hbs.....", ".....hbs.....", "hhhhhbbbbssss", ".hbbbbbbbbbs.", "..hbkbbbkbs..", "..hbbpkpbbs..", "..hbbbbbbbs..", ".hbbbs.sbbbs.", ".hbs.....sbs.", ".s.........s."],
};

export const PET_ICONS: Record<string, IconArt> = Object.fromEntries(
  Object.entries(PET_HEADS).map(([id, rows]) => [id, { rows, pal: { ...PET_PAL[id], w: "#ffffff", f: "#ffffff", e: id === "pixelCat" ? INK : PET_PAL[id].e } }]),
);

// ───────────────────────────── trails ─────────────────────────────

/** The particle shapes, one colour each ("#" = the particle colour, "w" = white). */
const SHAPES: Record<string, string[]> = {
  sparkle: ["..#..", "..#..", "##w##", "..#..", "..#.."],
  petal: [".##.", "#w##", "###.", ".#.."],
  heart: ["##.##", "#w###", ".###.", "..#.."],
  bit0: ["###", "#.#", "#.#", "###"],
  bit1: [".#.", "##.", ".#.", "###"],
  note: ["..##", "..#.", "..#.", "###.", "###."],
};

/** Particle centres in the 16×16 icon: a big one bottom-left, two smaller up the swoosh. */
const SWIRL_SPOTS: [number, number][] = [
  [5, 10],
  [11, 6],
  [12, 12],
];

/** Rainbow Road: two notes standing under the arc. */
const NOTE_SPOTS: [number, number][] = [
  [5, 11],
  [11, 12],
];

/** The six colours of a rainbow, for Rainbow Road's little arc. */
const RAINBOW = ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#4dabf7", "#b197fc"];

/** A trail icon: a faint swoosh with three outlined particles riding it. */
export function trailIcon(id: string): Pix | null {
  const def = TRAILS.find((t) => t.id === id);
  if (!def) return null;
  const p = new Pix(16, 16);
  if (def.shape === "note") {
    // a tiny rainbow arc behind the notes
    RAINBOW.forEach((c, i) => {
      const r = 7.5 - i;
      for (let a = 0; a <= 40; a++) {
        const ang = Math.PI + (a / 40) * Math.PI;
        p.set(Math.round(7.5 + Math.cos(ang) * r), Math.round(9 + Math.sin(ang) * r), c);
      }
    });
  } else {
    // a dotted swoosh curving up from the bottom-left
    for (let i = 0; i < 14; i++) {
      const t = i / 13;
      const x = Math.round(1 + t * 13);
      const y = Math.round(14 - Math.sin(t * Math.PI * 0.75) * 11);
      if (i % 2 === 0) p.set(x, y, withAlpha(def.colors[i % def.colors.length], 0.6));
    }
  }
  const spots = def.shape === "note" ? NOTE_SPOTS : SWIRL_SPOTS;
  spots.forEach(([cx, cy], i) => {
    let name: string = def.shape;
    if (def.shape === "bit") name = i % 2 ? "bit1" : "bit0";
    const rows = SHAPES[name];
    const color = def.shape === "note" ? ["#ffffff", "#fff4b0", "#ffd0f0"][i] : def.colors[i % def.colors.length];
    const part = outlined(rows, { "#": color, w: "#ffffff" });
    p.paste(part, cx - Math.floor(part.w / 2), cy - Math.floor(part.h / 2));
  });
  return p;
}
