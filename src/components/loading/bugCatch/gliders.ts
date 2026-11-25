/**
 * The little things the bugs float down with: a striped parachute, or a leaf
 * held up like an umbrella (in the theme's leaf colours, so sakura bugs ride
 * pink petals and autumn bugs ride maple leaves).
 *
 * These are tiny string-grid sprites in the art module's format (see
 * src/game/art/engine.ts). The anchor is the bottom-centre: the point where
 * the strings / stem meet the bug's head.
 */
import { PALETTES, type Sprite } from "@/game/art";
import { INK, light, shade } from "@/game/art/color";
import { Pix, type Palette } from "@/game/art/engine";
import type { ThemeId } from "@/lib/types";

/** o outline · a canopy · b middle panel · w shine · s string */
const PARACHUTE = [
  ".....ooooooooo.....",
  "...ooawwbbbaaaoo...",
  "..oawwaabbbbbaaao..",
  ".oawaaabbbbbbbaaao.",
  "oaaaaabbbbbbbaaaaao",
  "ooooooooooooooooooo",
  ".s...............s.",
  "..s.............s..",
  "...s...........s...",
  "....s.........s....",
];

/** o outline · l leaf · L leaf shade · v vein · s stem */
const LEAF = [
  ".....oooooooo.....",
  "...oollllllLLoo...",
  "..olllvvvvvvlLLo..",
  ".ollllllllllllLLo.",
  "olllllllllllllllLo",
  ".oooo........oooo.",
  ".........s........",
  ".........s........",
  ".........s........",
];

/** Cheerful canopy colours; each bug gets one based on its id. */
const CANOPY_COLORS = ["#ff7a8a", "#7ad0ff", "#a98bff", "#7fdc8c", "#ffa95c"];
const GOLD_CANOPY = "#ffd84a";
const STRING_COLOR = "#f7f1e6";

const store = new Map<string, Sprite>();

function build(key: string, rows: readonly string[], pal: Palette): Sprite {
  let s = store.get(key);
  if (!s) {
    const pix = Pix.fromGrid(rows, pal);
    s = pix.toSprite(Math.floor(pix.w / 2), pix.h);
    store.set(key, s);
  }
  return s;
}

/** A parachute; `colorIndex` picks the canopy colour (any integer), golden bugs get a gold one. */
export function parachuteSprite(colorIndex: number, golden: boolean): Sprite {
  const canopy = golden ? GOLD_CANOPY : CANOPY_COLORS[Math.abs(colorIndex) % CANOPY_COLORS.length];
  return build(`chute:${canopy}`, PARACHUTE, {
    o: shade(canopy, 0.45),
    a: canopy,
    b: light(canopy, 0.18),
    w: "#ffffff",
    s: STRING_COLOR,
  });
}

/** A leaf umbrella in the theme's foliage colours (gold for golden bugs). */
export function leafSprite(theme: ThemeId, golden: boolean): Sprite {
  const pal = PALETTES[theme];
  const leaf = golden ? GOLD_CANOPY : pal.leaves[3];
  return build(`leaf:${theme}:${golden}`, LEAF, {
    o: golden ? shade(GOLD_CANOPY, 0.45) : pal.leavesLine,
    l: leaf,
    L: shade(leaf, 0.12),
    v: light(leaf, 0.15),
    s: golden ? shade(GOLD_CANOPY, 0.3) : INK,
  });
}
